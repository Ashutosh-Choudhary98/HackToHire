import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiJSON } from "./ai-gateway.server";

const CATEGORIES = ["technical", "conceptual", "behavioral", "scenario"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

// ---------------- Create interview (analyze resume + JD) ----------------
export const createInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(120),
        resume_text: z.string().min(50).max(20000),
        jd_text: z.string().min(20).max(20000),
        max_questions: z.number().int().min(3).max(15).default(8),
        voice_mode: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [resumeProfile, jdProfile] = await Promise.all([
      aiJSON<{
        skills: string[];
        experience: string;
        projects: string[];
        education: string[];
        technologies: string[];
      }>([
        {
          role: "system",
          content:
            "You are a resume parser. Extract structured candidate data. Return ONLY JSON with keys: skills (string[]), experience (string summary), projects (string[]), education (string[]), technologies (string[]).",
        },
        { role: "user", content: data.resume_text },
      ]),
      aiJSON<{
        required_skills: string[];
        role: string;
        experience: string;
        stack: string[];
      }>([
        {
          role: "system",
          content:
            "You are a job description parser. Return ONLY JSON with keys: required_skills (string[]), role (string), experience (string), stack (string[]).",
        },
        { role: "user", content: data.jd_text },
      ]),
    ]);

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({
        user_id: userId,
        title: data.title,
        resume_text: data.resume_text,
        jd_text: data.jd_text,
        resume_profile: resumeProfile,
        jd_profile: jdProfile,
        max_questions: data.max_questions,
        voice_mode: data.voice_mode,
        current_difficulty: "medium",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Generate first question
    await generateNextQuestionInternal(supabase, userId, interview.id);

    return { interviewId: interview.id as string };
  });

// ---------------- Get interview + questions ----------------
export const getInterview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: interview, error } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !interview) throw new Error("Interview not found");
    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("*")
      .eq("interview_id", data.id)
      .order("idx", { ascending: true });
    if (qErr) throw new Error(qErr.message);
    return { interview, questions: questions ?? [] };
  });

// ---------------- List user's interviews ----------------
export const listInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("interviews")
      .select("id,title,status,final_score,created_at,question_count,max_questions")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { interviews: data ?? [] };
  });

// ---------------- Submit answer + evaluate + next question ----------------
export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        questionId: z.string().uuid(),
        answer: z.string().max(8000),
        timeTakenSec: z.number().int().min(0).max(3600),
        confidencePct: z.number().int().min(0).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error: qErr } = await supabase
      .from("questions")
      .select("*, interviews!inner(*)")
      .eq("id", data.questionId)
      .eq("user_id", userId)
      .single();
    if (qErr || !q) throw new Error("Question not found");
    if (q.scores) throw new Error("Already answered");

    const interview = (q as { interviews: Record<string, unknown> }).interviews;

    // Time penalty: 0 if answered within 50% of limit, scales to 0 at 100%+
    const timeRatio = data.timeTakenSec / (q.time_limit_sec || 120);
    let timeEff = 100;
    if (timeRatio > 0.5) timeEff = Math.max(0, Math.round(100 - (timeRatio - 0.5) * 200));

    const answer = (data.answer || "").trim();
    let evaluation: {
      accuracy: number;
      clarity: number;
      relevance: number;
      depth: number;
      communication: number;
      feedback: string;
    };

    if (!answer) {
      evaluation = {
        accuracy: 0,
        clarity: 0,
        relevance: 0,
        depth: 0,
        communication: 0,
        feedback: "No answer was provided.",
      };
      timeEff = 0;
    } else {
      const voiceMode = Boolean((interview as { voice_mode?: boolean }).voice_mode);
      evaluation = await aiJSON([
        {
          role: "system",
          content:
            "You are a strict but fair technical interviewer. Evaluate the candidate's answer. Return ONLY JSON with integer keys (0-100): accuracy, clarity, relevance, depth, communication, and a string 'feedback' (2-3 sentences, constructive)." +
            (voiceMode
              ? " The candidate answered VERBALLY and the text was produced by speech-to-text, so tolerate minor transcription artifacts (mis-heard words, missing punctuation, filler words like 'um'/'uh'). Score 'communication' primarily on spoken flow: structure, coherence and conciseness of the spoken delivery. Score 'clarity' on how understandable the spoken explanation is. Do not penalize the candidate for transcription quirks."
              : ""),
        },
        {
          role: "user",
          content: `Question (${q.category}, ${q.difficulty}): ${q.question}\n\nExpected points: ${JSON.stringify(q.expected_points)}\n\nCandidate's answer${voiceMode ? " (transcribed from speech)" : ""}: ${answer}`,
        },
      ]);
    }

    const overall = Math.round(
      (evaluation.accuracy + evaluation.clarity + evaluation.relevance + evaluation.depth + evaluation.communication + timeEff) / 6,
    );

    const scores = {
      ...evaluation,
      time_efficiency: timeEff,
      confidence: typeof data.confidencePct === "number" ? data.confidencePct : null,
      overall,
    };
    delete (scores as Record<string, unknown>).feedback;

    await supabase
      .from("questions")
      .update({
        answer,
        time_taken_sec: data.timeTakenSec,
        scores,
        feedback: evaluation.feedback,
        answered_at: new Date().toISOString(),
      })
      .eq("id", data.questionId);

    // Adaptive difficulty
    let nextDifficulty: "easy" | "medium" | "hard" = interview.current_difficulty as "easy" | "medium" | "hard";
    if (overall > 80) nextDifficulty = nextDifficulty === "easy" ? "medium" : "hard";
    else if (overall < 50) nextDifficulty = nextDifficulty === "hard" ? "medium" : "easy";

    const newCount = (interview.question_count as number) + 1;
    const maxQ = interview.max_questions as number;
    let shouldEnd = newCount >= maxQ;
    let terminationReason: string | null = null;

    // Conservative early termination: only after >=4 answered questions and a
    // critically low running average. Avoids premature ends from one bad answer.
    if (!shouldEnd && newCount >= 4) {
      const { data: answeredQs } = await supabase
        .from("questions")
        .select("scores")
        .eq("interview_id", q.interview_id)
        .not("scores", "is", null);
      const list = (answeredQs ?? []) as { scores: { overall: number } | null }[];
      if (list.length >= 4) {
        const avg = list.reduce((s, r) => s + (r.scores?.overall ?? 0), 0) / list.length;
        if (avg < 35) {
          shouldEnd = true;
          terminationReason = `Interview ended early: performance below readiness threshold (avg ${Math.round(avg)}/100 after ${list.length} questions).`;
        }
      }
    }

    await supabase
      .from("interviews")
      .update({
        question_count: newCount,
        current_difficulty: nextDifficulty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", q.interview_id);

    if (shouldEnd) {
      await finalizeInterviewInternal(supabase, userId, q.interview_id as string, terminationReason);
      return { ended: true, questionScores: scores, feedback: evaluation.feedback, terminationReason };
    }

    // Do NOT generate next question inline — keeps submit fast.
    // Client will call generateNextQuestion separately.
    return { ended: false, questionScores: scores, feedback: evaluation.feedback };
  });

// ---------------- Generate next question (called by client after submit) ----------------
export const generateNextQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ interviewId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify ownership
    const { data: iv } = await supabase
      .from("interviews")
      .select("id,user_id,status")
      .eq("id", data.interviewId)
      .eq("user_id", userId)
      .single();
    if (!iv) throw new Error("Interview not found");
    if (iv.status !== "in_progress") return { ok: true, skipped: true };

    // Check if an unanswered question already exists (idempotent)
    const { data: pending } = await supabase
      .from("questions")
      .select("id")
      .eq("interview_id", data.interviewId)
      .is("scores", null)
      .limit(1);
    if (pending && pending.length > 0) return { ok: true, skipped: true };

    await generateNextQuestionInternal(supabase, userId, data.interviewId);
    return { ok: true, skipped: false };
  });

// ---------------- Internals ----------------
async function generateNextQuestionInternal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  interviewId: string,
) {
  const { data: interview } = await supabase.from("interviews").select("*").eq("id", interviewId).single();
  if (!interview) throw new Error("Interview not found");

  const { data: prior } = await supabase
    .from("questions")
    .select("idx,category,question")
    .eq("interview_id", interviewId)
    .order("idx", { ascending: true });
  const idx = (prior?.length ?? 0);

  // Rotate category
  const category = CATEGORIES[idx % CATEGORIES.length];
  const difficulty = interview.current_difficulty as (typeof DIFFICULTIES)[number];

  const q = await aiJSON<{
    question: string;
    expected_points: string[];
    time_limit_sec: number;
  }>([
    {
      role: "system",
      content:
        "You generate one interview question at a time. Return ONLY JSON: { question: string, expected_points: string[], time_limit_sec: integer between 60-240 }. Tailor to the candidate's resume and the JD. Avoid repeating prior questions.",
    },
    {
      role: "user",
      content: JSON.stringify({
        category,
        difficulty,
        resume_profile: interview.resume_profile,
        jd_profile: interview.jd_profile,
        prior_questions: (prior ?? []).map((p: { question: string }) => p.question),
      }),
    },
  ]);

  await supabase.from("questions").insert({
    interview_id: interviewId,
    user_id: userId,
    idx,
    category,
    difficulty,
    question: q.question,
    expected_points: q.expected_points,
    time_limit_sec: Math.min(240, Math.max(60, q.time_limit_sec || 120)),
  });
}

async function finalizeInterviewInternal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  _userId: string,
  interviewId: string,
  terminationReason: string | null,
) {
  const { data: qs } = await supabase
    .from("questions")
    .select("*")
    .eq("interview_id", interviewId)
    .order("idx", { ascending: true });
  const answered = (qs ?? []).filter((q: { scores: unknown }) => q.scores);

  const avg = (key: string) =>
    answered.length === 0
      ? 0
      : Math.round(
          answered.reduce((s: number, q: { scores: Record<string, number> }) => s + (q.scores?.[key] ?? 0), 0) /
            answered.length,
        );

  const breakdown = {
    accuracy: avg("accuracy"),
    clarity: avg("clarity"),
    relevance: avg("relevance"),
    depth: avg("depth"),
    communication: avg("communication"),
    time_efficiency: avg("time_efficiency"),
  };
  const overall = Math.round(
    (breakdown.accuracy + breakdown.clarity + breakdown.relevance + breakdown.depth + breakdown.communication + breakdown.time_efficiency) / 6,
  );

  let category: string;
  if (overall >= 80) category = "Strong Candidate";
  else if (overall >= 60) category = "Average Candidate";
  else category = "Needs Improvement";

  // Per-category (skill-area) breakdown: technical / conceptual / behavioral / scenario
  const byCategory: Record<string, { score: number; count: number }> = {};
  for (const cat of CATEGORIES) byCategory[cat] = { score: 0, count: 0 };
  for (const q of answered as { category: string; scores: { overall: number } }[]) {
    if (byCategory[q.category]) {
      byCategory[q.category].score += q.scores?.overall ?? 0;
      byCategory[q.category].count += 1;
    }
  }
  const by_skill_area = Object.fromEntries(
    Object.entries(byCategory).map(([k, v]) => [k, v.count ? Math.round(v.score / v.count) : 0]),
  );

  // Generate strengths / weaknesses / suggestions via AI
  const summary = await aiJSON<{
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    hiring_readiness: string;
  }>([
    {
      role: "system",
      content:
        "Summarize an interview performance. Return ONLY JSON with keys: strengths (string[]), weaknesses (string[]), suggestions (string[]), hiring_readiness (one of 'Ready to hire', 'Hire with reservations', 'Not ready').",
    },
    {
      role: "user",
      content: JSON.stringify({
        overall_score: overall,
        breakdown,
        by_skill_area,
        questions: answered.map((q: {
          category: string;
          difficulty: string;
          question: string;
          scores: Record<string, number>;
          feedback: string;
        }) => ({
          category: q.category,
          difficulty: q.difficulty,
          question: q.question,
          score: q.scores?.overall,
          feedback: q.feedback,
        })),
      }),
    },
  ]);

  const final_report = { breakdown, by_skill_area, category, ...summary };

  await supabase
    .from("interviews")
    .update({
      status: terminationReason ? "terminated" : "completed",
      termination_reason: terminationReason,
      final_score: overall,
      final_report,
      updated_at: new Date().toISOString(),
    })
    .eq("id", interviewId);
}


import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getInterview, submitAnswer, generateNextQuestion } from "@/lib/interview.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Timer, Mic } from "lucide-react";
import { WebcamConfidence, type ConfidenceHandle } from "@/components/WebcamConfidence";
import { VoiceInterview } from "@/components/VoiceInterview";

export const Route = createFileRoute("/_authenticated/interview/$id")({
  head: () => ({ meta: [{ title: "Interview in progress — Hack2Hire" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: InterviewRunner,
});

function InterviewRunner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchInterview = useServerFn(getInterview);
  const submit = useServerFn(submitAnswer);
  const genNext = useServerFn(generateNextQuestion);

  const { data, isLoading } = useQuery({
    queryKey: ["interview", id],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");
      return fetchInterview({ data: { id } });
    },
    refetchInterval: false,
    retry: false,
  });

  useEffect(() => {
    if (data && data.interview.status !== "in_progress") {
      navigate({ to: `/report/${id}`, replace: true });
    }
  }, [data, id, navigate]);

  const currentQ = useMemo(() => {
    if (!data) return null;
    return data.questions.find((q) => !q.scores) ?? null;
  }, [data]);

  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [camOn, setCamOn] = useState(false);
  const camRef = useRef<ConfidenceHandle>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentQ) return;
    setAnswer("");
    setSecondsLeft(currentQ.time_limit_sec);
    startRef.current = Date.now();
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentQ?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (payload: { skip?: boolean }) => {
      if (!currentQ) throw new Error("No active question");
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      const confidencePct = camOn ? camRef.current?.getConfidence() : undefined;
      return submit({
        data: {
          questionId: currentQ.id,
          answer: payload.skip ? "" : answer,
          timeTakenSec: Math.min(elapsed, currentQ.time_limit_sec),
          confidencePct,
        },
      });
    },
    onSuccess: async (res) => {
      toast.success(res.ended ? "Interview complete!" : `Question scored: ${res.questionScores.overall}/100`);
      if (!res.ended) {
        try {
          await genNext({ data: { interviewId: id } });
        } catch (e) {
          toast.error("Failed to load next question: " + (e as Error).message);
        }
      }
      qc.invalidateQueries({ queryKey: ["interview", id] });
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (secondsLeft === 0 && currentQ && !mutation.isPending) {
      mutation.mutate({ skip: !answer.trim() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const { interview, questions } = data;
  const progress = (interview.question_count / interview.max_questions) * 100;
  const voiceMode = Boolean((interview as { voice_mode?: boolean }).voice_mode);

  if (!currentQ) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        <p className="mt-3 text-muted-foreground">Preparing your next question…</p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["interview", id] })}
          className="mt-4 rounded-md glass px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>
    );
  }

  const timeColor = secondsLeft < 15 ? "text-destructive" : secondsLeft < 30 ? "text-warning" : "text-foreground";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-semibold">
            {interview.title}
            {voiceMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                <Mic className="h-3 w-3" /> Voice mode
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCamOn((v) => !v)}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
            >
              {camOn ? "Stop camera" : "Enable camera"}
            </button>
            <span className="text-muted-foreground">
              Question {currentQ.idx + 1} of {interview.max_questions}
            </span>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full gradient-bg transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="glass rounded-2xl p-6 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-secondary px-2 py-0.5 capitalize text-muted-foreground">
              {currentQ.category}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 capitalize text-muted-foreground">
              {currentQ.difficulty}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 font-mono text-lg font-bold ${timeColor}`}>
            <Timer className="h-4 w-4" />
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </div>
        </div>
        <h2 className="mt-4 text-xl font-semibold leading-snug">{currentQ.question}</h2>

        {voiceMode && (
          <div className="mt-4">
            <VoiceInterview
              question={currentQ.question}
              onTranscriptChange={(t) => setAnswer(t)}
              disabled={mutation.isPending}
            />
          </div>
        )}

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={voiceMode ? "Your spoken answer will appear here — feel free to edit before submitting." : "Type your answer…"}
          rows={9}
          disabled={mutation.isPending}
          className="mt-5 w-full resize-none rounded-md border border-border bg-input/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => mutation.mutate({ skip: true })}
            disabled={mutation.isPending}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-60"
          >
            Skip
          </button>
          <button
            onClick={() => mutation.mutate({})}
            disabled={mutation.isPending || !answer.trim()}
            className="inline-flex items-center gap-2 rounded-md gradient-bg px-5 py-2.5 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Evaluating…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Submit answer
              </>
            )}
          </button>
        </div>
      </div>

        <aside className="space-y-3">
          <WebcamConfidence ref={camRef} active={camOn} />
        </aside>
      </div>


      {questions.filter((q) => q.scores).length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Previous questions</h3>
          <ul className="space-y-2">
            {questions
              .filter((q) => q.scores)
              .map((q) => {
                const s = q.scores as { overall: number } | null;
                return (
                  <li
                    key={q.id}
                    className="flex items-center justify-between rounded-lg glass px-4 py-2 text-sm"
                  >
                    <span className="truncate pr-3">
                      Q{q.idx + 1}. {q.question}
                    </span>
                    <span className="font-bold">{s?.overall ?? 0}/100</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}

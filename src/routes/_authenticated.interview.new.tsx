import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createInterview } from "@/lib/interview.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Mic } from "lucide-react";
import { PdfDropzone } from "@/components/PdfDropzone";

export const Route = createFileRoute("/_authenticated/interview/new")({
  head: () => ({ meta: [{ title: "New interview — Hack2Hire" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: NewInterview,
});

function NewInterview() {
  const navigate = useNavigate();
  const create = useServerFn(createInterview);
  const [title, setTitle] = useState("Frontend Engineer Mock");
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [maxQ, setMaxQ] = useState(8);
  const [voiceMode, setVoiceMode] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");
      return create({
        data: { title, resume_text: resume, jd_text: jd, max_questions: maxQ, voice_mode: voiceMode },
      });
    },
    onSuccess: (res) => {
      toast.success("Interview ready — first question generated");
      navigate({ to: `/interview/${res.interviewId}` });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Start a new interview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste your resume and the target job description. We'll analyze both and tailor the interview.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (resume.trim().length < 50) return toast.error("Resume needs at least 50 characters");
          if (jd.trim().length < 20) return toast.error("Job description needs at least 20 characters");
          mutation.mutate();
        }}
        className="mt-8 space-y-5"
      >
        <div className="glass rounded-2xl p-5">
          <label className="block text-sm font-medium">Interview title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-input/40 px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="glass rounded-2xl p-5">
          <label className="block text-sm font-medium">Resume</label>
          <div className="mt-2">
            <PdfDropzone onText={setResume} />
          </div>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="…or paste your resume text — skills, experience, projects, education…"
            rows={9}
            className="mt-3 w-full resize-none rounded-md border border-border bg-input/40 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{resume.length} chars</div>
        </div>

        <div className="glass rounded-2xl p-5">
          <label className="block text-sm font-medium">Job description</label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the job description — role, required skills, tech stack…"
            rows={8}
            className="mt-2 w-full resize-none rounded-md border border-border bg-input/40 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 text-right text-xs text-muted-foreground">{jd.length} chars</div>
        </div>

        <div className="glass rounded-2xl p-5">
          <label className="block text-sm font-medium">Number of questions</label>
          <input
            type="range"
            min={3}
            max={15}
            value={maxQ}
            onChange={(e) => setMaxQ(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="text-sm text-muted-foreground">{maxQ} questions</div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Mic className="h-4 w-4 text-primary" /> Voice interview mode
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                The AI reads each question aloud and transcribes your spoken answers. Evaluation tolerates
                transcription artifacts and weights <span className="font-medium">communication</span> and{" "}
                <span className="font-medium">clarity</span> on your spoken delivery. Requires a Chromium-based
                browser and microphone access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVoiceMode((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                voiceMode ? "bg-primary" : "bg-secondary"
              }`}
              aria-pressed={voiceMode}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-background shadow transition ${
                  voiceMode ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md gradient-bg px-5 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing & preparing your interview…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Start interview
            </>
          )}
        </button>
      </form>
    </div>
  );
}

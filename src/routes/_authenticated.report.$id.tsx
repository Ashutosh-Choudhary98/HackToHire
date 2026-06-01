import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInterview } from "@/lib/interview.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Trophy, TriangleAlert, Mic } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/report/$id")({
  head: () => ({ meta: [{ title: "Interview report — Hack2Hire" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: Report,
});

type Breakdown = {
  accuracy: number;
  clarity: number;
  relevance: number;
  depth: number;
  communication: number;
  time_efficiency: number;
};
type FinalReport = {
  breakdown: Breakdown;
  by_skill_area?: Record<string, number>;
  category: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  hiring_readiness: string;
};

function Report() {
  const { id } = Route.useParams();
  const fetchInterview = useServerFn(getInterview);
  const { data, isLoading } = useQuery({
    queryKey: ["interview", id],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");
      return fetchInterview({ data: { id } });
    },
    retry: false,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading report…
      </div>
    );
  }

  const { interview, questions } = data;
  const report = interview.final_report as FinalReport | null;
  const score = Number(interview.final_score ?? 0);

  if (!report) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-muted-foreground">This interview has no report yet.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const radarData = Object.entries(report.breakdown).map(([key, value]) => ({
    metric: key.replace("_", " "),
    score: value,
  }));

  const barData = questions
    .filter((q) => q.scores)
    .map((q) => ({
      name: `Q${q.idx + 1}`,
      score: (q.scores as { overall: number }).overall,
    }));

  const badgeColor =
    score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";

  return (
    <div>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mt-4 glass rounded-2xl p-8 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{interview.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {interview.status === "terminated" ? "Ended early" : "Completed"} •{" "}
              {new Date(interview.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${badgeColor}`}>{Math.round(score)}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Readiness Score
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-semibold ${badgeColor}`}>
            <Trophy className="h-4 w-4" /> {report.category}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
            Hiring: {report.hiring_readiness}
          </span>
          {(interview as { voice_mode?: boolean }).voice_mode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
              <Mic className="h-3.5 w-3.5" /> Voice interview
            </span>
          )}
        </div>

        {(interview as { voice_mode?: boolean }).voice_mode && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">Voice mode scoring:</span> answers were transcribed
            from speech, so the evaluator tolerated transcription artifacts and weighted{" "}
            <span className="font-medium">communication</span> on spoken delivery flow and{" "}
            <span className="font-medium">clarity</span> on how understandable each spoken explanation was.
            Accuracy, depth and relevance were scored the same as text mode.
          </div>
        )}

        {interview.termination_reason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-destructive" />
            <span>{interview.termination_reason}</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold">Skill breakdown</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.68 0.025 260)", fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "oklch(0.55 0.025 260)" }} />
                <Radar dataKey="score" stroke="oklch(0.72 0.18 285)" fill="oklch(0.72 0.18 285)" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold">Per-question scores</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.68 0.025 260)" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "oklch(0.68 0.025 260)" }} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 265)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="score" fill="oklch(0.72 0.18 285)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {report.by_skill_area && Object.keys(report.by_skill_area).length > 0 && (
        <div className="mt-6 glass rounded-2xl p-6">
          <h3 className="font-semibold">Performance by skill area</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart
                data={Object.entries(report.by_skill_area).map(([k, v]) => ({
                  name: k.charAt(0).toUpperCase() + k.slice(1),
                  score: v,
                }))}
              >
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.68 0.025 260)" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "oklch(0.68 0.025 260)" }} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 265)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="score" fill="oklch(0.78 0.16 200)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ListCard title="Strengths" items={report.strengths} variant="success" />
        <ListCard title="Weaknesses" items={report.weaknesses} variant="warning" />
        <ListCard title="Suggestions" items={report.suggestions} variant="primary" />
      </div>

      <div className="mt-6 glass rounded-2xl p-6">
        <h3 className="font-semibold">Question history</h3>
        <ul className="mt-4 space-y-3">
          {questions.map((q) => {
            const s = q.scores as { overall: number } | null;
            return (
              <li key={q.id} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    Q{q.idx + 1} • <span className="capitalize">{q.category}</span> •{" "}
                    <span className="capitalize">{q.difficulty}</span>
                  </div>
                  {s && <div className="font-bold">{s.overall}/100</div>}
                </div>
                <div className="mt-2 text-sm font-medium">{q.question}</div>
                {q.answer && (
                  <div className="mt-2 whitespace-pre-wrap rounded-md bg-background/40 p-2 text-xs text-muted-foreground">
                    {q.answer}
                  </div>
                )}
                {q.feedback && (
                  <div className="mt-2 text-xs italic text-muted-foreground">💡 {q.feedback}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "success" | "warning" | "primary";
}) {
  const color =
    variant === "success" ? "text-success" : variant === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className={`font-semibold ${color}`}>{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={color}>•</span>
            <span>{it}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}

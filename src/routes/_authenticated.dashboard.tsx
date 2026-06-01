import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listInterviews } from "@/lib/interview.functions";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Hack2Hire" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: Dashboard,
});

function Dashboard() {
  const fetchList = useServerFn(listInterviews);
  const { data, isLoading } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Please sign in again.");
      return fetchList();
    },
    retry: false,
  });

  const interviews = data?.interviews ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your interviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review past sessions or start a new one.</p>
        </div>
        <Link
          to="/interview/new"
          className="inline-flex items-center gap-2 rounded-md gradient-bg px-4 py-2.5 font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> New interview
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {!isLoading && interviews.length === 0 && (
          <Link
            to="/interview/new"
            className="glass col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl p-12 text-center hover:bg-secondary/40"
          >
            <FileText className="h-10 w-10 text-primary" />
            <h3 className="text-lg font-semibold">No interviews yet</h3>
            <p className="text-sm text-muted-foreground">Start your first AI mock interview to see results here.</p>
          </Link>
        )}
        {interviews.map((i) => {
          const isDone = i.status === "completed" || i.status === "terminated";
          const link = isDone ? `/report/${i.id}` : `/interview/${i.id}`;
          return (
            <Link
              key={i.id}
              to={link}
              className="glass rounded-2xl p-5 transition hover:bg-secondary/40"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{i.title}</h3>
                <StatusBadge status={i.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>{i.question_count}/{i.max_questions} questions</span>
                {typeof i.final_score === "number" && (
                  <span className="font-bold text-foreground">{Math.round(Number(i.final_score))}/100</span>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {new Date(i.created_at).toLocaleString()}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; Icon: typeof Clock; cls: string }> = {
    in_progress: { label: "In progress", Icon: Clock, cls: "text-warning" },
    completed: { label: "Completed", Icon: CheckCircle2, cls: "text-success" },
    terminated: { label: "Ended early", Icon: XCircle, cls: "text-destructive" },
  };
  const v = map[status] ?? map.in_progress;
  const Icon = v.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs ${v.cls}`}>
      <Icon className="h-3 w-3" /> {v.label}
    </span>
  );
}

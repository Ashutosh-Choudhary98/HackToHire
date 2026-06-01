import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Gauge, FileText, Sparkles, Timer, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hack2Hire AI Interviewer — Land your next job, prepared" },
      {
        name: "description",
        content:
          "Adaptive AI mock interviews tailored to your resume and target role. Get a readiness score, strengths, weaknesses, and clear next steps.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg gradient-bg shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-lg">Hack2Hire</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1 rounded-md gradient-bg px-3 py-2 font-medium text-primary-foreground shadow-glow"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Adaptive AI Interviewer
        </div>
        <h1 className="mt-6 text-5xl font-bold leading-tight md:text-6xl">
          Ace your next interview with an <span className="gradient-text">AI that adapts</span> to you
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Upload your resume, drop in a job description, and run a full mock interview. We score
          accuracy, clarity, depth, communication, and timing — then deliver a readiness report.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-md gradient-bg px-5 py-3 text-base font-semibold text-primary-foreground shadow-glow"
          >
            Start a free mock interview <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md glass px-5 py-3 text-base font-medium"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-4">
        {[
          { icon: FileText, title: "Resume + JD analysis", body: "AI extracts your skills and matches them to the role." },
          { icon: Brain, title: "Adaptive questions", body: "Difficulty shifts based on your scores in real time." },
          { icon: Timer, title: "Timed answers", body: "Per-question countdowns with time-efficiency scoring." },
          { icon: Gauge, title: "Readiness score", body: "Six-dimension breakdown with strengths and gaps." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="glass rounded-2xl p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="glass rounded-3xl p-10 text-center shadow-glow">
          <TrendingUp className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-3xl font-bold">Practice. Score. Improve.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every interview ends with a detailed report — strengths, weaknesses, suggestions, and a
            hiring-readiness indicator.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-md gradient-bg px-5 py-3 font-semibold text-primary-foreground shadow-glow"
          >
            Create an account
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Hack2Hire — Built on Lovable.
      </footer>
    </div>
  );
}

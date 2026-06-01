import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Hack2Hire" },
      { name: "description", content: "Create your Hack2Hire account and start your AI mock interview." },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.success("Account created. Please check your email to verify before signing in.");
      navigate({ to: "/login", replace: true });
      return;
    }
    toast.success("Account created!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    if (!result.redirected && !result.error) navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-glow">
        <Link to="/" className="mb-6 flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg gradient-bg">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </span>
          Hack2Hire
        </Link>
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start your first mock interview in 60 seconds.</p>

        <button
          onClick={handleGoogle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 font-medium hover:bg-secondary"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-input/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-input/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min. 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-input/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md gradient-bg px-4 py-2.5 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have one?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

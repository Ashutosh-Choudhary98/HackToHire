import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Hack2Hire" },
      { name: "description", content: "Sign in to your Hack2Hire AI interview account." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    setLoading(false);
    if (userError || !userData.user) return toast.error("Sign-in could not be verified. Please try again.");
    toast.success("Signed in");
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
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue your prep.</p>

        <button
          onClick={handleGoogle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 font-medium hover:bg-secondary"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-input/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md gradient-bg px-4 py-2.5 font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

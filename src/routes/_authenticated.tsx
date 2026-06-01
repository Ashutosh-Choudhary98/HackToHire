import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthShell,
});

function AuthShell() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg gradient-bg shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </span>
            Hack2Hire
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Dashboard
            </Link>
            <Link to="/" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Home
            </Link>
            {email && <span className="hidden text-muted-foreground md:inline">{email}</span>}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-md glass px-3 py-1.5 hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

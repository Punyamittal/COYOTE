"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { loginAction, setupInitialAdmin } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction({ userId, password });
      if (!result.success) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Welcome back");
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    });
  }

  function onSetup() {
    setFormError(null);
    startTransition(async () => {
      const result = await setupInitialAdmin();
      if (!result.success) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Main Admin ready. Sign in as ${result.userId} and change your password.`);
      setUserId(result.userId ?? "admin");
    });
  }

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 15%, #d7e6f8 0%, transparent 50%), radial-gradient(ellipse 70% 55% at 92% 80%, #f0d9d4 0%, transparent 45%), linear-gradient(165deg, #e8eef5 0%, #dfe8f4 50%, #e8eef5 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,47,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,47,77,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-md shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-[#3B82F6]">
            <CalendarDays className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">
              Schedule<span className="text-[#3B82F6]">Hub</span>
            </p>
            <p className="text-xs font-medium text-[var(--muted-foreground)]">
              Institutional scheduling
            </p>
          </div>
        </div>
        <p className="hidden text-xs font-medium text-[var(--muted-foreground)] sm:block">
          Secure sign-in
        </p>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md min-h-0 flex-1 justify-center overflow-y-auto px-4 py-2 scrollbar-none sm:px-6">
        <section className="flex w-full items-center py-2">
          <div className="glass-strong mx-auto w-full max-w-md rounded-[28px] p-5 sm:rounded-[32px] sm:p-7">
            <div className="space-y-0.5">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-2xl">
                Welcome back
              </h1>
              <p className="text-xs text-[var(--muted-foreground)] sm:text-sm">
                Sign in with your username and password.
              </p>
            </div>

            {formError ? (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm font-medium text-red-800"
              >
                {formError}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-xs font-bold uppercase tracking-wider">
                  Username / ID
                </Label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden
                  />
                  <Input
                    id="userId"
                    autoComplete="username"
                    autoFocus
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    required
                    placeholder="e.g. admin"
                    className="pl-11"
                    disabled={pending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    required
                    placeholder="••••••••"
                    className="pl-11 pr-12"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-white/40 hover:text-[var(--foreground)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <details className="group glass mt-5 rounded-2xl open:glass-inset">
              <summary
                className={cn(
                  "cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)] transition-colors",
                  "marker:content-none [&::-webkit-details-marker]:hidden",
                  "hover:text-[var(--foreground)]"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  First-time server setup
                  <span
                    className="text-xs font-normal text-[var(--muted-foreground)] group-open:hidden"
                    aria-hidden
                  >
                    Expand
                  </span>
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4 pt-1">
                <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Creates the Main Admin from{" "}
                  <code className="rounded bg-white/60 px-1 py-0.5 text-[10px]">
                    INITIAL_ADMIN_*
                  </code>{" "}
                  in your environment. Use only once on a fresh database.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={onSetup}
                  disabled={pending}
                >
                  Run initial Main Admin setup
                </Button>
              </div>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}

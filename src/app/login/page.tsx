import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)]">
          <div
            className="h-10 w-10 animate-pulse rounded-2xl neu-raised-sm"
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--muted-foreground)]">Loading sign-in…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

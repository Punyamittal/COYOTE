"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loginAction, setupInitialAdmin } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await loginAction({ userId, password });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Signed in");
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    });
  }

  function onSetup() {
    startTransition(async () => {
      const result = await setupInitialAdmin();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Main Admin created: ${result.userId}. Sign in and change your password.`);
    });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 20%, #dbe4f0 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, #f3e6dc 0%, transparent 45%), linear-gradient(160deg, #f4f6f8 0%, #e8eef4 100%)",
        }}
      />
      <Card className="relative z-10 w-full max-w-md border-[var(--border)] shadow-md">
        <CardHeader className="space-y-2">
          <p className="font-display text-2xl font-semibold text-[var(--primary)]">ScheduleHub</p>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Enter your username / ID and password to access the scheduling system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">Username / ID</Label>
              <Input
                id="userId"
                autoComplete="username"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Login"}
            </Button>
          </form>
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              First-time setup uses INITIAL_ADMIN_* environment variables.
            </p>
            <Button type="button" variant="outline" className="w-full" onClick={onSetup} disabled={pending}>
              Run initial Main Admin setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

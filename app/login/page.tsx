"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const errorMessages: Record<string, string> = {
  AccessDenied: "Your email was not found in the Hablu Programmer LMS.",
  OAuthSignin: "Unable to start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  Inactive: "Your account has been deactivated.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = error ? errorMessages[error] ?? "Sign-in failed. Please try again." : null;

  return <LoginShell message={message} />;
}

function LoginShell({ message }: { message?: string | null }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-500/25 to-violet-500/20 blur-[110px]" />
        <div
          className="aurora-blob absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-gradient-to-tr from-violet-500/20 to-cyan-500/15 blur-[120px]"
          style={{ animationDelay: "-8s" }}
        />
      </div>

      <section className="glass relative w-full max-w-md rounded-3xl p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Hablu <span className="brand-text">Support Library</span>
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            For Hablu Programmer LMS members
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {message ? (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-950/40 dark:text-danger-200">
              {message}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="brand-bg inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            <svg aria-hidden className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Link className="font-medium text-cyan-600 hover:underline dark:text-cyan-300" href="/">
              Back to home
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

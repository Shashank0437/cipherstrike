"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { safeInternalPath } from "@/lib/nav";
import { generateCaptchaString, ImageCaptcha } from "./ImageCaptcha";

/** Stitch secure login — `public/stitch-login.html` tokens (node 8f6abae9a75c49d8969ac7a231fc16f2). */
const c = {
  onSurface: "#30323e",
  onSurfaceVariant: "#5d5e6c",
  primary: "#684cb6",
  onPrimary: "#fdf7ff",
  primaryDim: "#5b3fa9",
  primaryContainer: "#a589f8",
  surface: "#fbf8ff",
  surfaceContainer: "#eeecfa",
  surfaceContainerLow: "#f4f2fe",
  surfaceContainerLowest: "#ffffff",
  surfaceVariant: "#e2e1f2",
  outline: "#797988",
  outlineVariant: "#b1b1c0",
  tertiary: "#006d4b",
  tertiaryContainer: "#6bffc1",
  onTertiaryContainer: "#006042",
} as const;

const defaultOperatorEmail =
  process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? "operator@cipherstrike.local";

function humanizeLoginApiMessage(raw: string): string {
  if (raw.includes("special-use or reserved name") || raw.includes("not a valid email address")) {
    return "The server is running an older build that rejects this operator id. Stop any extra API process on port 8000 and start the app from the repo (e.g. python3 run_api.py) so login accepts operator@…local addresses.";
  }
  return raw;
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return humanizeLoginApiMessage(detail);
  }
  if (Array.isArray(detail)) {
    const msgs: string[] = [];
    for (const item of detail) {
      if (item && typeof item === "object" && "msg" in item && typeof (item as { msg: unknown }).msg === "string") {
        msgs.push((item as { msg: string }).msg);
      }
    }
    if (msgs.length) {
      return humanizeLoginApiMessage(msgs.join(" "));
    }
  }
  return "Login failed";
}

const fieldClass =
  "relative z-[1] w-full rounded-lg border border-outline-variant bg-surface-container-low py-3 pr-4 pl-11 text-base font-medium text-on-surface outline-none transition placeholder:text-outline/50 focus:border-transparent focus:ring-2 focus:ring-primary";

export function LoginForm() {
  const { login, user, loading: authLoading } = useAuth();
  const search = useSearchParams();
  const router = useRouter();
  const nextRaw = search.get("next");
  const next = useMemo(
    () => safeInternalPath(nextRaw, "/history"),
    [nextRaw],
  );
  const [email, setEmail] = useState(defaultOperatorEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptchaString);
  const [captchaParts, setCaptchaParts] = useState<string[]>(["", "", "", "", ""]);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(next);
    }
  }, [authLoading, user, router, next]);

  function newCaptcha() {
    setCaptcha(generateCaptchaString());
    setCaptchaParts(["", "", "", "", ""]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const answer = captchaParts.join("").toUpperCase();
    if (answer.length !== 5 || answer !== captcha) {
      setError("Enter the 5 characters shown in the image.");
      newCaptcha();
      return;
    }
    setPending(true);
    try {
      await login(email, password, next);
    } catch (err) {
      if (err instanceof ApiError && err.body) {
        try {
          const j = JSON.parse(err.body) as { detail?: string | object[] };
          setError(formatApiErrorDetail(j.detail));
        } catch {
          setError("Login failed");
        }
      } else {
        setError("Login failed");
      }
      newCaptcha();
    } finally {
      setPending(false);
    }
  }

  if (authLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ color: c.onSurfaceVariant, background: `linear-gradient(180deg, ${c.surface} 0%, #efeaf8 100%)` }}
      >
        Loading…
      </div>
    );
  }

  if (user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ color: c.onSurfaceVariant, background: `linear-gradient(180deg, ${c.surface} 0%, #efeaf8 100%)` }}
      >
        Entering command network…
      </div>
    );
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto px-6 py-10 antialiased"
      style={{ color: c.onSurface, background: `linear-gradient(180deg, ${c.surface} 0%, #efeaf8 100%)` }}
    >
      <div className="grain-stitch pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute top-[-8%] left-[-8%] h-[38%] w-[38%] rounded-full blur-[100px]"
        style={{ backgroundColor: `${c.primaryContainer}2e` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-8%] bottom-[-8%] h-[38%] w-[38%] rounded-full blur-[100px]"
        style={{ backgroundColor: `${c.tertiaryContainer}1f` }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-primary-dim bg-primary shadow-sm">
            <span
              className="material-symbols-outlined text-3xl text-on-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden
            >
              shield_lock
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-on-surface uppercase">CipherStrike</h1>
          <p className="text-sm font-medium tracking-tight text-on-surface-variant">Secure Login • Offensive Ops Portal</p>
        </div>

        <div className="space-y-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4" id="login-form">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="email">
                  Operator ID
                </label>
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 z-0 -translate-y-1/2 text-lg text-outline"
                    aria-hidden
                  >
                    alternate_email
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={fieldClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-end justify-between">
                  <label className="ml-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">
                    Access Cipher
                  </label>
                  <span className="cursor-default text-[10px] font-bold tracking-tighter text-primary uppercase hover:underline">
                    Lost Key?
                  </span>
                </div>
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 z-0 -translate-y-1/2 text-lg text-outline"
                    aria-hidden
                  >
                    key
                  </span>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>

            <div className="relative flex items-center py-2">
              <div className="min-h-px min-w-0 flex-1 border-t border-outline-variant/50" />
              <span className="mx-4 shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-outline">Required Protocol</span>
              <div className="min-h-px min-w-0 flex-1 border-t border-outline-variant/50" />
            </div>

            <div className="flex items-start gap-4 rounded-lg border border-tertiary/20 bg-tertiary-container/20 p-4">
              <span className="material-symbols-outlined text-tertiary" aria-hidden>
                verified_user
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold text-on-tertiary-container uppercase">Session verification</p>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  Type the code from the image into the five boxes. Tap <span className="font-medium text-on-surface">New</span> for a
                  different image.
                </p>
              </div>
            </div>

            <ImageCaptcha
              value={captcha}
              cells={captchaParts}
              onCellChange={(i, v) => {
                setCaptchaParts((prev) => {
                  const next = [...prev];
                  next[i] = v;
                  return next;
                });
              }}
              onRequestNew={newCaptcha}
            />

            {error && (
              <p className="text-sm font-sans text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-dim disabled:opacity-60"
            >
              <span className="uppercase tracking-wide">{pending ? "Initiating…" : "Initiate session"}</span>
              <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1" aria-hidden>
                arrow_forward
              </span>
            </button>
          </form>
        </div>

        <div className="flex flex-col items-center space-y-3.5">
          <div
            className="flex max-w-md flex-wrap items-center justify-center gap-y-1 text-[0.58rem] font-extrabold tracking-[0.2em] text-[#4b4d58] uppercase"
            style={{ columnGap: "0.5rem" }}
          >
            <a className="shrink-0 transition hover:text-[#5b3fa9]" href="#">
              Security policy
            </a>
            <span className="h-0.5 w-0.5 rounded-full bg-[#b8c0c9]" aria-hidden />
            <a className="shrink-0 transition hover:text-[#5b3fa9]" href="#">
              Incident response
            </a>
            <span className="h-0.5 w-0.5 rounded-full bg-[#b8c0c9]" aria-hidden />
            <a className="shrink-0 transition hover:text-[#5b3fa9]" href="#">
              Node status
            </a>
          </div>
          <p className="max-w-xs px-1 text-center text-[0.58rem] leading-relaxed text-[#6b6b7a]">
            Authorized access only. All activities are logged and monitored under the Global
            Offensive Operations directive.
          </p>
          <p className="text-[0.62rem] font-extrabold tracking-[0.2em] text-[#4b4d58] uppercase">
            <Link href="/" className="transition hover:text-[#5b3fa9]">
              ← Return to launch
            </Link>
          </p>
        </div>
      </div>

      <div
        className="pointer-events-none absolute bottom-10 left-6 z-0 hidden w-[12.5rem] max-w-[calc(100%-3rem)] rounded-lg border p-3.5 shadow sm:block"
        style={{ backgroundColor: "#f6f2fc", borderColor: c.outlineVariant }}
      >
        <div className="mb-2 flex items-center gap-2">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: c.tertiary }}
            aria-hidden
          />
          <span className="text-[0.58rem] font-extrabold tracking-tight text-[#1a1a20] uppercase">
            System integrity
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#e2e1e8]">
          <div
            className="h-1 w-[94%] rounded-full"
            style={{ background: `linear-gradient(90deg,${c.tertiary} 0%,#34d39a 100%)` }}
            aria-hidden
          />
        </div>
        <p className="mt-1.5 text-[0.58rem] leading-snug text-[#4b4d58]">
          Encryption standard AES-256 active. Proxy mesh stabilized.
        </p>
      </div>

      <div
        className="pointer-events-none absolute top-10 right-6 z-0 hidden flex-col items-end gap-1.5 sm:flex"
        aria-hidden
      >
        <span className="text-[0.5rem] font-extrabold tracking-[0.3em] text-[#6b6b7a] uppercase">
          Terminal sync
        </span>
        <div className="flex items-end gap-0.5">
          <div className="h-4 w-1.5 rounded-[0.1rem] bg-[#9b7df0]" style={{ minHeight: "0.5rem" }} />
          <div
            className="h-2.5 w-1.5 rounded-[0.1rem] bg-[#9b7df0]"
            style={{ minHeight: "0.6rem" }}
          />
          <div className="h-5 w-1.5 rounded-[0.1rem] bg-[#5b3fa9]" style={{ minHeight: "0.4rem" }} />
          <div
            className="h-3.5 w-1.5 rounded-[0.1rem] bg-[#9b7df0]"
            style={{ minHeight: "0.3rem" }}
          />
        </div>
      </div>

      <div
        className="border-outline-variant/20 pointer-events-none fixed top-0 right-0 h-full w-0.5 border-l border-[#d0dbe5]/30"
        aria-hidden
      />
      <div
        className="border-outline-variant/20 pointer-events-none fixed top-0 left-0 h-full w-0.5 border-r border-[#d0dbe5]/30"
        aria-hidden
      />
    </main>
  );
}

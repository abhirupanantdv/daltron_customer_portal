import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import DocumentTitle from "@/components/DocumentTitle";
import Logo from "@/components/Logo";
import { returnHref, signIn } from "@/lib/auth";
import { fieldClass, primaryBtn } from "@/components/ui";

export default function LoginPage() {
  const location = useLocation();
  const emailRef = useRef(null);
  const codeRef = useRef(null);
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    emailRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (challenge) codeRef.current?.focus({ preventScroll: true });
  }, [challenge]);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const email = usr.trim();
    if (!email || !pwd) {
      setError("Enter your email and password.");
      return;
    }
    if (challenge && !otp.trim()) {
      setError("Enter the verification code.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await signIn({
        usr: email,
        pwd,
        otp: challenge ? otp.trim() : "",
        tmpId: challenge?.tmpId || "",
      });
      if (result.status === "otp") {
        setChallenge({
          prompt: result.prompt || "Enter the verification code",
          tmpId: result.tmpId || "",
        });
        setSubmitting(false);
        return;
      }
      const next = returnHref(new URLSearchParams(location.search).get("redirect-to"));
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those credentials were not accepted.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DocumentTitle title="Sign in — AnantDV" />
      <header className="flex h-16 shrink-0 items-center bg-brand px-6 text-white sm:px-10">
        <Logo className="h-9 w-auto sm:h-10" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-surface px-6 py-8 shadow-[0_18px_50px_rgba(9,31,43,0.08)] sm:px-8 dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.22em] text-mute">AnantDV Support</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-balance">{challenge ? "Verification" : "Sign in"}</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            {challenge ? challenge.prompt : "Use the email and password from your ERPNext account."}
          </p>
          <form onSubmit={onSubmit} className="mt-8 grid gap-4" noValidate>
            {challenge ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="login-otp">
                  Verification code
                </label>
                <input
                  ref={codeRef}
                  id="login-otp"
                  name="otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className={fieldClass}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="login-email">
                    Email or username
                  </label>
                  <input
                    ref={emailRef}
                    id="login-email"
                    name="username"
                    type="text"
                    value={usr}
                    onChange={(event) => setUsr(event.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="login-password">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={pwd}
                      onChange={(event) => setPwd(event.target.value)}
                      autoComplete="current-password"
                      className={`${fieldClass} pr-16`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-mute outline-none hover:text-ink"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </>
            )}
            {error ? (
              <p role="alert" className="rounded-xl bg-mist px-3 py-2 text-sm text-ink">
                {error}
              </p>
            ) : null}
            <button type="submit" className={`${primaryBtn} mt-2 w-full`} disabled={submitting}>
              {submitting ? "Signing in" : challenge ? "Verify" : "Sign in"}
            </button>
            {challenge ? (
              <button
                type="button"
                className="text-sm font-medium text-mute outline-none hover:text-ink"
                onClick={() => {
                  setChallenge(null);
                  setOtp("");
                  setError("");
                }}
              >
                Back to sign in
              </button>
            ) : null}
          </form>
        </div>
      </main>
    </div>
  );
}

const ON_SITE = import.meta.env.PROD;

export function appLoginHref() {
  return ON_SITE ? "/ticket/login" : "/login";
}

export function safeReturnPath(raw) {
  if (typeof raw !== "string") return "/";
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  let path = value;
  if (ON_SITE) {
    if (path === "/ticket" || path === "/ticket/") path = "/";
    else if (path.startsWith("/ticket/")) path = path.slice("/ticket".length);
  }
  const pathname = path.split("?")[0];
  if (pathname === "/login" || pathname.startsWith("/login/")) return "/";
  return path || "/";
}

export function returnHref(raw) {
  const next = safeReturnPath(raw);
  if (!ON_SITE) return next;
  if (next === "/") return "/ticket";
  return `/ticket${next}`;
}

export async function getSession() {
  if (ON_SITE) return siteSession();
  const response = await fetch("/api/erp/session", { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  if (!body?.user || body.user === "Guest") return null;
  return { user: body.user, fullName: body.fullName || body.user };
}

export async function signIn({ usr, pwd, otp, tmpId }) {
  if (ON_SITE) return siteSignIn({ usr, pwd, otp, tmpId });
  const response = await fetch("/api/erp/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ usr, pwd, otp: otp || "", tmpId: tmpId || "" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.status === "otp") return payload;
  if (!response.ok || payload.status !== "ok") throw new Error(failureText(payload));
  return payload;
}

export async function signOut() {
  if (!ON_SITE) {
    const response = await fetch("/api/erp/logout", { method: "POST" });
    if (!response.ok) throw new Error("Could not sign out.");
    window.location.assign(appLoginHref());
    return;
  }
  const response = await fetch("/api/method/logout", {
    method: "GET",
    credentials: "same-origin",
    redirect: "manual",
    headers: { Accept: "application/json" },
  });
  if (!(response.ok || response.type === "opaqueredirect")) throw new Error("Could not sign out.");
  window.location.assign(appLoginHref());
}

async function siteSession() {
  const response = await fetch("/api/method/frappe.auth.get_logged_user", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  const user = typeof body.message === "string" ? body.message : "";
  if (!user || user === "Guest") return null;
  return { user, fullName: cookieValue("full_name") || user };
}

async function siteSignIn({ usr, pwd, otp, tmpId }) {
  const body = new URLSearchParams({ usr, pwd });
  if (otp) body.set("otp", otp);
  if (tmpId) body.set("tmp_id", tmpId);
  const response = await fetch("/api/method/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.verification && payload.message !== "Logged In") {
    return {
      status: "otp",
      prompt: payload.verification.prompt || payload.verification.method || "Enter the verification code",
      tmpId: payload.tmp_id || "",
    };
  }
  if (!response.ok || payload.message !== "Logged In") throw new Error(failureText(payload));
  return {
    status: "ok",
    user: cookieValue("user_id") || usr,
    fullName: payload.full_name || cookieValue("full_name") || usr,
  };
}

function cookieValue(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return match[1];
  }
}

function failureText(payload) {
  if (typeof payload?.error === "string" && payload.error) return payload.error;
  if (payload?.message === "Password Reset") return "Reset the password on this account, then sign in again.";
  if (typeof payload?.message === "string" && payload.message && payload.message !== "Logged In") return stripHtml(payload.message);
  if (payload?._server_messages) {
    try {
      const messages = JSON.parse(payload._server_messages).map((item) => {
        const parsed = typeof item === "string" ? JSON.parse(item) : item;
        return stripHtml(parsed.message || "");
      });
      const text = messages.filter(Boolean).join(" ");
      if (text) return text;
    } catch {
      /* Fall through to the exception text. */
    }
  }
  if (typeof payload?.exception === "string") {
    const text = stripHtml(payload.exception).replace(/^[\w.]*Error:\s*/, "");
    if (text) return text;
  }
  return "Those credentials were not accepted.";
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

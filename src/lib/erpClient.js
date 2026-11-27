import { appLoginHref, siteCsrfHeaders } from "@/lib/auth";

const ON_SITE = import.meta.env.PROD;

function errorMessage(body) {
  if (body?.error) return body.error;
  if (body?._server_messages) {
    try {
      const messages = JSON.parse(body._server_messages).map((item) => {
        const parsed = typeof item === "string" ? JSON.parse(item) : item;
        return stripHtml(parsed.message || "");
      });
      const text = messages.filter(Boolean).join(" ");
      if (text) return text;
    } catch {
      /* Fall through to the exception text. */
    }
  }
  if (typeof body?.exception === "string") {
    const text = stripHtml(body.exception).replace(/^[\w.]*Error:\s*/, "");
    if (text) return text;
  }
  return ON_SITE ? "The ticket service rejected the request." : "ERPNext request failed";
}

function onLoginPage() {
  const path = window.location.pathname;
  return path === "/login" || path === "/ticket/login" || path.startsWith("/ticket/login/");
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

async function readJson(response) {
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(ON_SITE ? "The ticket service is not available." : "The ticket service is not available. Restart the dev server.");
  }
  if (needsSignIn(response.status, body) && !onLoginPage()) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${appLoginHref()}?redirect-to=${encodeURIComponent(next)}`);
    throw new Error("Sign in to continue.");
  }
  if (!response.ok || body.exc_type || body.exception) throw new Error(errorMessage(body));
  return body.message ?? body;
}

function needsSignIn(status, body) {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /not whitelisted|login to access|session expired/i.test(errorMessage(body));
}

async function siteCall(method, { method: httpMethod = "GET", body, headers } = {}) {
  const verb = String(httpMethod || "GET").toUpperCase();
  const write = verb !== "GET" && verb !== "HEAD";
  const csrf = write ? await siteCsrfHeaders() : {};
  const response = await fetch(`/api/method/ticket_system.api.${method}`, {
    method: verb,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...csrf,
      ...headers,
    },
    ...(body == null || !write ? {} : { body }),
  });
  return readJson(response);
}

export async function fetchTickets() {
  const body = ON_SITE
    ? await siteCall("get_tickets")
    : await readJson(await fetch("/api/erp/tickets"));
  return body.tickets || [];
}

export async function fetchOptions() {
  if (ON_SITE) return siteCall("get_options");
  return readJson(await fetch("/api/erp/options"));
}

export async function postTicket(input) {
  if (ON_SITE) {
    return siteCall("create_ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
  return readJson(
    await fetch("/api/erp/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchNotifications() {
  if (ON_SITE) return siteCall("get_notifications");
  return readJson(await fetch("/api/erp/notifications"));
}

export async function markNotificationRead(name) {
  if (ON_SITE) {
    return siteCall("mark_notification_read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }
  return readJson(
    await fetch("/api/erp/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function postReply(id, message) {
  if (ON_SITE) {
    return siteCall("reply_ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: id, message }),
    });
  }
  return readJson(
    await fetch(`/api/erp/tickets/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
  );
}

export async function uploadTicketFile(id, file) {
  if (ON_SITE) {
    const form = new FormData();
    form.append("ticket", id);
    form.append("file", file, file.name || "attachment");
    return siteCall("upload_ticket_file", { method: "POST", body: form });
  }
  const params = new URLSearchParams({ filename: file.name || "attachment" });
  return readJson(
    await fetch(`/api/erp/tickets/${encodeURIComponent(id)}/files?${params}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    }),
  );
}

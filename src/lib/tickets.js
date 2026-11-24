export const CATEGORIES = ["Billing", "Account", "Technical", "Orders", "Other"];
export const PRIORITIES = ["Low", "Normal", "High"];
export const PROJECTS = ["AnantDV Web", "AnantDV Mobile", "Billing portal", "Admin workspace"];
export const CHANNELS = [
  { id: "chat", label: "Chat" },
  { id: "email", label: "Email" },
  { id: "call", label: "Call" },
];

const REFERENCE_CATEGORIES = new Set(["Billing", "Account", "Orders"]);

export function needsReference(category) {
  return REFERENCE_CATEGORIES.has(category);
}

export function channelLabel(id) {
  return CHANNELS.find((item) => item.id === id)?.label ?? "";
}

export const SEED = [
  {
    id: "TK-2041",
    subject: "Invoice doesn't match the annual plan",
    project: "Billing portal",
    category: "Billing",
    priority: "High",
    status: "in_progress",
    name: "Sam Patel",
    email: "sam@acme.studio",
    phone: "",
    channel: "email",
    reference: "INV-2026-11",
    expected: "The November invoice should be $190, matching the annual plan.",
    createdAt: "2026-11-19T10:24:00.000Z",
    updatedAt: "2026-11-20T08:40:00.000Z",
    description:
      "The November invoice is $240, but the annual plan we agreed is $190 a month. Can you correct it and send an updated copy?",
    messages: [
      {
        id: "m-2041-1",
        from: "you",
        text: "The November invoice is $240, but the annual plan we agreed is $190 a month. Can you correct it and send an updated copy?",
        at: "2026-11-19T10:24:00.000Z",
      },
      {
        id: "m-2041-2",
        from: "support",
        text: "I checked the invoice. The annual discount didn't apply on this cycle. I'm correcting it and will attach the updated copy here.",
        at: "2026-11-20T08:40:00.000Z",
      },
    ],
  },
  {
    id: "TK-2038",
    subject: "Password reset link expires immediately",
    project: "Admin workspace",
    category: "Account",
    priority: "Normal",
    status: "waiting",
    name: "Sam Patel",
    email: "sam@acme.studio",
    phone: "",
    channel: "email",
    reference: "",
    expected: "",
    createdAt: "2026-11-18T16:05:00.000Z",
    updatedAt: "2026-11-20T06:15:00.000Z",
    description:
      "I requested a password reset and the link says it has already expired. I tried twice this morning.",
    messages: [
      {
        id: "m-2038-1",
        from: "you",
        text: "I requested a password reset and the link says it has already expired. I tried twice this morning.",
        at: "2026-11-18T16:05:00.000Z",
      },
      {
        id: "m-2038-2",
        from: "support",
        text: "Those links last 30 minutes and only work once. I just sent a fresh one to your inbox — reply here once you're back in, or if it still fails.",
        at: "2026-11-20T06:15:00.000Z",
      },
    ],
  },
  {
    id: "TK-1988",
    subject: "CSV export fails on large lists",
    project: "AnantDV Web",
    category: "Technical",
    priority: "Normal",
    status: "open",
    name: "Sam Patel",
    email: "sam@acme.studio",
    phone: "",
    channel: "chat",
    reference: "",
    expected: "",
    createdAt: "2026-11-20T04:05:00.000Z",
    updatedAt: "2026-11-20T04:05:00.000Z",
    description:
      "Exporting contacts to CSV spins for a minute and then fails when the list is over about 10,000 rows. Smaller lists work. I need the full export for a migration this week.",
    messages: [
      {
        id: "m-1988-1",
        from: "you",
        text: "Exporting contacts to CSV spins for a minute and then fails when the list is over about 10,000 rows. Smaller lists work. I need the full export for a migration this week.",
        at: "2026-11-20T04:05:00.000Z",
      },
    ],
  },
  {
    id: "TK-1912",
    subject: "Add Jordan as a workspace admin",
    project: "Admin workspace",
    category: "Account",
    priority: "Low",
    status: "resolved",
    name: "Sam Patel",
    email: "sam@acme.studio",
    phone: "",
    channel: "email",
    reference: "jordan@acme.studio",
    expected: "",
    createdAt: "2026-11-12T11:12:00.000Z",
    updatedAt: "2026-11-13T09:30:00.000Z",
    description: "Please add jordan@acme.studio as an admin on our workspace.",
    messages: [
      {
        id: "m-1912-1",
        from: "you",
        text: "Please add jordan@acme.studio as an admin on our workspace.",
        at: "2026-11-12T11:12:00.000Z",
      },
      {
        id: "m-1912-2",
        from: "support",
        text: "Jordan is added as an admin. They'll get an email to set a password.",
        at: "2026-11-12T15:44:00.000Z",
      },
      {
        id: "m-1912-3",
        from: "you",
        text: "They're in. Thanks.",
        at: "2026-11-13T09:02:00.000Z",
      },
      {
        id: "m-1912-4",
        from: "system",
        text: "You marked this ticket resolved.",
        at: "2026-11-13T09:30:00.000Z",
      },
    ],
  },
];

export function cloneSeed() {
  return JSON.parse(JSON.stringify(SEED));
}

export function loadTickets() {
  try {
    const raw = localStorage.getItem("cove.tickets.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const clean = parsed.filter(
      (ticket) =>
        ticket &&
        typeof ticket.id === "string" &&
        typeof ticket.subject === "string" &&
        typeof ticket.status === "string" &&
        Array.isArray(ticket.messages),
    );
    return clean.length ? clean : null;
  } catch {
    return null;
  }
}

export function saveTickets(tickets) {
  try {
    localStorage.setItem("cove.tickets.v1", JSON.stringify(tickets));
  } catch {
    // A full browser store should not take down the page. The ticket stays in memory.
  }
}

export function nextId(tickets) {
  const used = new Set(tickets.map((ticket) => ticket.id));
  let id = "TK-1000";
  do {
    id = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (used.has(id));
  return id;
}

export function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function byUpdated(a, b) {
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

export function matchesFilter(ticket, filter, query) {
  const q = query.trim().toLowerCase();
  if (q) {
    const hay = [
      ticket.id,
      ticket.subject,
      ticket.reportedBy,
      ticket.ticketType,
      ticket.serviceCategory,
      ticket.impact,
      ticket.urgency,
      ticket.priority,
      ticket.source,
      ticket.erpStatus,
      ticket.description,
      ticket.customerComplaint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filter === "all") return true;
  return ticket.status === filter;
}

export function planReply(text) {
  const value = text.toLowerCase();
  if (/\bthanks\b|\bthank you\b/.test(value)) {
    return { text: "Glad that helped. This thread stays here if you need anything else." };
  }
  if (/\burgent\b|\basap\b|\btoday\b/.test(value)) {
    return { text: "Understood. I've flagged this as time-sensitive and someone is on it." };
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return { text: "Thanks — a bit more detail will help us look in the right place." };
  }
  return { text: "Got it. I've added your note. The desk updates the status on this ticket." };
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const clockFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatWhen(iso, now) {
  const date = new Date(iso);
  if (!now) return dateFmt.format(date);
  const diff = Math.max(0, now - date.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function formatClock(iso, now) {
  const date = new Date(iso);
  if (!now) return clockFmt.format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (new Date(now).toDateString() === date.toDateString()) return time;
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  return `${day} · ${time}`;
}

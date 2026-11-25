const STORAGE_KEY = "anant.tour.seen";

export function tourId(pathname) {
  if (pathname === "/") return "home";
  if (pathname === "/tickets") return "tickets";
  if (pathname === "/tickets/new") return "new";
  if (/^\/tickets\/[^/]+\/chat\/?$/.test(pathname)) return "chat";
  if (/^\/tickets\/[^/]+\/?$/.test(pathname)) return "detail";
  return "home";
}

export function hasSeenTour(id) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Boolean(parsed && typeof parsed === "object" && parsed[id]);
  } catch {
    return false;
  }
}

export function rememberTour(id) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const next = parsed && typeof parsed === "object" ? parsed : {};
    next[id] = 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Storage can be unavailable in private mode. */
  }
}

function step(element, title, description, popover = {}, extra = {}) {
  return {
    element,
    popover: { title, description, ...popover },
    ...extra,
  };
}

const hold = { scrollIntoView: false };

const homeSteps = [
  {
    popover: {
      title: "Welcome to the desk",
      description: "Search, open a ticket, or reach someone. This tour shows where each of those lives. Close it whenever you want.",
    },
  },
  step("[data-tour='nav']", "Three places", "Home, your tickets, and a new request. The pill follows the page you are on.", { side: "bottom", align: "end" }, hold),
  step(
    "[data-tour='home-search']",
    "Search from here",
    "Type a subject or ticket number. The same search sits in the header on every other page.",
    { side: "bottom", align: "center" },
  ),
  step(
    "[data-tour='desk-status']",
    "Desk hours",
    "Open or closed follows weekdays, 9:00 to 18:00 IST. Messages after hours wait until the next morning.",
    { side: "bottom", align: "end" },
  ),
  step("[data-tour='channels']", "How to reach us", "Chat, email, or a callback. Each tab shows the next step.", { side: "bottom", align: "center" }),
  step(
    "[data-tour='chat-fab']",
    "Chat stays in reach",
    "Opens your latest conversation. If you have no ticket yet, it starts one.",
    { side: "top", align: "end" },
    hold,
  ),
];

const ticketSteps = [
  step("[data-tour='tickets-heading']", "Your requests", "Every ticket you have opened, with the newest activity first.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='new-ticket']",
    "Open a new one",
    "Subject and the Service Ticket fields. It joins this list as soon as you create it.",
    { side: "bottom", align: "end" },
  ),
  step(
    "[data-tour='ticket-search']",
    "Find one",
    "Search by subject or ticket number. Clear the field to show the full list again.",
    { side: "bottom", align: "start" },
  ),
  step(
    "[data-tour='ticket-filters']",
    "Filter by status",
    "Open the status list. Every status from the desk is in the menu, and each row shows how many tickets match.",
    { side: "bottom", align: "end" },
  ),
  step(
    "[data-tour='ticket-list'] li",
    "Open a ticket",
    "Number, subject, and where it stands. Select one to see the full request.",
    { side: "bottom", align: "start" },
  ),
  step(
    "[data-tour='ticket-empty']",
    "Nothing in this view",
    "Try another filter, or open a new ticket. Show every ticket clears the search.",
    { side: "top", align: "center" },
  ),
  step("[data-tour='restore-samples']", "Reload", "Loads the service desk tickets again.", { side: "top", align: "start" }),
];

const newTicketSteps = [
  step("[data-tour='field-category']", "Service category", "Network, hardware, printer, and the other categories from the desk.", { side: "bottom", align: "start" }),
  step("[data-tour='field-priority']", "Priority", "Critical, high, medium, or low.", { side: "bottom", align: "start" }),
  step("[data-tour='field-subject']", "Subject", "A short line. This is the title on the service ticket.", { side: "bottom", align: "start" }),
  step("[data-tour='field-contact']", "Reported by", "The person who reported it. This is stored on the service ticket.", { side: "bottom", align: "start" }),
  step("[data-tour='field-description']", "Description", "What happened. This is the description field on the service ticket.", { side: "top", align: "start" }),
  step("[data-tour='field-attachments']", "Photos and videos", "Add several. They are stored on the service ticket attachments.", { side: "top", align: "start" }),
  step("[data-tour='create-ticket']", "Create when you are ready", "Nothing is sent until you press this. Cancel returns to the list.", { side: "top", align: "end" }),
];

const detailSteps = [
  step("[data-tour='ticket-number']", "Ticket number", "Select it to copy. Useful when you email the desk about this request.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='ticket-status']",
    "Where it stands",
    "The status shown here is the one stored on the service ticket.",
    { side: "bottom", align: "center" },
  ),
  step(
    "[data-tour='ticket-request']",
    "Your request",
    "The description stored on the service ticket.",
    { side: "top", align: "start" },
  ),
  step(
    "[data-tour='ticket-attachments']",
    "Photos and videos",
    "Files added with the ticket. They are the attachments stored on the service desk.",
    { side: "top", align: "start" },
  ),
  step(
    "[data-tour='ticket-actions']",
    "Talk to the desk",
    "Open the chat to add more. Status is updated on the service desk.",
    { side: "top", align: "start" },
  ),
];

const chatSteps = [
  step(
    "[data-tour='chat-back']",
    "This chat belongs to one ticket",
    "Ticket status takes you back to the full request.",
    { side: "bottom", align: "start" },
    hold,
  ),
  step(
    "[data-tour='chat-status']",
    "Status stays visible",
    "The status stored on this service ticket.",
    { side: "bottom", align: "center" },
    hold,
  ),
  step(
    "[data-tour='chat-log']",
    "The conversation",
    "Your messages sit on the right, and the desk on the left. Replies arrive during open hours.",
    { side: "top", align: "center" },
    hold,
  ),
  step(
    "[data-tour='chat-compose']",
    "Write a message",
    "Enter sends. Shift+Enter adds a line. A message does not change the ticket status.",
    { side: "top", align: "center" },
    hold,
  ),
];

const replayStep = step(
  "[data-tour='tour-replay']",
  "Run it again",
  "Tutorial in the header, or Replay tutorial under your account, starts this page's tour whenever you want.",
  { side: "bottom", align: "end" },
  hold,
);

const TOURS = {
  home: [...homeSteps, replayStep],
  tickets: [...ticketSteps, replayStep],
  new: [...newTicketSteps, replayStep],
  detail: [...detailSteps, replayStep],
  chat: [...chatSteps, replayStep],
};

export function pageHasTargets(pathname) {
  const defined = TOURS[tourId(pathname)] ?? [];
  return defined.some((item) => item.element && item.element !== "[data-tour='tour-replay']" && document.querySelector(item.element));
}

const fallbackStep = {
  popover: {
    title: "Nothing to point at yet",
    description: "Open a ticket from your list, then run this tutorial again.",
  },
};

export function stepsForPath(pathname) {
  const defined = TOURS[tourId(pathname)] ?? homeSteps;
  const available = defined.filter((item) => {
    if (!item.element) return true;
    const target = document.querySelector(item.element);
    return Boolean(target && target.getClientRects().length);
  });
  const meaningful = available.filter((item) => item.element !== "[data-tour='tour-replay']");
  return meaningful.length ? available : [fallbackStep];
}

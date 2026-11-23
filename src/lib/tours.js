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
    "Subject, project, and what happened. It joins this list as soon as you create it.",
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
    "Open, in progress, waiting on you, or resolved. The count is how many match.",
    { side: "bottom", align: "end" },
  ),
  step(
    "[data-tour='ticket-list'] li",
    "Open a ticket",
    "Number, subject, project, and where it stands. Select one to see the full request.",
    { side: "bottom", align: "start" },
  ),
  step(
    "[data-tour='ticket-empty']",
    "Nothing in this view",
    "Try another filter, or open a new ticket. Show every ticket clears the search.",
    { side: "top", align: "center" },
  ),
  step("[data-tour='restore-samples']", "Sample tickets", "Puts the example requests back if the list was cleared.", { side: "top", align: "start" }),
];

const newTicketSteps = [
  step("[data-tour='field-subject']", "Subject", "A short line. This is the title you will see in the list.", { side: "bottom", align: "start" }),
  step("[data-tour='field-project']", "Project", "Which project this is about. Suggestions appear as you type.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='field-contact']",
    "Who to reach",
    "Your name and email. Add a phone number if you want a callback.",
    { side: "bottom", align: "start" },
  ),
  step("[data-tour='field-channel']", "Reply by", "Chat, email, or a call. A call needs a phone number.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='field-reference']",
    "Reference",
    "Invoice, order, or account. Required for billing, account, and order requests.",
    { side: "bottom", align: "start" },
  ),
  step("[data-tour='field-category']", "Category", "Pick the closest fit so the desk can route it.", { side: "bottom", align: "start" }),
  step("[data-tour='field-priority']", "Priority", "Normal is the usual choice. High is for something that is blocking you.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='field-description']",
    "What happened",
    "A few sentences is enough. Say what happened, and what you need.",
    { side: "top", align: "start" },
  ),
  step(
    "[data-tour='field-expected']",
    "What should have happened",
    "Optional. What you expected instead of what you got.",
    { side: "top", align: "start" },
  ),
  step("[data-tour='field-steps']", "Steps", "Optional. What you did just before this happened, if it is a bug.", { side: "top", align: "start" }),
  step("[data-tour='field-files']", "Screenshots or a video", "Up to four images and one short video. Leave this empty if you have none.", { side: "top", align: "start" }),
  step(
    "[data-tour='create-ticket']",
    "Create when you are ready",
    "Nothing is sent until you press this. Cancel returns to the list.",
    { side: "top", align: "end" },
  ),
];

const detailSteps = [
  step("[data-tour='ticket-number']", "Ticket number", "Select it to copy. Useful when you email the desk about this request.", { side: "bottom", align: "start" }),
  step(
    "[data-tour='ticket-status']",
    "Where it stands",
    "Open, in progress, waiting on you, or resolved. The note under the rail says what that means right now.",
    { side: "bottom", align: "center" },
  ),
  step(
    "[data-tour='ticket-request']",
    "Your request",
    "The description you sent. The expected outcome, steps, and files show here when you added them.",
    { side: "top", align: "start" },
  ),
  step(
    "[data-tour='ticket-actions']",
    "Resolve or talk",
    "Mark it resolved when you are done, or open the chat to add more.",
    { side: "top", align: "start" },
  ),
];

const chatSteps = [
  step(
    "[data-tour='chat-back']",
    "This chat belongs to one ticket",
    "Ticket status takes you back to the full request, the files, and the resolve button.",
    { side: "bottom", align: "start" },
    hold,
  ),
  step(
    "[data-tour='chat-status']",
    "Status stays visible",
    "The same rail as the ticket. Waiting means the desk needs a reply from you.",
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
    "Enter sends. Shift+Enter adds a line. A message can reopen a resolved ticket.",
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
    return Boolean(document.querySelector(item.element));
  });
  const meaningful = available.filter((item) => item.element !== "[data-tour='tour-replay']");
  return meaningful.length ? available : [fallbackStep];
}

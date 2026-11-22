import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  byUpdated,
  cloneSeed,
  loadTickets,
  nextId,
  planReply,
  saveTickets,
  uid,
} from "@/lib/tickets";
import LoadingScreen from "@/components/LoadingScreen";

const TicketsContext = createContext(null);

export function useTickets() {
  const value = useContext(TicketsContext);
  if (!value) throw new Error("useTickets must be used within TicketsProvider");
  return value;
}

export default function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState(cloneSeed);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [typingId, setTypingId] = useState(null);
  const [showSplash, setShowSplash] = useState(false);
  const timersRef = useRef(new Map());

  useLayoutEffect(() => {
    if (sessionStorage.getItem("cove.splash.seen") === "1") return undefined;
    let cancelled = false;
    setShowSplash(true);
    const id = setTimeout(() => {
      if (cancelled) return;
      sessionStorage.setItem("cove.splash.seen", "1");
      setShowSplash(false);
    }, 1800);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const saved = loadTickets();
    if (saved) setTickets([...saved].sort(byUpdated));
    setHydrated(true);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const timers = timersRef.current;
    return () => {
      clearInterval(tick);
      for (const handle of timers.values()) clearTimeout(handle);
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveTickets(tickets);
  }, [tickets, hydrated]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const queueReply = useCallback((id, plan) => {
    setTypingId(id);
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      const at = new Date().toISOString();
      setTickets((prev) =>
        prev
          .map((ticket) => {
            if (ticket.id !== id || ticket.status === "resolved") return ticket;
            return {
              ...ticket,
              status: plan.status,
              updatedAt: at,
              messages: [...ticket.messages, { id: uid(), from: "support", text: plan.text, at }],
            };
          })
          .sort(byUpdated),
      );
      setTypingId((current) => (current === id ? null : current));
      timersRef.current.delete(id);
    }, 1200);
    timersRef.current.set(id, handle);
  }, []);

  const sendMessage = useCallback(
    (id, text) => {
      const current = tickets.find((ticket) => ticket.id === id);
      if (!current) return;
      const at = new Date().toISOString();
      const status =
        current.status === "resolved" ? "open" : current.status === "waiting" ? "in_progress" : current.status;
      setTickets((prev) =>
        prev
          .map((ticket) =>
            ticket.id === id
              ? {
                  ...ticket,
                  status,
                  updatedAt: at,
                  messages: [...ticket.messages, { id: uid(), from: "you", text, at }],
                }
              : ticket,
          )
          .sort(byUpdated),
      );
      queueReply(id, planReply(text, status));
    },
    [tickets, queueReply],
  );

  const createTicket = useCallback(
    (input) => {
      const at = new Date().toISOString();
      const description = input.description.trim();
      const ticket = {
        id: nextId(tickets),
        subject: input.subject.trim(),
        project: input.project.trim(),
        location: input.location.trim(),
        steps: input.steps.trim(),
        category: input.category,
        priority: input.priority,
        status: "open",
        createdAt: at,
        updatedAt: at,
        description,
        attachments: (input.attachments ?? []).map((file) => ({
          id: file.id,
          name: file.name,
          kind: file.kind,
          type: file.type,
          url: file.url,
        })),
        messages: [{ id: uid(), from: "you", text: description, at }],
      };
      setTickets((prev) => [ticket, ...prev]);
      setToast(`Ticket ${ticket.id} created`);
      return ticket;
    },
    [tickets],
  );

  const resolveTicket = useCallback((id) => {
    const pending = timersRef.current.get(id);
    if (pending) {
      clearTimeout(pending);
      timersRef.current.delete(id);
    }
    setTypingId((current) => (current === id ? null : current));
    const at = new Date().toISOString();
    setTickets((prev) =>
      prev
        .map((ticket) =>
          ticket.id === id
            ? {
                ...ticket,
                status: "resolved",
                updatedAt: at,
                messages: [
                  ...ticket.messages,
                  { id: uid(), from: "system", text: "You marked this ticket resolved.", at },
                ],
              }
            : ticket,
        )
        .sort(byUpdated),
    );
    setToast("Ticket marked resolved");
  }, []);

  const restoreSamples = useCallback(() => {
    for (const handle of timersRef.current.values()) clearTimeout(handle);
    timersRef.current.clear();
    setTypingId(null);
    setTickets(cloneSeed());
    setToast("Sample tickets restored");
  }, []);

  const copyId = useCallback(async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setToast(`Copied ${id}`);
    } catch {
      setToast("Couldn't copy the ticket number");
    }
  }, []);

  const value = useMemo(
    () => ({
      tickets,
      hydrated,
      now,
      typingId,
      createTicket,
      sendMessage,
      resolveTicket,
      restoreSamples,
      copyId,
    }),
    [tickets, hydrated, now, typingId, createTicket, sendMessage, resolveTicket, restoreSamples, copyId],
  );

  return (
    <TicketsContext.Provider value={value}>
      {showSplash ? <LoadingScreen /> : children}
      {toast ? (
        <div
          role="status"
          className="cove-in fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-[0_12px_40px_rgba(9,31,43,0.28)]"
        >
          {toast}
        </div>
      ) : null}
    </TicketsContext.Provider>
  );
}

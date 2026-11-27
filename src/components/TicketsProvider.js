import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchOptions, fetchTickets, postTicket, saveChats, uploadTicketFile, withLocalChat } from "@/lib/erpClient";
import { byUpdated, planReply, uid } from "@/lib/tickets";
import LoadingScreen from "@/components/LoadingScreen";

const TicketsContext = createContext(null);

export function useTickets() {
  const value = useContext(TicketsContext);
  if (!value) throw new Error("useTickets must be used within TicketsProvider");
  return value;
}

export default function TicketsProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [statuses, setStatuses] = useState([]);
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

  const loadGeneration = useRef(0);

  const reloadTickets = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const [list, options] = await Promise.all([fetchTickets(), fetchOptions().catch(() => null)]);
    if (generation !== loadGeneration.current) return list;
    if (Array.isArray(options?.statuses)) setStatuses(options.statuses.filter(Boolean));
    setTickets([...list].sort(byUpdated));
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    reloadTickets()
      .catch((error) => {
        if (!cancelled) setToast(error.message);
      })
      .finally(() => {
        if (cancelled) return;
        setHydrated(true);
        setNow(Date.now());
      });
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const timers = timersRef.current;
    return () => {
      cancelled = true;
      clearInterval(tick);
      for (const handle of timers.values()) clearTimeout(handle);
    };
  }, [reloadTickets]);

  useEffect(() => {
    if (hydrated && tickets.length) saveChats(tickets);
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
            if (ticket.id !== id) return ticket;
            return {
              ...ticket,
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
      setTickets((prev) =>
        prev
          .map((ticket) =>
            ticket.id === id
              ? {
                  ...ticket,
                  updatedAt: at,
                  messages: [...ticket.messages, { id: uid(), from: "you", text, at }],
                }
              : ticket,
          )
          .sort(byUpdated),
      );
      queueReply(id, planReply(text));
    },
    [tickets, queueReply],
  );

  const createTicket = useCallback(async (input) => {
    const { files = [], ...fields } = input;
    const body = await postTicket(fields);
    loadGeneration.current += 1;
    const attachments = [];
    const failed = [];
    for (const file of files) {
      try {
        const uploaded = await uploadTicketFile(body.ticket.id, file);
        if (uploaded.file) attachments.push(uploaded.file);
      } catch (error) {
        failed.push(error?.message ? `${file.name || "file"} (${error.message})` : file.name || "file");
      }
    }
    const fileWarning = failed.length === 1 ? `Could not attach ${failed[0]}.` : failed.length ? `Could not attach ${failed.length} files.` : "";
    const warning = [body.warning, fileWarning].filter(Boolean).join(" ");
    const ticket = { ...withLocalChat([body.ticket])[0], attachments, uploadWarning: warning };
    setTickets((prev) => [ticket, ...prev.filter((item) => item.id !== ticket.id)].sort(byUpdated));
    setToast(warning ? `Ticket ${ticket.id} created. ${warning}` : `Ticket ${ticket.id} created`);
    return ticket;
  }, []);

  const refreshTickets = useCallback(async () => {
    try {
      await reloadTickets();
      setToast("Tickets reloaded");
    } catch (error) {
      setToast(error.message);
    }
  }, [reloadTickets]);

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
      statuses,
      hydrated,
      now,
      typingId,
      createTicket,
      sendMessage,
      refreshTickets,
      reloadTickets,
      copyId,
    }),
    [tickets, statuses, hydrated, now, typingId, createTicket, sendMessage, refreshTickets, reloadTickets, copyId],
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

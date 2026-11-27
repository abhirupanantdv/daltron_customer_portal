import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchOptions, fetchTickets, postReply, postTicket, uploadTicketFile } from "@/lib/erpClient";
import { byUpdated } from "@/lib/tickets";
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
  const [showSplash, setShowSplash] = useState(false);

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
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [reloadTickets]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const sendMessage = useCallback(async (id, text) => {
    const body = await postReply(id, text);
    const next = body?.ticket;
    if (!next?.id) throw new Error("The reply was not saved.");
    setTickets((prev) => {
      const existing = prev.find((ticket) => ticket.id === id);
      const merged = existing
        ? { ...existing, ...next, attachments: next.attachments?.length ? next.attachments : existing.attachments }
        : next;
      return [merged, ...prev.filter((ticket) => ticket.id !== id)].sort(byUpdated);
    });
  }, []);

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
    const ticket = { ...body.ticket, attachments, uploadWarning: warning };
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
      createTicket,
      sendMessage,
      refreshTickets,
      reloadTickets,
      copyId,
    }),
    [tickets, statuses, hydrated, now, createTicket, sendMessage, refreshTickets, reloadTickets, copyId],
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

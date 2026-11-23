import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Lenis from "lenis";
import { formatWhen, matchesFilter } from "@/lib/tickets";
import { useTickets } from "@/components/TicketsProvider";
import { IconPlus, IconSearch, IconTickets, PageFrame, fieldClass, primaryBtn } from "@/components/ui";

function statusFilters(statuses, tickets) {
  const fromDesk = statuses.filter(Boolean);
  const seen = new Set(fromDesk);
  const extra = [];
  for (const ticket of tickets) {
    if (ticket.status && !seen.has(ticket.status)) {
      seen.add(ticket.status);
      extra.push(ticket.status);
    }
  }
  return ["all", ...fromDesk, ...extra];
}

function filterLabel(id) {
  return id === "all" ? "All" : id;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function IconChevron({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusFilter({ filters, filter, tickets, query, onFilter }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const scrollerRef = useRef(null);
  const listRef = useRef(null);
  const currentCount = tickets.filter((ticket) => matchesFilter(ticket, filter, query)).length;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const wrapper = scrollerRef.current;
    const content = listRef.current;
    if (!wrapper || !content || prefersReducedMotion()) return undefined;
    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      autoRaf: true,
      lerp: 0.1,
      overscroll: false,
    });
    return () => lenis.destroy();
  }, [open]);

  return (
    <div ref={rootRef} data-tour="ticket-filters" className="relative w-full shrink-0 sm:w-80">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="status-filter-list"
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex items-center justify-between gap-3 bg-mist py-2.5 text-left`}
      >
        <span className="min-w-0 truncate">
          <span className="text-mute">Status</span>
          <span className="mx-2 text-ink/25" aria-hidden="true">
            ·
          </span>
          <span className="font-medium">{filterLabel(filter)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-mute">{currentCount}</span>
          <IconChevron className={`size-4 text-mute transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <div
          ref={scrollerRef}
          data-status-menu
          className="absolute right-0 z-20 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl bg-surface p-1.5 shadow-[0_18px_50px_rgba(9,31,43,0.18)] ring-1 ring-ink/10 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          <ul ref={listRef} id="status-filter-list" role="listbox" aria-label="Filter by status">
            {filters.map((id) => {
              const count = tickets.filter((ticket) => matchesFilter(ticket, id, query)).length;
              const on = filter === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      onFilter(id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      on ? "bg-mist font-medium text-ink" : "text-mute hover:bg-mist/70 hover:text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate">{filterLabel(id)}</span>
                    <span className={`shrink-0 tabular-nums ${on ? "text-ink" : "text-mute"}`}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function TicketList() {
  const { tickets, statuses, hydrated, now, refreshTickets } = useTickets();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get("status");
  const requestedQuery = params.get("q") ?? "";
  const filters = statusFilters(statuses, tickets);
  const filter = filters.includes(requested) ? requested : "all";
  const [query, setQuery] = useState(requestedQuery);

  useEffect(() => {
    setQuery(requestedQuery);
  }, [requestedQuery]);

  function onFilter(nextFilter) {
    const search = new URLSearchParams();
    if (nextFilter !== "all") search.set("status", nextFilter);
    if (query.trim()) search.set("q", query.trim());
    const qs = search.toString();
    navigate(qs ? `/tickets?${qs}` : "/tickets", { replace: true });
  }

  const filtered = tickets.filter((ticket) => matchesFilter(ticket, filter, query));

  return (
    <PageFrame>
      <div className="cove-in flex flex-wrap items-end justify-between gap-4">
        <div data-tour="tickets-heading">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Your tickets</h1>
          <p className="mt-2 text-sm text-mute">
            {!hydrated
              ? "Loading tickets from the service desk."
              : query
                ? `${filtered.length} of ${tickets.length}`
                : `${tickets.length} ${tickets.length === 1 ? "request" : "requests"}`}
            {hydrated ? " · Every ticket you have opened." : ""}
          </p>
        </div>
        <Link to="/tickets/new" data-tour="new-ticket" className={primaryBtn}>
          <IconPlus className="size-4" />
          New ticket
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-b border-ink/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div data-tour="ticket-search" className="relative w-full lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <input
            id="ticket-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subject or number"
            aria-label="Search tickets"
            className={`${fieldClass} bg-mist py-2.5 pl-10 ${query ? "pr-16" : ""}`}
          />
          {query ? (
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute hover:text-ink" onClick={() => setQuery("")}>
              Clear
            </button>
          ) : null}
        </div>
        <StatusFilter filters={filters} filter={filter} tickets={tickets} query={query} onFilter={onFilter} />
      </div>

      {!hydrated ? (
        <p className="py-20 text-center text-sm text-mute">Loading tickets…</p>
      ) : filtered.length === 0 ? (
        <div data-tour="ticket-empty" className="py-20 text-center">
          <p className="font-medium">No tickets here</p>
          <p className="mt-1 text-sm text-mute">Try another filter, or open a new ticket.</p>
          <button
            type="button"
            className={`${primaryBtn} mt-5`}
            onClick={() => {
              setQuery("");
              onFilter("all");
            }}
          >
            Show every ticket
          </button>
        </div>
      ) : (
        <ul data-tour="ticket-list" className="border-b border-ink/10">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} now={now} />
          ))}
        </ul>
      )}

      <button type="button" data-tour="restore-samples" onClick={refreshTickets} className="mt-8 self-start text-xs text-mute transition hover:text-ink">
        Reload tickets
      </button>
    </PageFrame>
  );
}

function TicketRow({ ticket, now }) {
  return (
    <li className="border-b border-ink/10 last:border-b-0">
      <Link to={`/tickets/${ticket.id}`} className="flex items-start gap-4 py-5 transition hover:text-ink">
        <IconTickets className="mt-0.5 size-4 shrink-0 text-mute" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-xs text-mute">{ticket.id}</span>
            <span className="shrink-0 text-xs text-mute">{formatWhen(ticket.updatedAt, now)}</span>
          </span>
          <span className="mt-1 block truncate text-lg font-medium">{ticket.subject}</span>
          <span className="mt-1 block text-sm text-mute">
            {[ticket.customer, ticket.serviceCategory, ticket.priority, ticket.status || ticket.erpStatus].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
    </li>
  );
}

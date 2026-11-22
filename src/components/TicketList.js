import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { STEPS, formatWhen, matchesFilter } from "@/lib/tickets";
import { useTickets } from "@/components/TicketsProvider";
import { FILTERS, IconPlus, IconSearch, IconTickets, PageFrame, fieldClass, primaryBtn } from "@/components/ui";

const STATUS_IDS = new Set(STEPS.map((step) => step.id));

export default function TicketList() {
  const { tickets, now, restoreSamples } = useTickets();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get("status");
  const requestedQuery = params.get("q") ?? "";
  const filter = STATUS_IDS.has(requested) ? requested : "all";
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
            {query ? `${filtered.length} of ${tickets.length}` : `${tickets.length} ${tickets.length === 1 ? "request" : "requests"}`}
            {" · "}Every ticket you have opened.
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
        <div data-tour="ticket-filters" className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter by status">
          {FILTERS.map(([id, label]) => {
            const count = tickets.filter((ticket) => matchesFilter(ticket, id, query)).length;
            const on = filter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => onFilter(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
                  on ? "border-ink font-medium text-ink" : "border-transparent text-mute hover:text-ink"
                }`}
              >
                {label}
                <span className={`tabular-nums ${on ? "text-ink" : "text-mute"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
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

      <button type="button" data-tour="restore-samples" onClick={restoreSamples} className="mt-8 self-start text-xs text-mute transition hover:text-ink">
        Restore sample tickets
      </button>
    </PageFrame>
  );
}

function TicketRow({ ticket, now }) {
  const step = STEPS.find((item) => item.id === ticket.status) ?? STEPS[0];
  return (
    <li className="border-b border-ink/10 last:border-b-0">
      <Link to={`/tickets/${ticket.id}`} className="flex items-start gap-4 py-5 transition hover:text-ink">
        <IconTickets className="mt-0.5 size-4 shrink-0 text-mute" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[11px] text-mute">{ticket.id}</span>
            <span className="shrink-0 text-[11px] text-mute">{formatWhen(ticket.updatedAt, now)}</span>
          </span>
          <span className="mt-1 block truncate font-medium">{ticket.subject}</span>
          <span className="mt-1 block text-sm text-mute">
            {ticket.project ? `${ticket.project} · ` : ""}
            {ticket.category}
            {ticket.priority === "High" ? " · High priority" : ""}
            {" · "}
            {step.label}
          </span>
        </span>
      </Link>
    </li>
  );
}

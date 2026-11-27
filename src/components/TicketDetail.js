import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTickets } from "@/components/TicketsProvider";
import { MediaGrid } from "@/components/MediaPreview";
import { IconBack, IconChat, MissingTicket, PageFrame, PageSkeleton, formatDay, primaryBtn } from "@/components/ui";

export default function TicketDetail() {
  const { id } = useParams();
  const location = useLocation();
  const uploadWarning = location.state?.uploadWarning || "";
  const { tickets, hydrated, copyId, reloadTickets } = useTickets();
  const ticket = tickets.find((item) => item.id === id) ?? null;
  const [lookup, setLookup] = useState("");

  useEffect(() => {
    if (!hydrated || ticket || lookup === id || lookup === `pending:${id}`) return undefined;
    setLookup(`pending:${id}`);
    reloadTickets()
      .catch(() => {})
      .finally(() => setLookup(id));
    return undefined;
  }, [hydrated, id, lookup, reloadTickets, ticket]);

  if (!ticket && lookup !== id) return <PageSkeleton />;
  if (!ticket) return <MissingTicket />;

  const messages = ticket.messages.filter((message) => message.from !== "system").length;
  const status = ticket.status || ticket.erpStatus;
  const description = ticket.description?.trim() || "";
  const tone = statusTone(status);

  return (
    <PageFrame>
      <div className="cove-in mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-mute transition hover:text-ink">
            <IconBack className="size-4" />
            All tickets
          </Link>
          <div data-tour="ticket-actions" className="flex flex-wrap items-center gap-2">
            <span data-tour="ticket-status">
              <StatusPill status={status} tone={tone} />
            </span>
            <Link to={`/tickets/${ticket.id}/chat`} className={primaryBtn}>
              <IconChat className="size-4" />
              {messages ? `Open chat · ${messages}` : "Open chat"}
            </Link>
          </div>
        </div>

        <article className="mt-6 overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface">
          <header className="border-b border-ink/10 px-6 py-6 sm:px-8 sm:py-7">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-mute">Ticket</p>
            <button
              type="button"
              data-tour="ticket-number"
              onClick={() => copyId(ticket.id)}
              className="mt-3 inline-flex items-center rounded-full bg-mist px-3 py-1 font-mono text-xs text-mute transition hover:text-ink"
              title="Copy ticket number"
            >
              {ticket.id}
            </button>
            <h1 className="mt-4 max-w-3xl font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">{ticket.subject}</h1>
            <p className="mt-3 text-sm text-mute">
              {[`Reported ${formatDay(ticket.createdAt)}`, `Updated ${formatDay(ticket.updatedAt)}`].join(" · ")}
            </p>
          </header>

          {uploadWarning ? <p className="border-b border-ink/10 px-6 py-4 text-sm text-ink sm:px-8">{uploadWarning}</p> : null}

          {ticket.attachments?.length ? (
            <section data-tour="ticket-attachments" className="border-b border-ink/10 px-6 py-6 sm:px-8" aria-label="Photos and videos">
              <h2 className="text-sm font-semibold">Photos and videos</h2>
              <div className="mt-4">
                <MediaGrid items={ticket.attachments} />
              </div>
            </section>
          ) : null}

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0">
              <section data-tour="ticket-request" aria-label="Request" className="px-6 py-6 sm:px-8 sm:py-7">
                <h2 className="text-sm font-semibold">Description</h2>
                <p className={`mt-3 max-w-3xl whitespace-pre-wrap text-[15px] leading-7 ${description ? "text-ink" : "text-mute"}`}>
                  {description || "No description was stored with this ticket."}
                </p>
              </section>
            </div>

            <aside className="space-y-8 border-t border-ink/10 bg-mist/70 px-6 py-6 sm:px-8 lg:border-l lg:border-t-0">
              <FactList
                title="Classification"
                facts={[
                  { label: "Type", value: ticket.ticketType },
                  { label: "Category", value: ticket.category },
                  { label: "Sub Category", value: ticket.subCategoryLabel || ticket.subCategory },
                  { label: "Service category", value: ticket.serviceCategory },
                  { label: "Priority", value: ticket.priority, mark: priorityTone(ticket.priority) },
                  { label: "Impact", value: ticket.impact },
                ]}
              />
              <FactList
                title="People"
                facts={[
                  { label: "Contact", value: ticket.contactPerson },
                  { label: "Email", value: ticket.contactEmail, href: mailHref(ticket.contactEmail) },
                  { label: "Phone", value: ticket.contactMobile, href: phoneHref(ticket.contactMobile) },
                ]}
              />
              <FactList
                title="Record"
                facts={[
                  { label: "Status", value: status },
                  { label: "Customer", value: ticket.customer },
                  { label: "Site", value: ticket.customerSite },
                  { label: "Equipment", value: ticket.customerEquipment },
                  { label: "Opened", value: formatStamp(ticket.createdAt) },
                  { label: "Updated", value: formatStamp(ticket.updatedAt) },
                ]}
              />
            </aside>
          </div>
        </article>
      </div>
    </PageFrame>
  );
}

function FactList({ title, facts }) {
  const rows = facts.filter((fact) => fact.value?.trim());
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-4 space-y-4">
        {rows.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-mute">{fact.label}</dt>
            <dd className="mt-1 text-sm font-medium">
              {fact.mark ? <Mark tone={fact.mark}>{fact.value}</Mark> : <FactValue fact={fact} />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FactValue({ fact }) {
  const className = "break-words font-medium";
  if (!fact.href) return <span className={className}>{fact.value}</span>;
  return (
    <a href={fact.href} className={`${className} underline-offset-2 hover:underline`}>
      {fact.value}
    </a>
  );
}

function Mark({ tone, children }) {
  const dot = tone === "high" ? "bg-amber" : tone === "low" ? "bg-ink/25" : "bg-cyan";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function StatusPill({ status, tone }) {
  if (!status?.trim()) return null;
  const dot = tone === "closed" ? "bg-ink/30" : tone === "wait" ? "bg-amber" : "bg-cyan";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-2 text-sm font-medium">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}

function statusTone(status) {
  const value = (status || "").toLowerCase();
  if (/(closed|resolved|cancelled|canceled)/.test(value)) return "closed";
  if (/(wait|hold|pending)/.test(value)) return "wait";
  return "open";
}

function priorityTone(priority) {
  const value = (priority || "").toLowerCase();
  if (!value) return "";
  if (/(critical|high|urgent)/.test(value)) return "high";
  if (value === "low") return "low";
  return "mid";
}

function formatStamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function mailHref(value) {
  const email = value?.trim();
  return email && email.includes("@") ? `mailto:${email}` : "";
}

function phoneHref(value) {
  const phone = value?.trim();
  return phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
}

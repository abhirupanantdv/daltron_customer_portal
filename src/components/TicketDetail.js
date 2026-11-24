import { Link, useParams } from "react-router-dom";
import { useTickets } from "@/components/TicketsProvider";
import { IconBack, IconChat, MissingTicket, PageFrame, PageSkeleton, formatDay, primaryBtn } from "@/components/ui";

export default function TicketDetail() {
  const { id } = useParams();
  const { tickets, hydrated, copyId } = useTickets();
  const ticket = tickets.find((item) => item.id === id) ?? null;

  if (!ticket && !hydrated) return <PageSkeleton />;
  if (!ticket) return <MissingTicket />;

  const messages = ticket.messages.filter((message) => message.from !== "system").length;
  const status = ticket.status || ticket.erpStatus;
  const description = ticket.description?.trim() || "";
  const complaint = ticket.customerComplaint?.trim() || "";
  const showComplaint = Boolean(complaint && complaint !== description);
  const tone = statusTone(status);

  return (
    <PageFrame>
      <div className="cove-in mx-auto w-full max-w-6xl">
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

        <button
          type="button"
          data-tour="ticket-number"
          onClick={() => copyId(ticket.id)}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 font-mono text-xs text-mute transition hover:text-ink"
          title="Copy ticket number"
        >
          {ticket.id}
        </button>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{ticket.subject}</h1>
        <p className="mt-3 text-sm text-mute">
          {[`Reported ${formatDay(ticket.createdAt)}`, `Updated ${formatDay(ticket.updatedAt)}`].join(" · ")}
        </p>

        <div className="mt-8 lg:mt-10 lg:border-b lg:border-ink/10">
          <section data-tour="ticket-request" className="grid gap-4 lg:gap-0" aria-label="Request">
            <Narrative title="Description" body={description} empty="No description was stored with this ticket." />
            {showComplaint ? <Narrative title="Customer complaint" body={complaint} quiet /> : null}
            <Attachments files={ticket.attachments} />
          </section>

          <aside className="mt-4 grid gap-4 lg:mt-0 lg:gap-0">
            <Panel
              title="Classification"
              columns={2}
              facts={[
                { label: "Type", value: ticket.ticketType },
                { label: "Category", value: ticket.serviceCategory },
                { label: "Priority", value: ticket.priority, mark: priorityTone(ticket.priority) },
                { label: "Impact", value: ticket.impact },
                { label: "Urgency", value: ticket.urgency },
                { label: "Source", value: ticket.source },
              ]}
            />
            <Panel
              title="Record"
              facts={[
                { label: "Status", value: status },
                { label: "Reported by", value: ticket.reportedBy },
                { label: "Opened", value: formatStamp(ticket.createdAt) },
                { label: "Updated", value: formatStamp(ticket.updatedAt) },
              ]}
            />
          </aside>
        </div>
      </div>
    </PageFrame>
  );
}

function Attachments({ files }) {
  if (!files?.length) return null;
  return (
    <div data-tour="ticket-attachments" className="rounded-3xl border border-ink/10 bg-surface/70 px-6 py-6 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-8 lg:border-t">
      <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-mute lg:text-sm lg:font-semibold lg:normal-case lg:tracking-normal lg:text-ink">Attachments</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <li key={file.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
            {file.kind === "video" ? (
              <video src={file.url} controls preload="metadata" className="aspect-video w-full bg-ink" />
            ) : (
              <a href={file.url} target="_blank" rel="noreferrer">
                <img src={file.url} alt={file.name} className="aspect-video w-full object-cover" />
              </a>
            )}
            <p className="truncate px-3 py-2 text-xs text-mute">{file.name}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Narrative({ title, body, empty, quiet }) {
  return (
    <div
      className={`h-full rounded-3xl px-6 py-6 lg:h-auto lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-8 lg:border-t lg:border-ink/10 ${
        quiet ? "border border-ink/10 bg-surface/70" : "bg-mist"
      }`}
    >
      <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-mute lg:text-sm lg:font-semibold lg:normal-case lg:tracking-normal lg:text-ink">{title}</h2>
      <p className={`mt-3 max-w-3xl whitespace-pre-wrap text-[15px] leading-7 ${body ? "text-ink" : "text-mute"}`}>{body || empty}</p>
    </div>
  );
}

function Panel({ title, facts, columns = 1 }) {
  const rows = facts.filter((fact) => fact.value?.trim());
  if (!rows.length) return null;
  const wideCols = rows.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <section className="h-full rounded-3xl border border-ink/10 bg-surface/70 px-5 py-5 lg:h-auto lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-8 lg:border-t">
      <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-mute lg:text-sm lg:font-semibold lg:normal-case lg:tracking-normal lg:text-ink">{title}</h2>
      <dl className={`mt-4 grid gap-x-4 gap-y-4 lg:mt-5 lg:gap-x-10 lg:gap-y-6 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"} ${wideCols}`}>
        {rows.map((fact) => (
          <div key={fact.label} className={columns === 2 && (fact.href || fact.mono) ? "col-span-2 lg:col-span-1" : ""}>
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
  const className = fact.mono ? "break-all font-mono text-[13px] font-medium" : "break-words font-medium";
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

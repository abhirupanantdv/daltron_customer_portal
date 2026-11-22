import { Link, useParams } from "react-router-dom";
import { STEPS, formatWhen } from "@/lib/tickets";
import { useTickets } from "@/components/TicketsProvider";
import { IconBack, IconChat, MissingTicket, PageFrame, PageSkeleton, StatusRail, formatDay, ghostBtn, primaryBtn } from "@/components/ui";

export default function TicketDetail() {
  const { id } = useParams();
  const { tickets, hydrated, now, resolveTicket, copyId } = useTickets();
  const ticket = tickets.find((item) => item.id === id) ?? null;

  if (!ticket && !hydrated) return <PageSkeleton />;
  if (!ticket) return <MissingTicket />;

  const step = STEPS.find((item) => item.id === ticket.status) ?? STEPS[0];
  const messages = ticket.messages.filter((message) => message.from !== "system").length;

  return (
    <PageFrame>
      <div className="cove-in">
        <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-mute transition hover:text-ink">
          <IconBack className="size-4" />
          All tickets
        </Link>

        <button type="button" data-tour="ticket-number" onClick={() => copyId(ticket.id)} className="mt-6 block font-mono text-xs text-mute transition hover:text-ink" title="Copy ticket number">
          {ticket.id}
        </button>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{ticket.subject}</h1>
        <p className="mt-3 text-sm text-mute">
          {[ticket.project, ticket.category, `${ticket.priority} priority`, `Updated ${formatWhen(ticket.updatedAt, now)}`].filter(Boolean).join(" · ")}
        </p>

        <section data-tour="ticket-status" className="mt-8 border-y border-ink/10 py-6" aria-label="Status">
          <StatusRail status={ticket.status} />
          <p className="mt-4 text-sm leading-6 text-mute">{step.note}</p>
        </section>

        <section data-tour="ticket-request" className="border-b border-ink/10 py-8">
          <h2 className="text-sm font-medium">Your request</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{ticket.description}</p>
        </section>

        {ticket.steps?.trim() ? (
          <section className="border-b border-ink/10 py-8">
            <h2 className="text-sm font-medium">Steps</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{ticket.steps}</p>
          </section>
        ) : null}

        <Attachments files={ticket.attachments ?? []} />

        <dl className="border-b border-ink/10">
          <Fact label="Number" value={ticket.id} />
          <Fact label="Project" value={ticket.project || "Not set"} />
          {ticket.location?.trim() ? <Fact label="Where it happens" value={ticket.location} /> : null}
          <Fact label="Category" value={ticket.category} />
          <Fact label="Priority" value={ticket.priority} />
          <Fact label="Opened" value={formatDay(ticket.createdAt)} />
          <Fact label="Updated" value={formatWhen(ticket.updatedAt, now)} />
        </dl>

        <div data-tour="ticket-actions" className="mt-8 flex flex-wrap items-center gap-3">
          {ticket.status !== "resolved" ? (
            <button type="button" onClick={() => resolveTicket(ticket.id)} className={ghostBtn}>
              Mark resolved
            </button>
          ) : (
            <p className="text-sm text-mute">Resolved. Send a message in the chat if it comes back.</p>
          )}
          <Link to={`/tickets/${ticket.id}/chat`} className={primaryBtn}>
            <IconChat className="size-4" />
            {messages ? `Open chat · ${messages}` : "Open chat"}
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}

function Attachments({ files }) {
  if (!files.length) return null;
  return (
    <section className="border-b border-ink/10 py-8">
      <h2 className="text-sm font-medium">Screenshots and video</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {files.map((file) => (
          <li key={file.id} className="overflow-hidden rounded-xl border border-ink/10">
            {file.kind === "video" ? (
              <video src={file.url} controls className="aspect-video w-full bg-black" />
            ) : (
              <img src={file.url} alt={file.name} className="aspect-video w-full object-cover" />
            )}
            <p className="truncate px-3 py-2 text-xs text-mute">{file.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink/10 py-3.5 text-sm last:border-b-0">
      <dt className="text-mute">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

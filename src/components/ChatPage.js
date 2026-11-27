import { Link, useParams } from "react-router-dom";
import EmailThread from "@/components/EmailThread";
import { useTickets } from "@/components/TicketsProvider";
import { IconBack, MissingTicket, PageSkeleton, TicketStatus, pagePad } from "@/components/ui";
import { formatWhen } from "@/lib/tickets";

export default function ChatPage() {
  const { id } = useParams();
  const { tickets, hydrated, now, sendMessage } = useTickets();
  const ticket = tickets.find((item) => item.id === id) ?? null;

  if (!ticket && !hydrated) return <PageSkeleton />;
  if (!ticket) return <MissingTicket />;

  const status = ticket.status || ticket.erpStatus;

  return (
    <div className="cove-in flex h-full min-h-0 flex-col bg-transparent">
      <div className={`${pagePad} shrink-0 border-b border-ink/10 pb-4 pt-20`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={`/tickets/${ticket.id}`} data-tour="chat-back" className="inline-flex items-center gap-1.5 text-sm text-mute transition hover:text-ink">
            <IconBack className="size-4" />
            Ticket status
          </Link>
          <p className="font-mono text-xs text-mute">{ticket.id}</p>
        </div>
        <h1 className="mt-3 font-display text-2xl leading-tight tracking-tight text-balance sm:text-3xl">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-mute">
          {[ticket.serviceCategory, ticket.priority, status, `Updated ${formatWhen(ticket.updatedAt, now)}`].filter(Boolean).join(" · ")}
        </p>
        <div data-tour="chat-status" className="mt-5">
          <TicketStatus status={status} />
        </div>
      </div>
      <EmailThread ticket={ticket} now={now} onSend={sendMessage} variant="page" logTour="chat-log" composeTour="chat-compose" />
    </div>
  );
}

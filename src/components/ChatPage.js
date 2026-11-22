import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { STEPS, formatClock, formatWhen } from "@/lib/tickets";
import { useTickets } from "@/components/TicketsProvider";
import { IconBack, IconSend, MissingTicket, PageSkeleton, StatusRail, fieldClass, pagePad } from "@/components/ui";

export default function ChatPage() {
  const { id } = useParams();
  const { tickets, hydrated, now, typingId, sendMessage } = useTickets();
  const ticket = tickets.find((item) => item.id === id) ?? null;

  if (!ticket && !hydrated) return <PageSkeleton />;
  if (!ticket) return <MissingTicket />;

  const step = STEPS.find((item) => item.id === ticket.status) ?? STEPS[0];

  return (
    <div className="cove-in flex h-full min-h-0 flex-col bg-transparent">
      <div className={`${pagePad} shrink-0 border-b border-ink/10 py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={`/tickets/${ticket.id}`} data-tour="chat-back" className="inline-flex items-center gap-1.5 text-sm text-mute transition hover:text-ink">
            <IconBack className="size-4" />
            Ticket status
          </Link>
          <p className="font-mono text-[11px] text-mute">{ticket.id}</p>
        </div>
        <h1 className="mt-3 font-display text-2xl leading-tight tracking-tight text-balance sm:text-3xl">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-mute">
          {[ticket.project, ticket.category, `${ticket.priority} priority`, step.label, `Updated ${formatWhen(ticket.updatedAt, now)}`].filter(Boolean).join(" · ")}
        </p>
        <div data-tour="chat-status" className="mt-5">
          <StatusRail status={ticket.status} />
        </div>
      </div>
      <Conversation ticket={ticket} now={now} typing={typingId === ticket.id} onSend={sendMessage} />
    </div>
  );
}

function Conversation({ ticket, now, typing, onSend }) {
  const [draft, setDraft] = useState("");
  const boxRef = useRef(null);
  const endRef = useRef(null);
  const logRef = useRef(null);
  const opened = useRef(false);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const overflow = log.scrollHeight - log.clientHeight;
    if (overflow <= 24) {
      log.scrollTop = 0;
    } else {
      endRef.current?.scrollIntoView({ behavior: opened.current ? "smooth" : "auto", block: "end" });
    }
    opened.current = true;
  }, [ticket.messages.length, typing]);

  useEffect(() => {
    if (boxRef.current && draft === "") boxRef.current.style.height = "auto";
  }, [draft]);

  function resize(event) {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(ticket.id, text);
    setDraft("");
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={logRef} data-tour="chat-log" role="log" aria-label="Conversation" className={`${pagePad} min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-5`}>
        {ticket.messages.map((message) => (
          <Message key={message.id} message={message} now={now} />
        ))}
        {typing ? (
          <div className="flex items-end gap-2">
            <Avatar />
            <div className="rounded-2xl rounded-bl-md bg-mist px-4 py-3" aria-label="Alex is typing">
              <span className="flex gap-1">
                {[0, 140, 280].map((delay) => (
                  <span key={delay} className="size-1.5 animate-bounce rounded-full bg-ink/45 motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      {ticket.status === "waiting" ? (
        <p className={`${pagePad} shrink-0 border-t border-ink/10 bg-mist py-2.5 text-sm text-ink`}>Support is waiting on your reply.</p>
      ) : null}
      <form data-tour="chat-compose" onSubmit={submit} className={`${pagePad} shrink-0 border-t border-ink/10 py-3`}>
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="reply">
            Message about {ticket.subject}
          </label>
          <textarea
            id="reply"
            ref={boxRef}
            rows={1}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              resize(event);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={ticket.status === "resolved" ? "Send a message to reopen…" : "Write a message…"}
            className={`${fieldClass} max-h-32 resize-none bg-mist`}
          />
          <button
            type="submit"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-paper transition hover:bg-ink-soft disabled:opacity-40"
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <IconSend className="size-5" />
          </button>
        </div>
        <p className="mt-2 hidden text-[11px] text-mute md:block">Enter to send · Shift+Enter for a new line</p>
      </form>
    </section>
  );
}

function Message({ message, now }) {
  if (message.from === "system") {
    return <p className="py-1 text-center text-xs text-mute">{message.text}</p>;
  }
  const mine = message.from === "you";
  return (
    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      {mine ? null : <Avatar />}
      <div className={`flex max-w-[min(40rem,85%)] flex-col ${mine ? "items-end" : "items-start"}`}>
        <span className="mb-1 px-1 text-[11px] text-mute">
          {mine ? "You" : "Alex"} · {formatClock(message.at, now)}
        </span>
        <p className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md bg-mist text-ink"}`}>
          {message.text}
        </p>
      </div>
    </div>
  );
}

function Avatar() {
  return <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-medium text-paper">A</span>;
}

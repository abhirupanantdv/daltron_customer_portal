import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/tickets";
import { IconSend, fieldClass, pagePad } from "@/components/ui";

export default function EmailThread({ ticket, now, onSend, variant = "embedded", logTour, composeTour }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = 0;
  }, [ticket.messages.length]);

  useEffect(() => {
    if (boxRef.current && draft === "") boxRef.current.style.height = "auto";
  }, [draft]);

  function resize(event) {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      await onSend(ticket.id, text);
      setDraft("");
    } catch (err) {
      setError(err?.message || "Could not send the reply.");
    } finally {
      setSending(false);
    }
  }

  const messages = ticket.messages
    .filter((message) => message.from !== "system" && message.text?.trim())
    .slice()
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const page = variant === "page";

  return (
    <div className={page ? "flex min-h-0 min-w-0 flex-1 flex-col" : ""}>
      <div
        ref={logRef}
        data-tour={logTour || undefined}
        role="log"
        aria-label="Conversation"
        className={page ? `${pagePad} thread-log flex min-h-0 flex-1 flex-col gap-3 py-5` : "thread-log flex max-h-[min(28rem,60vh)] flex-col gap-3"}
      >
        {messages.length ? (
          messages.map((message) => <ThreadMessage key={message.id} message={message} now={now} />)
        ) : (
          <p className="text-sm text-mute">No replies yet.</p>
        )}
      </div>
      <form
        data-tour={composeTour || undefined}
        onSubmit={submit}
        className={page ? `${pagePad} shrink-0 border-t border-ink/10 py-3` : "mt-5 border-t border-ink/10 pt-4"}
      >
        <label className="sr-only" htmlFor={`reply-${ticket.id}`}>
          Reply about {ticket.subject}
        </label>
        <textarea
          id={`reply-${ticket.id}`}
          ref={boxRef}
          rows={3}
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
          placeholder="Write a reply…"
          className={`${fieldClass} max-h-32 resize-none bg-mist`}
          disabled={sending}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className={`text-xs ${error ? "text-ink" : "text-mute"}`}>{error || "Enter to send · Shift+Enter for a new line"}</p>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:opacity-40"
            disabled={sending || !draft.trim()}
          >
            <IconSend className="size-4" />
            {sending ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ThreadMessage({ message, now }) {
  const mine = message.from === "you";
  const agent = !mine && message.author?.trim() ? message.author.trim() : "";
  return (
    <article className={`rounded-2xl px-4 py-3.5 ${mine ? "bg-cyan/15" : "bg-amber/20"}`}>
      <p className="text-xs text-mute">
        <span className="font-medium text-ink">{mine ? "You" : "Service management"}</span>
        {agent ? ` · ${agent}` : ""}
        {" · "}
        {formatClock(message.at, now)}
      </p>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-ink">{message.text}</p>
    </article>
  );
}

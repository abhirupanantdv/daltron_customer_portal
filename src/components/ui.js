import { Link } from "react-router-dom";
import { STEPS } from "@/lib/tickets";

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
export const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/[0.04] active:scale-[0.98]";
export const fieldClass =
  "w-full rounded-xl border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-ink/10";

export const FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["waiting", "Waiting"],
  ["resolved", "Resolved"],
];

export const pagePad = "px-6 sm:px-10 lg:px-20";

export function PageFrame({ children }) {
  return <div className={`flex w-full flex-col ${pagePad} py-8 lg:py-10`}>{children}</div>;
}

export function PageSkeleton() {
  return (
    <PageFrame>
      <div className="h-4 w-28 rounded-full bg-ink/10" />
      <div className="mt-4 h-10 w-80 max-w-full rounded-xl bg-ink/10" />
      <div className="mt-8 h-px w-full bg-ink/10" />
      <div className="mt-6 h-16 w-full bg-ink/[0.04]" />
      <div className="mt-3 h-16 w-full bg-ink/[0.04]" />
    </PageFrame>
  );
}

export function MissingTicket() {
  return (
    <PageFrame>
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-mute">Ticket</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-balance">This ticket isn&apos;t on your desk.</h1>
        <p className="mt-3 text-sm leading-6 text-mute">The number may be wrong, or the sample tickets were restored.</p>
        <Link to="/tickets" className={`${primaryBtn} mt-6`}>
          Back to tickets
        </Link>
      </div>
    </PageFrame>
  );
}

export function StatusRail({ status }) {
  const index = Math.max(0, STEPS.findIndex((step) => step.id === status));
  const progress = index / (STEPS.length - 1);
  return (
    <div className="relative">
      <span className="absolute left-[12.5%] right-[12.5%] top-[7px] h-px bg-ink/15" aria-hidden="true" />
      <span
        className="absolute left-[12.5%] top-[7px] h-px bg-ink transition-all duration-500"
        style={{ width: `calc(75% * ${progress})` }}
        aria-hidden="true"
      />
      <ol aria-label="Ticket status" className="relative grid grid-cols-4">
        {STEPS.map((step, i) => {
          const state = i < index ? "done" : i === index ? "current" : "todo";
          return (
            <li key={step.id} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center">
              <span
                className={`relative z-10 size-3.5 rounded-full transition ${
                  state === "todo" ? "border-2 border-ink/25 bg-paper" : "bg-ink"
                } ${state === "current" ? "ring-4 ring-ink/15" : ""}`}
              />
              <span className={`mt-1.5 px-1 text-center text-[11px] leading-4 ${state === "todo" ? "text-mute" : "font-medium text-ink"}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function formatDay(iso) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function IconPlus({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSend({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 12 20 4l-6.5 16-2.2-6.3L4 12Z" strokeLinejoin="round" />
      <path d="m11.3 13.7 8.7-9.7" />
    </svg>
  );
}

export function IconBack({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconOverview({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconTickets({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 7.5h14M5 12h14M5 16.5h9" strokeLinecap="round" />
    </svg>
  );
}

export function IconHome({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChat({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 17.5 4.5 20V8.8A5.3 5.3 0 0 1 9.8 3.5h4.4A5.3 5.3 0 0 1 19.5 8.8v3.4a5.3 5.3 0 0 1-5.3 5.3H7Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMail({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPhone({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8.2 4.8h2.1l1.1 2.8-1.5 1a11.2 11.2 0 0 0 5.5 5.5l1-1.5 2.8 1.1v2.1a1.4 1.4 0 0 1-1.5 1.4A13.2 13.2 0 0 1 6.8 6.3a1.4 1.4 0 0 1 1.4-1.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5.5 19.2c1.2-2.6 3.5-3.9 6.5-3.9s5.3 1.3 6.5 3.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconTour({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 16.2v.2M12 8.2V13" strokeLinecap="round" />
    </svg>
  );
}

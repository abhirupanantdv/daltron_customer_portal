import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CHANNELS, byUpdated, matchesFilter } from "@/lib/tickets";
import { useNavSearch } from "@/components/AppShell";
import { useTickets } from "@/components/TicketsProvider";
// import HomeFaq from "@/components/HomeFaq";
import { IconChat, IconMail, IconPhone, IconPlus, IconSearch, IconTickets, ghostBtn, pagePad } from "@/components/ui";

const supportPrimaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#087E83] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#06686c] active:scale-[0.98]";

const CHANNEL_ICONS = {
  chat: IconChat,
  email: IconMail,
  call: IconPhone,
};

const REACH = [
  { icon: IconMail, label: "Email", value: "support@anantdv.com", href: "mailto:support@anantdv.com" },
  { icon: IconTickets, label: "Tickets", value: "View your requests", href: "/tickets" },
  { icon: IconPlus, label: "New request", value: "Open a ticket", href: "/tickets/new" },
];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 18 * 60;

function deskStatus(date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const weekday = day >= 1 && day <= 5;
  const open = weekday && minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;
  let next = "Opens Monday at 9:00 IST";
  if (open) next = "Closes at 18:00 IST";
  else if (weekday && minutes < OPEN_MINUTES) next = "Opens today at 9:00 IST";
  else if (day >= 1 && day <= 4) next = "Opens tomorrow at 9:00 IST";
  return { open, next };
}

export default function Overview() {
  const { tickets } = useTickets();
  const { query, revealSearch, applyQuery } = useNavSearch();
  const [channel, setChannel] = useState("chat");
  const [now, setNow] = useState(() => new Date());
  const latest = [...tickets].sort(byUpdated)[0];
  const chatHref = latest ? `/tickets/${latest.id}/chat` : "/tickets/new";
  const desk = deskStatus(now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function onSearch(event) {
    event.preventDefault();
  }

  const q = query.trim();
  const matches = q ? tickets.filter((ticket) => matchesFilter(ticket, "all", q)) : [];

  return (
    <div className="support-page min-h-full">
      <section className="relative z-30 flex min-h-[22rem] w-full items-center justify-center sm:min-h-[26rem] lg:min-h-[30rem]">
        <img src={`${import.meta.env.BASE_URL}hero-support.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,31,43,0.62),rgba(9,31,43,0.28)_58%,rgba(9,31,43,0.5))]" />
        <div className={`relative z-10 w-full ${pagePad} py-16 text-center text-white`}>
          <h1 className="font-display text-4xl tracking-tight text-balance sm:text-5xl lg:text-6xl">Welcome to AnantDV Support</h1>
          <form data-tour="home-search" data-search-anchor onSubmit={onSearch} className="mx-auto mt-8 flex w-full max-w-xl items-center rounded-full bg-white px-4 text-[#102A38] shadow-[0_16px_40px_rgba(7,31,43,0.28)]" role="search">
            <IconSearch className="size-4 shrink-0 text-[#607787]" />
            <label className="sr-only" htmlFor="support-search">
              Search support
            </label>
            <input
              id="support-search"
              value={query}
              onFocus={revealSearch}
              onChange={(event) => applyQuery(event.target.value)}
              placeholder="Type your query"
              className="h-12 w-full bg-transparent px-3 text-sm text-[#102A38] outline-none placeholder:text-[#607787]"
            />
            <button type="submit" className="sr-only">
              Search
            </button>
          </form>
          {q ? (
            <div className="relative z-50 mx-auto mt-3 w-full max-w-xl overflow-hidden rounded-2xl bg-white text-left text-[#102A38] shadow-[0_16px_40px_rgba(7,31,43,0.28)]" role="listbox" aria-label="Matching tickets">
              {matches.length ? (
                <ul className="max-h-80 overflow-y-auto">
                  {matches.map((ticket) => (
                    <li key={ticket.id} className="border-b border-[#102A38]/10 last:border-b-0">
                      <Link to={`/tickets/${ticket.id}`} className="block px-4 py-3 transition hover:bg-[#F1F6F6]">
                        <span className="font-mono text-xs text-[#607787]">{ticket.id}</span>
                        <span className="mt-0.5 block truncate text-sm font-medium">{ticket.subject}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#607787]">
                          {[ticket.status || ticket.erpStatus, ticket.serviceCategory, ticket.priority].filter(Boolean).join(" · ") || "Open ticket"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-[#607787]">No tickets match.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="support-info-heading" className="w-full bg-[#F1F6F6]">
        <div className={`${pagePad} py-14 sm:py-16`}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <h2 id="support-info-heading" className="font-display text-4xl tracking-tight sm:text-5xl">
                Support information
              </h2>
              <p className="mt-3 text-sm leading-6 text-mute">
                Availability, hours, and how to reach the desk. The times here are the ones we keep.
              </p>
            </div>
            <p data-tour="desk-status" className="inline-flex items-center gap-2 text-sm" role="status">
              <span className={`size-2 shrink-0 rounded-full ${desk.open ? "bg-[#087E83]" : "bg-ink/25"}`} aria-hidden="true" />
              <span className="font-medium">{desk.open ? "Open now" : "Closed now"}</span>
              <span className="text-mute">{desk.next}</span>
            </p>
          </div>

          <dl className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6">
              <dt className="text-sm font-semibold">Operating hours</dt>
              <dd className="mt-3 text-sm leading-6 text-mute">
                Monday–Friday
                <br />
                9:00–18:00 IST
                <br />
                Closed Saturday and Sunday
              </dd>
            </div>
            <div className="rounded-2xl bg-white p-6">
              <dt className="text-sm font-semibold">Contact</dt>
              <dd className="mt-3 space-y-2 text-sm">
                <a href="mailto:support@anantdv.com" className="block font-medium hover:underline">
                  support@anantdv.com
                </a>
                <Link to={chatHref} className="block text-mute hover:text-ink">
                  Chat with the desk
                </Link>
                <Link to="/tickets/new" className="block text-mute hover:text-ink">
                  Open a ticket or request a callback
                </Link>
              </dd>
            </div>
            <div className="rounded-2xl bg-white p-6">
              <dt className="text-sm font-semibold">Expected response</dt>
              <dd className="mt-3 text-sm leading-6 text-mute">
                Chat, email, and tickets are answered during desk hours. Messages sent after 18:00 IST, or on the weekend, are picked up the next weekday morning. Callbacks are placed only between 9:00 and 18:00 IST on weekdays.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* <HomeFaq /> */}

      <section className="w-full bg-[#EAF1F2]">
        <div className={`${pagePad} py-14 sm:py-16`}>
          <h2 className="text-center font-display text-4xl tracking-tight sm:text-5xl">Connect with us</h2>
          <div data-tour="channels" className="mt-8 flex items-end justify-center gap-6 border-b border-ink/10 sm:gap-10" role="tablist" aria-label="Contact options">
            {CHANNELS.map((item) => {
              const on = channel === item.id;
              const Icon = CHANNEL_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setChannel(item.id)}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition ${
                    on ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-8 flex min-h-40 max-w-xl flex-col items-center text-center" role="tabpanel">
            {channel === "chat" ? (
              <>
                <p className="text-sm leading-6 text-mute">
                  {latest
                    ? "Continue the latest conversation, or open a ticket if this is something new."
                    : "Start a conversation. It stays with the ticket, and you can leave it closed until you want it."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Link to={chatHref} className={supportPrimaryBtn}>
                    <IconChat className="size-4" />
                    {latest ? "Open chat" : "Start chat"}
                  </Link>
                  <Link to="/tickets" className={ghostBtn}>
                    <IconTickets className="size-4" />
                    Your tickets
                  </Link>
                </div>
              </>
            ) : null}
            {channel === "email" ? (
              <>
                <p className="text-sm leading-6 text-mute">Write the desk directly. Mention the ticket number if you already have one.</p>
                <a href="mailto:support@anantdv.com" className={`${supportPrimaryBtn} mt-5`}>
                  <IconMail className="size-4" />
                  support@anantdv.com
                </a>
              </>
            ) : null}
            {channel === "call" ? (
              <>
                <p className="text-sm leading-6 text-mute">The desk takes callbacks on weekdays, 9:00–18:00 IST. Leave a ticket and we will call you back.</p>
                <Link to="/tickets/new" className={`${supportPrimaryBtn} mt-5`}>
                  <IconPhone className="size-4" />
                  Request a callback
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="w-full bg-white">
        <div className={`${pagePad} pt-12 pb-28 sm:pt-14 sm:pb-32`}>
          <h2 className="text-sm font-semibold">Reach the desk</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {REACH.map((item) => {
              const Icon = item.icon;
              const className = "flex h-full items-center justify-between gap-6 rounded-2xl bg-white px-5 py-4 text-sm ring-1 ring-[#102A38]/10 transition hover:ring-[#087E83]/40";
              const body = (
                <>
                  <span className="inline-flex items-center gap-3 text-mute">
                    <Icon className="size-4 text-ink" />
                    {item.label}
                  </span>
                  <span className="text-right font-medium">{item.value}</span>
                </>
              );
              return (
                <li key={item.label}>
                  {item.href.startsWith("mailto:") ? (
                    <a href={item.href} className={className}>
                      {body}
                    </a>
                  ) : (
                    <Link to={item.href} className={className}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <Link
        to={chatHref}
        data-tour="chat-fab"
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-[#087E83] text-white shadow-[0_12px_30px_rgba(8,126,131,0.35)] ring-4 ring-white/70"
        aria-label="Chat with us"
        title="Chat with us"
      >
        <IconChat className="size-6" />
      </Link>
    </div>
  );
}

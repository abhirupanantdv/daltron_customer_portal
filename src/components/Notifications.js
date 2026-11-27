import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotifications, markNotificationRead } from "@/lib/erpClient";
import { formatWhen } from "@/lib/tickets";

export default function Notifications() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const body = await fetchNotifications();
        if (cancelled) return;
        setItems(Array.isArray(body.notifications) ? body.notifications : []);
        setUnread(Number(body.unread) || 0);
        setNow(Date.now());
      } catch {
        if (!cancelled) {
          setItems([]);
          setUnread(0);
        }
      }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
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

  async function openItem(item) {
    setOpen(false);
    if (!item.read) {
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
      setUnread((count) => Math.max(0, count - 1));
      try {
        await markNotificationRead(item.id);
      } catch {
        /* The ticket still opens if marking it read fails. */
      }
    }
    if (item.ticket) navigate(`/tickets/${item.ticket}`);
  }

  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-full text-white outline-none transition hover:bg-white/10 focus-visible:bg-white/10"
      >
        <BellIcon className="size-4" />
        {unread ? (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-paper px-1 text-[10px] font-semibold leading-4 text-brand">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-11 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-2 text-ink shadow-[0_18px_50px_rgba(9,31,43,0.18)] ring-1 ring-ink/10 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <p className="px-2 py-1.5 text-sm font-medium">Notifications</p>
          <div className="thread-log max-h-80">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(item)}
                  className={`block w-full rounded-xl px-2 py-2.5 text-left transition hover:bg-ink/[0.04] ${item.read ? "" : "bg-ink/[0.03]"}`}
                >
                  <span className="block text-sm font-medium">{item.title}</span>
                  {item.text ? <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-mute">{item.text}</span> : null}
                  <span className="mt-1 block text-xs text-mute">{[item.ticket, formatWhen(item.at, now)].filter(Boolean).join(" · ")}</span>
                </button>
              ))
            ) : (
              <p className="px-2 py-4 text-sm text-mute">No notifications yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 16.5h12l-1.2-2.1a6.8 6.8 0 0 1-.8-3.2V10a4 4 0 0 0-8 0v1.2c0 1.1-.3 2.2-.8 3.2L6 16.5Z" strokeLinejoin="round" />
      <path d="M10 16.5a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

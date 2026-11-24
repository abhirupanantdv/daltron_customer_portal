import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";
import TourButton, { startPageTour, usePageTour } from "@/components/ProductTour";
import { IconHome, IconPlus, IconSearch, IconTickets, IconTour, IconUser, pagePad } from "@/components/ui";

const NavSearchContext = createContext(null);

export function useNavSearch() {
  const value = useContext(NavSearchContext);
  if (!value) throw new Error("useNavSearch must be used within AppShell");
  return value;
}

const LINKS = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/tickets", label: "Tickets", icon: IconTickets },
  { href: "/tickets/new", label: "New ticket", icon: IconPlus },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/tickets/new") return pathname === "/tickets/new";
  if (href === "/tickets") {
    return pathname === "/tickets" || (pathname.startsWith("/tickets/") && !pathname.startsWith("/tickets/new"));
  }
  return pathname === href;
}

function measurePill(nav, target) {
  const navBox = nav.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  return {
    x: box.left - navBox.left + nav.scrollLeft,
    y: box.top - navBox.top,
    width: box.width,
    height: box.height,
  };
}

function NavLinks({ pathname }) {
  const navRef = useRef(null);
  const [pill, setPill] = useState(null);
  const [ready, setReady] = useState(false);
  const [hot, setHot] = useState(null);

  function moveTo(target) {
    const nav = navRef.current;
    if (!nav || !target) return;
    setPill(measurePill(nav, target));
  }

  useLayoutEffect(() => {
    setHot(null);
    const nav = navRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (active) setPill(measurePill(nav, active));
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const observer = new ResizeObserver(() => {
      const current = hot ? nav.querySelector(`[data-href="${hot}"]`) : nav.querySelector('[aria-current="page"]');
      if (current) setPill(measurePill(nav, current));
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [hot, pathname]);

  return (
    <nav
      ref={navRef}
      data-tour="nav"
      className="relative flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden"
      aria-label="Support"
      onMouseLeave={() => {
        setHot(null);
        const active = navRef.current?.querySelector('[aria-current="page"]');
        if (active) moveTo(active);
      }}
    >
      <span
        aria-hidden="true"
        className={`nav-pill pointer-events-none absolute left-0 top-0 rounded-full ${ready ? "nav-pill-ready" : ""}`}
        style={
          pill
            ? { transform: `translate3d(${pill.x}px, ${pill.y}px, 0)`, width: pill.width, height: pill.height }
            : { opacity: 0 }
        }
      />
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        const lit = active || hot === link.href;
        return (
          <Link
            key={link.href}
            to={link.href}
            data-href={link.href}
            aria-label={link.label}
            aria-current={active ? "page" : undefined}
            onMouseEnter={(event) => {
              setHot(link.href);
              moveTo(event.currentTarget);
            }}
            onFocus={(event) => {
              setHot(link.href);
              moveTo(event.currentTarget);
            }}
            onBlur={() => {
              setHot(null);
              const activeLink = navRef.current?.querySelector('[aria-current="page"]');
              if (activeLink) moveTo(activeLink);
            }}
            className={`relative z-[1] inline-flex shrink-0 items-center gap-2 rounded-full px-1.5 py-2 text-sm font-medium outline-none transition-colors duration-200 sm:px-3 ${
              lit ? "text-white" : "text-white/70"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const ref = useRef(null);
  const name = user?.fullName || "Account";
  const detail = user?.user && user.user !== name ? user.user : "";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    function onTourOpen() {
      setOpen(false);
    }
    window.addEventListener("anant-tour-open", onTourOpen);
    return () => window.removeEventListener("anant-tour-open", onTourOpen);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account"
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 place-items-center rounded-full text-white outline-none transition hover:bg-white/10 focus-visible:bg-white/10"
      >
        <IconUser className="size-4" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-11 w-56 rounded-2xl bg-surface p-4 text-ink shadow-[0_18px_50px_rgba(9,31,43,0.18)] ring-1 ring-ink/10 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <p className="text-sm font-medium">{name}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-mute">{detail}</p> : null}
          <Link to="/tickets" role="menuitem" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink">
            <IconTickets className="size-4" />
            Your tickets
          </Link>
          <button
            type="button"
            role="menuitem"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink"
            onClick={() => {
              setOpen(false);
              startPageTour(pathname);
            }}
          >
            <IconTour className="size-4" />
            Replay tutorial
          </button>
          <button type="button" role="menuitem" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink" onClick={() => logout()}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" strokeLinecap="round" />
              <path d="M4 12h10M11 8.5 14.5 12 11 15.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NavSearchBar({ inputRef, query, onQuery, onClose }) {
  function onSubmit(event) {
    event.preventDefault();
    onQuery(query);
  }

  return (
    <form onSubmit={onSubmit} data-search-root className="flex w-full items-center gap-2" role="search">
      <div className="flex h-10 min-w-0 flex-1 items-center rounded-full bg-white px-3 text-brand">
        <IconSearch className="size-4 shrink-0 text-brand/55" />
        <label className="sr-only" htmlFor="nav-ticket-search">
          Search tickets
        </label>
        <input
          ref={inputRef}
          id="nav-ticket-search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          autoComplete="off"
          className="h-10 w-full bg-transparent px-2 text-sm text-brand outline-none placeholder:text-brand/40"
        />
      </div>
      <button type="button" onClick={onClose} aria-label="Cancel" className="grid size-9 shrink-0 place-items-center rounded-full text-sm text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:bg-white/10 sm:w-auto sm:px-2">
        <svg viewBox="0 0 24 24" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Cancel</span>
      </button>
    </form>
  );
}

export default function AppShell({ children }) {
  usePageTour();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const [open, setOpen] = useState(false);
  const [searchPresent, setSearchPresent] = useState(false);
  const [searchShown, setSearchShown] = useState(false);
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get("q") ?? "");
  const inputRef = useRef(null);
  const ownNav = useRef(false);
  const focusOnOpen = useRef(false);
  const urlQuery = new URLSearchParams(location.search).get("q") ?? "";

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (ownNav.current) {
      ownNav.current = false;
      return;
    }
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-search-root], [data-search-anchor]")) return;
      setOpen(false);
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

  function applyQuery(value) {
    setQuery(value);
    const q = value.trim();
    const params = new URLSearchParams(pathname === "/tickets" ? location.search : "");
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    const next = qs ? `/tickets?${qs}` : "/tickets";
    if (`${pathname}${location.search}` === next) return;
    ownNav.current = true;
    navigate(next, { replace: pathname === "/tickets" });
  }

  function openSearch() {
    focusOnOpen.current = true;
    setOpen(true);
  }

  useEffect(() => {
    if (open) {
      setSearchPresent(true);
      setSearchShown(true);
      return undefined;
    }
    setSearchShown(false);
    const hide = window.setTimeout(() => setSearchPresent(false), 340);
    return () => window.clearTimeout(hide);
  }, [open]);

  useEffect(() => {
    if (!open || !searchPresent) return;
    if (focusOnOpen.current) {
      focusOnOpen.current = false;
      inputRef.current?.focus();
      return;
    }
    const active = document.activeElement;
    if (pathname === "/tickets" && (!active || active === document.body || active.id === "support-search")) {
      inputRef.current?.focus();
    }
  }, [open, pathname, searchPresent]);

  const [barHidden, setBarHidden] = useState(false);
  const hideBar = barHidden && !open && !searchPresent;
  const barMotion = useRef({ accum: 0, lockUntil: 0 });

  useLayoutEffect(() => {
    barMotion.current.accum = 0;
    barMotion.current.lockUntil = performance.now() + 500;
    setBarHidden(false);
  }, [pathname]);

  useEffect(() => {
    function onTourOpen() {
      setBarHidden(false);
      setOpen(false);
    }
    window.addEventListener("anant-tour-open", onTourOpen);
    return () => window.removeEventListener("anant-tour-open", onTourOpen);
  }, []);

  useEffect(() => {
    const tops = new WeakMap();
    let frame = 0;
    let latestTop = 0;

    function onScroll(event) {
      const node = event.target;
      if (!(node instanceof Element)) return;
      if (node.closest(".is-transitioning, [data-status-menu]")) return;
      if (node.scrollHeight <= node.clientHeight + 1) return;
      const top = node.scrollTop;
      const previous = tops.get(node) ?? top;
      tops.set(node, top);
      const delta = top - previous;
      if (!delta) return;
      const motion = barMotion.current;
      // The hide lock used to drop every event, including the scroll back up.
      // Lenis spreads that return into small steps, so the bar never came back.
      if (performance.now() < motion.lockUntil && delta > 0) return;
      motion.accum = (delta > 0 && motion.accum > 0) || (delta < 0 && motion.accum < 0) ? motion.accum + delta : delta;
      latestTop = top;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const motionNow = barMotion.current;
        const locked = performance.now() < motionNow.lockUntil;
        if (document.documentElement.hasAttribute("data-tour-open") || document.querySelector("header [role='menu']") || latestTop <= 12) {
          motionNow.accum = 0;
          setBarHidden(false);
          return;
        }
        if (!locked && motionNow.accum > 24) {
          motionNow.accum = 0;
          motionNow.lockUntil = performance.now() + 340;
          setBarHidden(true);
        } else if (motionNow.accum < -24) {
          motionNow.accum = 0;
          motionNow.lockUntil = performance.now() + 340;
          setBarHidden(false);
        }
      });
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const search = {
    query,
    revealSearch: () => setOpen(true),
    applyQuery,
  };

  return (
    <NavSearchContext.Provider value={search}>
      <div className="relative h-dvh min-h-0 bg-transparent">
        <header
          inert={hideBar ? true : undefined}
          className={`absolute inset-x-0 top-0 z-40 h-16 bg-brand text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] ${hideBar ? "-translate-y-full" : "translate-y-0"}`}
        >
          <div className={`${pagePad} flex h-16 items-center gap-2 sm:gap-6`}>
            <Link to="/" className="flex shrink-0 items-center outline-none focus-visible:opacity-80" aria-label="AnantDV support">
              <Logo className="h-9 w-auto sm:h-10" />
            </Link>
            <div
              className={`min-w-0 shrink-0 transition-opacity duration-200 sm:ml-auto ${
                searchPresent ? "max-sm:hidden" : "ml-auto"
              } ${searchShown ? "pointer-events-none opacity-0" : "opacity-100"}`}
            >
              <NavLinks pathname={pathname} />
            </div>
            {searchPresent ? (
              <div className={`nav-search-slot min-w-0 flex-1 sm:flex-none sm:shrink-0 ${searchShown ? "nav-search-slot-in" : "nav-search-slot-out"}`}>
                <NavSearchBar inputRef={inputRef} query={query} onQuery={applyQuery} onClose={() => setOpen(false)} />
              </div>
            ) : null}
            <div className="flex shrink-0 items-center gap-1">
              <TourButton />
              {searchPresent ? null : (
                <button
                  type="button"
                  aria-label="Search tickets"
                  aria-expanded={open}
                  onClick={openSearch}
                  className="grid size-9 place-items-center rounded-full text-white/80 outline-none transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
                >
                  <IconSearch className="size-4" />
                </button>
              )}
              <div className={searchPresent ? "max-sm:hidden" : ""}>
                <AccountMenu />
              </div>
            </div>
          </div>
        </header>
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </div>
    </NavSearchContext.Provider>
  );
}

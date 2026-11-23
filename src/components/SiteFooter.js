import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { pagePad } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/tickets/new", label: "New ticket" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/10 bg-brand text-white">
      <div className={`${pagePad} py-10 sm:py-12`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_auto_auto] lg:gap-16">
          <div>
            <Link to="/" className="inline-flex outline-none focus-visible:opacity-80" aria-label="AnantDV support">
              <Logo className="h-9 w-auto" />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">
              Open a support ticket, follow every request you created, and reach the desk when you want to.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2.5 text-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Support</p>
            {LINKS.map((link) => (
              <Link key={link.href} to={link.href} className="w-fit text-white/80 outline-none transition hover:text-white focus-visible:text-white">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="text-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Desk</p>
            <p className="mt-2.5 leading-7 text-white/70">
              Monday–Friday
              <br />
              9:00–18:00 IST
            </p>
            <a href="mailto:support@anantdv.com" className="mt-3 inline-block text-white/80 outline-none transition hover:text-white focus-visible:text-white">
              support@anantdv.com
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 pr-16 text-xs text-white/50">
          <p>© {year} AnantDV. All rights reserved.</p>
          <p>Customer support</p>
        </div>
      </div>
    </footer>
  );
}

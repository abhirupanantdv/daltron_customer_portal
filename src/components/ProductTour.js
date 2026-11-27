import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { IconTour } from "@/components/ui";
import { hasSeenTour, pageHasTargets, rememberTour, stepsForPath, tourId } from "@/lib/tours";

let active = null;
let generation = 0;

const APP_BASE = import.meta.env.PROD ? "/ticket" : "";

function currentAppPath() {
  let path = window.location.pathname || "/";
  if (APP_BASE && (path === APP_BASE || path.startsWith(`${APP_BASE}/`))) {
    path = path.slice(APP_BASE.length) || "/";
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function samePage(pathname) {
  let expected = pathname || "/";
  if (expected.length > 1 && expected.endsWith("/")) expected = expected.slice(0, -1);
  return currentAppPath() === expected;
}

function whenChromeReady(token, run) {
  document.documentElement.setAttribute("data-tour-open", "");
  window.dispatchEvent(new CustomEvent("anant-tour-open"));
  const started = performance.now();

  function tick() {
    if (token !== generation) return;
    const header = document.querySelector("header");
    const box = header?.getBoundingClientRect();
    const searchMoving = document.querySelector(".nav-search-slot-in, .nav-search-slot-out");
    const ready = box && box.height >= 60 && box.top >= -1 && !searchMoving;
    if (ready || performance.now() - started > 800) run();
    else requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export function stopPageTour() {
  generation += 1;
  if (active) active.destroy();
  else document.documentElement.removeAttribute("data-tour-open");
}

export function startPageTour(pathname) {
  const token = ++generation;
  whenChromeReady(token, () => {
    if (token !== generation) return;
    if (!samePage(pathname)) return;
    const steps = stepsForPath(pathname);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instance = driver({
      animate: !reduced,
      smoothScroll: !reduced,
      showProgress: true,
      allowClose: true,
      overlayClickBehavior: "close",
      overlayColor: window.matchMedia("(prefers-color-scheme: dark)").matches ? "#03090d" : "#091f2b",
      overlayOpacity: 0.62,
      stagePadding: 6,
      stageRadius: 14,
      popoverOffset: 12,
      popoverClass: "anant-tour",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      closeBtnLabel: "Close tutorial",
      disableActiveInteraction: true,
      skipMissingElement: true,
      scrollIntoView: { block: "center", inline: "nearest" },
      steps,
      onDestroyed: (_element, _step, opts) => {
        if (active !== instance) return;
        active = null;
        document.documentElement.removeAttribute("data-tour-open");
        const reason = opts?.reason;
        if (reason === "done" || reason === "close" || reason === "escape" || reason === "overlay") {
          rememberTour(tourId(pathname));
        }
      },
    });
    const previous = active;
    active = instance;
    previous?.destroy();
    instance.drive();
  });
}

export function usePageTour() {
  const { pathname } = useLocation();

  useEffect(() => {
    return () => stopPageTour();
  }, [pathname]);

  useEffect(() => {
    const id = tourId(pathname);
    if (hasSeenTour(id)) return undefined;
    const token = ++generation;
    let tries = 0;
    let timer = 0;

    function attempt() {
      if (token !== generation) return;
      if (!samePage(pathname)) return;
      if (!pageHasTargets(pathname)) {
        if (tries >= 10) return;
        tries += 1;
        timer = window.setTimeout(attempt, 200);
        return;
      }
      startPageTour(pathname);
    }

    timer = window.setTimeout(attempt, 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);
}

export default function TourButton() {
  const { pathname } = useLocation();

  return (
    <button
      type="button"
      data-tour="tour-replay"
      aria-label="Replay tutorial"
      title="Replay tutorial"
      onClick={() => startPageTour(pathname)}
      className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-white/80 outline-none transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 sm:inline-flex"
    >
      <IconTour className="size-4 shrink-0" />
      <span className="hidden md:inline">Tutorial</span>
    </button>
  );
}

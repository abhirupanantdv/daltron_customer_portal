import { cloneElement, isValidElement, memo, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import gsap from "gsap";
import SiteFooter from "@/components/SiteFooter";

const SLIDE_DURATION = 0.6;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createHistory(location) {
  return {
    entries: [{ key: location.key, pathname: location.pathname }],
    index: 0,
    seenKey: location.key,
    direction: "none",
  };
}

function advanceHistory(history, location, navigationType) {
  if (history.seenKey === location.key) {
    return { history, direction: history.direction };
  }

  const entry = { key: location.key, pathname: location.pathname };
  const entries = history.entries.slice();
  let index = history.index;
  let direction = "forward";

  if (navigationType === "POP") {
    const found = entries.findIndex((item) => item.key === location.key);
    if (found === -1) {
      entries.push(entry);
      index = entries.length - 1;
    } else {
      direction = found < index ? "back" : found > index ? "forward" : "none";
      index = found;
    }
  } else if (navigationType === "REPLACE") {
    entries[index] = entry;
    direction = "forward";
  } else {
    entries.splice(index + 1);
    entries.push(entry);
    index = entries.length - 1;
    direction = "forward";
  }

  return {
    history: { entries, index, seenKey: location.key, direction },
    direction,
  };
}

function findLayer(root, pathname) {
  return Array.from(root.children).find((node) => node.dataset.pathname === pathname) ?? null;
}

function layerClass(role, direction) {
  const onTop = direction === "back" ? role === "previous" : role === "current";
  const names = ["page-layer", onTop ? "page-layer--top" : "page-layer--under"];
  if (role === "previous") names.push("page-layer--exit");
  return names.join(" ");
}

function renderPage(children, location) {
  if (typeof children === "function") return children(location);
  if (isValidElement(children)) return cloneElement(children, { location });
  return children;
}

const PageLayer = memo(
  function PageLayer({ location, className, suspended, children }) {
    const chat = location.pathname.endsWith("/chat");
    const page = renderPage(children, location);

    return (
      <div className={className} data-pathname={location.pathname} inert={suspended ? true : undefined} aria-hidden={suspended ? true : undefined}>
        {chat ? (
          page
        ) : (
          <div className="flex min-h-full flex-col">
            <div className="flex-1">{page}</div>
            <SiteFooter />
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.className === next.className &&
    prev.suspended === next.suspended &&
    prev.location.key === next.location.key &&
    prev.location.pathname === next.location.pathname &&
    prev.location.search === next.location.search &&
    prev.location.hash === next.location.hash &&
    prev.location.state === next.location.state,
);

export default function PageTransition({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [stage, setStage] = useState(() => ({
    current: location,
    previous: null,
    direction: "none",
    id: 0,
    history: createHistory(location),
  }));

  const rootRef = useRef(null);
  const activeIdRef = useRef(0);

  // Render from the next stage in this pass. Waiting for setStage would paint the
  // destination page at rest, and only then start the slide.
  let view = stage;
  if (location.key !== stage.current.key) {
    const { history, direction } = advanceHistory(stage.history, location, navigationType);
    const pathnameChanged = location.pathname !== stage.current.pathname;
    const animate = pathnameChanged && direction !== "none" && !prefersReducedMotion();
    if (animate) {
      view = {
        current: location,
        previous: stage.current,
        direction,
        id: stage.id + 1,
        history,
      };
    } else if (pathnameChanged) {
      view = {
        current: location,
        previous: null,
        direction: "none",
        id: stage.id + 1,
        history,
      };
    } else {
      view = { ...stage, current: location, history };
    }
    setStage(view);
  }

  const motionId = view.id;
  const direction = view.direction;
  const currentPath = view.current.pathname;
  const previousPath = view.previous ? view.previous.pathname : "";
  const transitioning = previousPath !== "" && direction !== "none";

  useLayoutEffect(() => {
    const { history } = window;
    if (!("scrollRestoration" in history)) return undefined;
    const previousMode = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previousMode;
    };
  }, []);

  useLayoutEffect(() => {
    if (!previousPath || direction === "none") return undefined;

    const root = rootRef.current;
    const currentEl = root ? findLayer(root, currentPath) : null;
    const previousEl = root ? findLayer(root, previousPath) : null;
    if (!root || !currentEl || !previousEl) {
      setStage((prev) => (prev.id === motionId ? { ...prev, previous: null, direction: "none" } : prev));
      return undefined;
    }

    const activeId = motionId;
    activeIdRef.current = activeId;
    const forward = direction === "forward";

    const movingEl = forward ? currentEl : previousEl;
    const restingEl = forward ? previousEl : currentEl;
    // Forward: the next page slides in from the right. Back: the current
    // page slides back off to the right. x stays 0 so a percentage slide
    // cannot pick up a leftover pixel translation.
    const fromX = forward ? 100 : 0;
    const toX = forward ? 0 : 100;

    gsap.killTweensOf([currentEl, previousEl]);
    gsap.set(restingEl, { x: 0, y: 0, xPercent: 0, force3D: true });
    const tween = gsap.fromTo(
      movingEl,
      { x: 0, y: 0, xPercent: fromX, force3D: true },
      {
        x: 0,
        y: 0,
        xPercent: toX,
        duration: SLIDE_DURATION,
        ease: forward ? "power3.out" : "power3.inOut",
        overwrite: true,
        onComplete: () => {
          if (activeIdRef.current !== activeId) return;
          setStage((prev) => (prev.id === activeId ? { ...prev, previous: null, direction: "none" } : prev));
        },
      },
    );

    return () => {
      activeIdRef.current = -1;
      tween.kill();
    };
  }, [motionId, direction, currentPath, previousPath]);

  useLayoutEffect(() => {
    if (previousPath) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    for (const el of root.querySelectorAll(".page-layer")) {
      if (el.style.transform || el.style.opacity) {
        gsap.set(el, { clearProps: "transform,opacity", lazy: false });
      }
    }
    return undefined;
  }, [previousPath, motionId]);

  return (
    <div ref={rootRef} className={transitioning ? "page-transition is-transitioning" : "page-transition"}>
      {transitioning ? (
        <PageLayer key={previousPath} location={view.previous} className={layerClass("previous", direction)} suspended>
          {children}
        </PageLayer>
      ) : null}
      <PageLayer
        key={currentPath}
        location={view.current}
        className={transitioning ? layerClass("current", direction) : "page-layer"}
        suspended={transitioning && direction === "back"}
      >
        {children}
      </PageLayer>
    </div>
  );
}

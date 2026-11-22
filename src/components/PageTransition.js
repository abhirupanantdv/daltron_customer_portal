import { cloneElement, isValidElement, memo, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import gsap from "gsap";

const ENTER_OPACITY = 0.94;
const EXIT_OPACITY = 0.94;

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

function poseOf(element) {
  const xPercent = Number(gsap.getProperty(element, "xPercent"));
  const opacity = Number(gsap.getProperty(element, "opacity"));
  return {
    xPercent: Number.isFinite(xPercent) ? xPercent : 0,
    opacity: Number.isFinite(opacity) ? opacity : 1,
  };
}

function inlinePose(element) {
  if (!element.style.transform) return null;
  return poseOf(element);
}

function travelDuration(distance) {
  const span = Math.min(1, Math.abs(distance) / 100);
  return 0.32 + 0.2 * span;
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
    return (
      <div className={className} data-pathname={location.pathname} inert={suspended ? true : undefined} aria-hidden={suspended ? true : undefined}>
        {renderPage(children, location)}
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

  if (location.key !== stage.current.key) {
    const { history, direction } = advanceHistory(stage.history, location, navigationType);
    const pathnameChanged = location.pathname !== stage.current.pathname;
    const animate = pathnameChanged && direction !== "none" && !prefersReducedMotion();

    if (animate) {
      setStage({
        current: location,
        previous: stage.current,
        direction,
        id: stage.id + 1,
        history,
      });
    } else if (pathnameChanged) {
      setStage({
        current: location,
        previous: null,
        direction: "none",
        id: stage.id + 1,
        history,
      });
    } else {
      setStage({ ...stage, current: location, history });
    }
  }

  const motionId = stage.id;
  const direction = stage.direction;
  const currentPath = stage.current.pathname;
  const previousPath = stage.previous ? stage.previous.pathname : "";
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

    const context = gsap.context(() => {
      const movingEl = forward ? currentEl : previousEl;
      const restingEl = forward ? previousEl : currentEl;
      const movingPose = inlinePose(movingEl);
      const fromX = movingPose ? movingPose.xPercent : forward ? 100 : 0;
      const fromOpacity = movingPose ? movingPose.opacity : forward ? ENTER_OPACITY : 1;

      // One sheet moves. The page underneath is pinned so a second navigation
      // cannot leave two transforms running.
      gsap.killTweensOf([currentEl, previousEl]);
      gsap.set(restingEl, { xPercent: 0, opacity: 1, force3D: true });
      gsap.set(movingEl, { xPercent: fromX, opacity: fromOpacity, force3D: true });

      const distance = forward ? fromX : 100 - fromX;
      const duration = travelDuration(distance);
      const timeline = gsap.timeline({
        onComplete: () => {
          if (activeIdRef.current !== activeId) return;
          gsap.set(currentEl, { clearProps: "transform,opacity" });
          setStage((prev) => (prev.id === activeId ? { ...prev, previous: null, direction: "none" } : prev));
        },
      });

      if (forward) {
        timeline.to(movingEl, { xPercent: 0, duration, ease: "power3.out", force3D: true }, 0);
        timeline.to(movingEl, { opacity: 1, duration: duration * 0.28, ease: "power1.out" }, 0);
      } else {
        timeline.to(movingEl, { xPercent: 100, duration, ease: "power3.inOut", force3D: true }, 0);
        timeline.to(movingEl, { opacity: EXIT_OPACITY, duration: duration * 0.3, ease: "power1.in" }, duration * 0.7);
      }
    }, root);

    return () => {
      activeIdRef.current = -1;
      // kill() stops the timeline without restoring its start transform.
      // revert() would snap a settled or in-flight page back to translateX(100%).
      if (currentEl.isConnected || previousEl.isConnected) context.kill();
      else context.revert();
    };
  }, [motionId, direction, currentPath, previousPath]);

  return (
    <div ref={rootRef} className={transitioning ? "page-transition is-transitioning" : "page-transition"}>
      {transitioning ? (
        <PageLayer key={previousPath} location={stage.previous} className={layerClass("previous", direction)} suspended>
          {children}
        </PageLayer>
      ) : null}
      <PageLayer
        key={currentPath}
        location={stage.current}
        className={transitioning ? layerClass("current", direction) : "page-layer"}
        suspended={transitioning && direction === "back"}
      >
        {children}
      </PageLayer>
    </div>
  );
}

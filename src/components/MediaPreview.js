import { useEffect, useState } from "react";

export function MediaGrid({ items, onRemove, onReplace }) {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!items?.length) return null;

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-2xl border border-ink/10 bg-surface">
            <div className="relative">
              {item.kind === "video" ? (
                <button type="button" className="flex aspect-video w-full items-center justify-center bg-ink px-4 text-center text-sm font-medium text-paper" onClick={() => setOpen(item)}>
                  Video attached. Tap to play.
                </button>
              ) : item.url ? (
                <button type="button" className="block w-full" onClick={() => setOpen(item)}>
                  <img src={item.url} alt={item.name || "Photo"} className="aspect-video w-full bg-mist object-contain" />
                </button>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-mist px-4 text-center text-sm font-medium">Photo attached</div>
              )}
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink shadow-sm">
                {item.kind === "video" ? "Video added" : "Photo added"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs">{item.name}</span>
              {item.kind === "video" ? (
                <button type="button" className="shrink-0 text-xs text-mute underline-offset-2 hover:text-ink hover:underline" onClick={() => setOpen(item)}>
                  Play
                </button>
              ) : (
                <button type="button" className="shrink-0 text-xs text-mute underline-offset-2 hover:text-ink hover:underline" onClick={() => setOpen(item)}>
                  View
                </button>
              )}
              {onReplace ? (
                <label className="shrink-0 cursor-pointer text-xs text-mute underline-offset-2 hover:text-ink hover:underline">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        await onReplace(item.id, file);
                      } finally {
                        input.value = "";
                      }
                    }}
                  />
                  Replace
                </label>
              ) : null}
              {onRemove ? (
                <button type="button" className="shrink-0 text-xs text-mute underline-offset-2 hover:text-ink hover:underline" onClick={() => onRemove(item.id)}>
                  Remove
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {open ? <Lightbox item={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

export function MediaThumb({ item }) {
  if (!item?.url) return null;
  if (item.kind === "video") {
    return <video src={previewSrc(item.url)} muted playsInline preload="metadata" className="size-16 shrink-0 rounded-lg bg-ink object-cover" />;
  }
  return <img src={item.url} alt="" className="size-16 shrink-0 rounded-lg bg-mist object-cover" />;
}

function Lightbox({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true" aria-label={item.name || "Preview"} onClick={onClose}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3" onClick={(event) => event.stopPropagation()}>
        {item.kind === "video" ? (
          <video src={item.url} controls autoPlay playsInline className="max-h-[80vh] w-full bg-ink" />
        ) : (
          <img src={item.url} alt={item.name || "Photo"} className="max-h-[80vh] w-full object-contain" />
        )}
        <div className="flex items-center justify-between gap-3 text-sm text-paper">
          <span className="min-w-0 truncate">{item.name}</span>
          <button type="button" className="shrink-0 underline-offset-2 hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function previewSrc(url) {
  if (!url || url.startsWith("blob:") || url.includes("#")) return url;
  return `${url}#t=0.1`;
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchOptions } from "@/lib/erpClient";
import { MediaGrid } from "@/components/MediaPreview";
import { useTickets } from "@/components/TicketsProvider";
import { IconChat, IconPlus, IconTickets, PageFrame, fieldClass, ghostBtn, primaryBtn } from "@/components/ui";

const MAX_FILES = 10;
const PHOTO_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 25 * 1024 * 1024;

const POINTS = [
  [IconPlus, "It joins your list", "The new ticket shows up with the others. Status comes from the service desk."],
  [IconTickets, "Status stays visible", "You can leave and come back. The ticket shows the status stored on the desk."],
  [IconChat, "Chat is optional", "Open the conversation only when you want to add more."],
];

const EMPTY = {
  customer: "",
  customerSite: "",
  contactPerson: "",
  contactEmail: "",
  contactMobile: "",
  customerEquipment: "",
  ticketType: "",
  category: "",
  subCategory: "",
  impact: "",
  serviceCategory: "",
  priority: "Medium",
  subject: "",
  description: "",
};

export default function NewTicketForm() {
  const { createTicket } = useTickets();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const filesRef = useRef([]);
  const subjectRef = useRef(null);

  useEffect(() => {
    subjectRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const item of filesRef.current) URL.revokeObjectURL(item.url);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOptions()
      .then((data) => {
        if (cancelled) return;
        const customers = asList(data?.customers);
        const priorities = asList(data?.priorities);
        setOptions({
          ...data,
          customers,
          sites: asList(data?.sites),
          contacts: asList(data?.contacts),
          equipment: asList(data?.equipment),
          ticketTypes: asList(data?.ticketTypes),
          categories: asList(data?.categories),
          ticketCategories: asOptions(data?.ticketCategories),
          subCategories: asOptions(data?.subCategories),
          impacts: asList(data?.impacts),
          priorities,
          statuses: asList(data?.statuses),
        });
        setForm((current) => ({
          ...current,
          priority: priorities.includes("Medium") ? "Medium" : priorities[0] || "",
        }));
        if (data?.warnings) setErrors((current) => ({ ...current, form: data.warnings }));
      })
      .catch((error) => {
        if (!cancelled) setErrors((current) => ({ ...current, form: error.message }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "category") next.subCategory = "";
      return next;
    });
  }

  function addFiles(list) {
    const problems = [];
    const next = [...filesRef.current];
    for (const file of Array.from(list || [])) {
      if (next.length >= MAX_FILES) {
        problems.push(`You can add up to ${MAX_FILES} files.`);
        break;
      }
      if (!file.size) {
        problems.push(`${file.name || "That file"} did not come through. Choose it again.`);
        continue;
      }
      const kind = fileKind(file);
      if (!kind) {
        problems.push(`${file.name} is not a photo or video.`);
        continue;
      }
      const limit = kind === "video" ? VIDEO_LIMIT : PHOTO_LIMIT;
      if (file.size > limit) {
        problems.push(`${file.name} is too large.`);
        continue;
      }
      const duplicate = next.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified);
      if (duplicate) continue;
      next.push({ id: fileId(), file, kind, url: previewUrl(file) });
    }
    filesRef.current = next;
    setFiles(next);
    setErrors((current) => ({ ...current, attachments: problems[0] || "" }));
  }

  async function replaceFile(id, raw) {
    const [file] = await snapshotFiles([raw]);
    if (!file?.size) {
      setErrors((current) => ({ ...current, attachments: "That file did not come through. Choose it again." }));
      return;
    }
    const kind = fileKind(file);
    if (!kind) {
      setErrors((current) => ({ ...current, attachments: `${file.name} is not a photo or video.` }));
      return;
    }
    const limit = kind === "video" ? VIDEO_LIMIT : PHOTO_LIMIT;
    if (file.size > limit) {
      setErrors((current) => ({ ...current, attachments: `${file.name} is too large.` }));
      return;
    }
    const next = filesRef.current.map((entry) => {
      if (entry.id !== id) return entry;
      if (entry.url) URL.revokeObjectURL(entry.url);
      return { id: entry.id, file, kind, url: previewUrl(file) };
    });
    filesRef.current = next;
    setFiles(next);
    setErrors((current) => ({ ...current, attachments: "" }));
  }

  function removeFile(id) {
    const next = filesRef.current.filter((entry) => {
      if (entry.id !== id) return true;
      URL.revokeObjectURL(entry.url);
      return false;
    });
    filesRef.current = next;
    setFiles(next);
    setErrors((current) => ({ ...current, attachments: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.subject.trim()) next.subject = "Add a subject.";
    setErrors(next);
    if (next.subject) subjectRef.current?.focus({ preventScroll: true });
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const ticket = await createTicket({ ...form, files: filesRef.current.map((item) => item.file) });
      navigate(`/tickets/${ticket.id}`, { state: { uploadWarning: ticket.uploadWarning || "" } });
    } catch (error) {
      setErrors((current) => ({ ...current, form: error.message }));
      setSubmitting(false);
    }
  }

  return (
    <PageFrame>
      <div className="cove-in">
        <h1 className="font-display text-3xl tracking-tight text-balance sm:text-4xl">Tell us what you need.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">These are the Service Ticket fields. Creating the ticket writes them on the service desk.</p>

        <ul className="mt-5 grid gap-4 border-y border-ink/10 py-4 sm:grid-cols-3">
          {POINTS.map(([Icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink" />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-sm leading-5 text-mute">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <form noValidate onSubmit={submit} className="mt-6 grid gap-5">
          <FormSection title="Ticket">
            <TextField label="Subject" id="subject" data-tour="field-subject" inputRef={subjectRef} value={form.subject} error={errors.subject} onChange={(value) => setField("subject", value)} placeholder="Short summary" maxLength={140} />
            <TextArea label="Description" id="description" data-tour="field-description" value={form.description} onChange={(value) => setField("description", value)} placeholder="What happened" rows={5} />
            <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Ticket Type" id="ticket-type" value={form.ticketType} onChange={(value) => setField("ticketType", value)} choices={options?.ticketTypes || []} placeholder="No ticket type" />
              <SelectField label="Category" id="category" value={form.category} onChange={(value) => setField("category", value)} options={options?.ticketCategories || []} placeholder="No category" />
              <SelectField label="Sub Category" id="sub-category" value={form.subCategory} onChange={(value) => setField("subCategory", value)} options={(options?.subCategories || []).filter((item) => item.category === form.category)} placeholder={form.category ? "No sub category" : "Choose a category first"} disabled={!form.category} />
              <SelectField label="Impact" id="impact" value={form.impact} onChange={(value) => setField("impact", value)} choices={options?.impacts || []} placeholder="No impact" />
              <SelectField label="Service Category" id="service-category" data-tour="field-category" value={form.serviceCategory} onChange={(value) => setField("serviceCategory", value)} choices={options?.categories || []} placeholder="No category" />
              <SelectField label="Priority" id="priority" data-tour="field-priority" value={form.priority} onChange={(value) => setField("priority", value)} choices={options?.priorities || []} placeholder="No priority" />
            </div>
          </FormSection>

          <FormSection title="Attachments">
            <AttachmentField files={files} error={errors.attachments} disabled={submitting} onAdd={addFiles} onReplace={replaceFile} onRemove={removeFile} />
          </FormSection>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {errors.form ? <p className="mr-auto text-sm text-ink">{errors.form}</p> : null}
            <Link to="/tickets" className={ghostBtn}>
              Cancel
            </Link>
            <button type="submit" data-tour="create-ticket" className={primaryBtn} disabled={submitting || !options}>
              <IconPlus className="size-4" />
              {submitting ? (files.length ? "Uploading" : "Creating") : "Create ticket"}
            </button>
          </div>
        </form>
      </div>
    </PageFrame>
  );
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asOptions(value) {
  return asList(value)
    .map((item) => {
      if (typeof item === "string") return { name: item, label: item, category: "" };
      return {
        name: item?.name || "",
        label: item?.label || item?.name || "",
        category: item?.category || "",
      };
    })
    .filter((item) => item.name);
}

function fileKind(file) {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type === "image/svg+xml" || name.endsWith(".svg")) return "";
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg|3gp|mkv|avi)$/.test(name)) return "video";
  return "";
}

async function snapshotFiles(list) {
  const picked = [];
  for (const file of Array.from(list || [])) {
    const name = file?.name || "attachment";
    const type = file?.type || "";
    const lastModified = file?.lastModified || Date.now();
    const buffer = await file.arrayBuffer();
    if (!buffer.byteLength) continue;
    picked.push(new File([buffer], name, { type, lastModified }));
  }
  return picked;
}

function previewUrl(file) {
  try {
    return URL.createObjectURL(file);
  } catch {
    return "";
  }
}

function AttachmentField({ files, error, disabled, onAdd, onReplace, onRemove }) {
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState("");
  const [localError, setLocalError] = useState("");
  const listRef = useRef(null);
  const previousCount = useRef(0);
  const full = files.length >= MAX_FILES;

  useEffect(() => {
    if (files.length > previousCount.current) {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    previousCount.current = files.length;
  }, [files.length]);

  async function take(list) {
    if (disabled || full) return;
    const originals = Array.from(list || []);
    if (!originals.length) return;
    setReading(originals.map((file) => file.name || "file").join(", "));
    setLocalError("");
    try {
      const picked = await snapshotFiles(originals);
      if (!picked.length) {
        setLocalError("That file did not come through. Choose it again.");
        return;
      }
      onAdd(picked);
    } catch {
      setLocalError("That file did not come through. Choose it again.");
    } finally {
      setReading("");
    }
  }

  return (
    <div data-tour="field-attachments">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !full) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 text-center transition ${over ? "border-ink bg-ink/[0.04]" : "border-ink/20 bg-surface"}`}
      >
        <span className="text-sm font-medium">{files.length ? "Add another photo or video" : "Add photos or videos"}</span>
        <span className="text-xs leading-5 text-mute">
          Add more than one. Photos under 10 MB, videos under 25 MB. Drop them here, or choose from your device.
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <FilePicker accept="image/*" disabled={disabled || full} onPick={take}>
            Add photos
          </FilePicker>
          <FilePicker accept="video/*" disabled={disabled || full} onPick={take}>
            Add videos
          </FilePicker>
        </div>
      </div>
      {reading ? <p className="mt-3 text-sm font-medium">Adding {reading}</p> : null}
      {localError || error ? <p className="mt-3 text-sm font-medium">{localError || error}</p> : null}
      {files.length ? (
        <div ref={listRef} className="mt-3 rounded-xl border border-ink/15 bg-mist/70 p-3" aria-live="polite">
          <p className="text-sm font-semibold">{files.length === 1 ? "1 file added" : `${files.length} files added`}</p>
          <p className="mt-0.5 text-xs leading-5 text-mute">Attached to this ticket. They are saved when you create it.</p>
          <ul className="mt-3 space-y-2">
            {files.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-2">
                <span className="inline-flex shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">
                  {item.kind === "video" ? "Video" : "Photo"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.file.name}</span>
                  <span className="block text-xs text-mute">{formatBytes(item.file.size)} · ready to send</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <MediaGrid
              items={files.map((item) => ({ id: item.id, name: item.file.name, kind: item.kind, url: item.url }))}
              onReplace={disabled ? undefined : onReplace}
              onRemove={disabled ? undefined : onRemove}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileId() {
  return globalThis.crypto?.randomUUID?.() || `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function FilePicker({ accept, disabled, onPick, children }) {
  return (
    <label className={`inline-flex cursor-pointer items-center rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium ${disabled ? "cursor-not-allowed opacity-40" : "hover:bg-ink/[0.04]"}`}>
      <input
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={async (event) => {
          const input = event.currentTarget;
          const originals = Array.from(input.files || []);
          if (!originals.length || disabled) return;
          try {
            await onPick(originals);
          } finally {
            input.value = "";
          }
        }}
      />
      {children}
    </label>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-paper">
      <h2 className="border-b border-ink/10 bg-mist px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-mute sm:px-5">{title}</h2>
      <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function Field({ label, id, error, className = "", children }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-ink">{error}</p> : null}
    </div>
  );
}

function TextField({ label, id, value, onChange, error, inputRef, className, ...props }) {
  return (
    <Field label={label} id={id} error={error} className={className}>
      <input id={id} ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} ${error ? "border-ink ring-4 ring-ink/10" : ""}`} {...props} />
    </Field>
  );
}

function TextArea({ label, id, value, onChange, rows = 3, className, ...props }) {
  return (
    <Field label={label} id={id} className={className}>
      <textarea id={id} value={value} rows={rows} maxLength={2000} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} resize-y`} {...props} />
    </Field>
  );
}

function SelectField({ label, id, value, onChange, options, choices, placeholder, error, inputRef, className, ...props }) {
  const items = options || (choices || []).map((item) => ({ name: item, label: item }));
  return (
    <Field label={label} id={id} error={error} className={className}>
      <select id={id} ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} ${error ? "border-ink ring-4 ring-ink/10" : ""}`} {...props}>
        <option value="">{placeholder}</option>
        {items.map((item) => (
          <option key={item.name} value={item.name}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchOptions } from "@/lib/erpClient";
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
  impact: "",
  urgency: "",
  serviceCategory: "",
  priority: "Medium",
  subject: "",
  reportedBy: "",
  source: "Customer Portal",
  description: "",
  customerComplaint: "",
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
        const sources = asList(data?.sources);
        setOptions({
          ...data,
          customers,
          sites: asList(data?.sites),
          contacts: asList(data?.contacts),
          equipment: asList(data?.equipment),
          ticketTypes: asList(data?.ticketTypes),
          categories: asList(data?.categories),
          impacts: asList(data?.impacts),
          urgencies: asList(data?.urgencies),
          priorities,
          sources,
          statuses: asList(data?.statuses),
        });
        setForm((current) => ({
          ...current,
          priority: priorities.includes("Medium") ? "Medium" : priorities[0] || "",
          source: sources.includes("Customer Portal") ? "Customer Portal" : current.source,
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
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addFiles(list) {
    const problems = [];
    const next = [...filesRef.current];
    for (const file of list) {
      if (next.length >= MAX_FILES) {
        problems.push(`You can add up to ${MAX_FILES} files.`);
        break;
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
      next.push({ id: crypto.randomUUID(), file, kind, url: URL.createObjectURL(file) });
    }
    filesRef.current = next;
    setFiles(next);
    setErrors((current) => ({ ...current, attachments: problems[0] || "" }));
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
      const ticket = await createTicket({ ...form, files: files.map((item) => item.file) });
      navigate(`/tickets/${ticket.id}`);
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
            <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Ticket Type" id="ticket-type" value={form.ticketType} onChange={(value) => setField("ticketType", value)} choices={options?.ticketTypes || []} placeholder="No ticket type" />
              <SelectField label="Impact" id="impact" value={form.impact} onChange={(value) => setField("impact", value)} choices={options?.impacts || []} placeholder="No impact" />
              <SelectField label="Urgency" id="urgency" value={form.urgency} onChange={(value) => setField("urgency", value)} choices={options?.urgencies || []} placeholder="No urgency" />
              <SelectField label="Service Category" id="service-category" data-tour="field-category" value={form.serviceCategory} onChange={(value) => setField("serviceCategory", value)} choices={options?.categories || []} placeholder="No category" />
              <SelectField label="Priority" id="priority" data-tour="field-priority" value={form.priority} onChange={(value) => setField("priority", value)} choices={options?.priorities || []} placeholder="No priority" />
            </div>
            <TextField label="Subject" id="subject" data-tour="field-subject" inputRef={subjectRef} value={form.subject} error={errors.subject} onChange={(value) => setField("subject", value)} placeholder="Short summary" maxLength={140} />
            <div className="grid items-start gap-x-5 gap-y-4 sm:grid-cols-2">
              <TextField label="Reported By" id="reported-by" data-tour="field-contact" value={form.reportedBy} onChange={(value) => setField("reportedBy", value)} placeholder="Person who reported this" />
              <SelectField label="Source" id="source" value={form.source} onChange={(value) => setField("source", value)} choices={options?.sources || []} placeholder="No source" />
            </div>
            <div className="grid items-start gap-x-5 gap-y-4 lg:grid-cols-2">
              <TextArea label="Description" id="description" data-tour="field-description" value={form.description} onChange={(value) => setField("description", value)} placeholder="What happened" rows={3} />
              <TextArea label="Complaint" id="customer-complaint" value={form.customerComplaint} onChange={(value) => setField("customerComplaint", value)} placeholder="What was reported" rows={3} />
            </div>
          </FormSection>

          <FormSection title="Attachments">
            <AttachmentField files={files} error={errors.attachments} disabled={submitting} onAdd={addFiles} onRemove={removeFile} />
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

function fileKind(file) {
  const name = file.name.toLowerCase();
  if (file.type === "image/svg+xml" || name.endsWith(".svg")) return "";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(name)) return "image";
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg)$/.test(name)) return "video";
  return "";
}

function AttachmentField({ files, error, disabled, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function take(list) {
    if (disabled) return;
    onAdd(list);
  }

  return (
    <div data-tour="field-attachments">
      <input
        ref={inputRef}
        id="attachments"
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition ${over ? "border-ink bg-ink/[0.04]" : "border-ink/20 bg-surface hover:bg-ink/[0.03]"} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className="text-sm font-medium">Add photos or videos</span>
        <span className="text-xs leading-5 text-mute">Up to {MAX_FILES} files. Photos under 10 MB, videos under 25 MB. Drop them here or choose from your device. They are saved on the service ticket.</span>
      </button>
      {error ? <p className="mt-1.5 text-xs text-ink">{error}</p> : null}
      {files.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
              {item.kind === "video" ? (
                <video src={item.url} muted preload="metadata" className="aspect-square w-full bg-ink object-cover" />
              ) : (
                <img src={item.url} alt="" className="aspect-square w-full object-cover" />
              )}
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-xs">{item.file.name}</span>
                <button type="button" className="shrink-0 text-xs text-mute underline-offset-2 hover:text-ink hover:underline" onClick={() => onRemove(item.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink/10 bg-paper">
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

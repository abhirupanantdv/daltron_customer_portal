import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES, CHANNELS, PRIORITIES, PROJECTS, needsReference, uid } from "@/lib/tickets";
import { useTickets } from "@/components/TicketsProvider";
import { IconChat, IconPlus, IconTickets, PageFrame, fieldClass, ghostBtn, primaryBtn } from "@/components/ui";

const IMAGE_LIMIT = 4;
const IMAGE_BYTES = 1.5 * 1024 * 1024;
const VIDEO_BYTES = 2 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const POINTS = [
  [IconPlus, "It joins your list", "The new ticket shows up with the others, starting as open."],
  [IconTickets, "Status stays visible", "You can leave and come back. The rail shows where it stands."],
  [IconChat, "Chat is optional", "Open the conversation only when you want to add more."],
];

export default function NewTicketForm() {
  const { createTicket } = useTickets();
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [project, setProject] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState(CHANNELS[0].id);
  const [reference, setReference] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState("Normal");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [steps, setSteps] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const subjectRef = useRef(null);
  const projectRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const referenceRef = useRef(null);
  const descriptionRef = useRef(null);

  useEffect(() => {
    // The page is still sliding in. Scrolling the focused field into view
    // fights that motion and makes the bar jump.
    subjectRef.current?.focus({ preventScroll: true });
  }, []);

  async function addFiles(event) {
    const picked = [...event.target.files];
    event.target.value = "";
    if (!picked.length) return;

    const next = [...attachments];
    let images = next.filter((file) => file.kind === "image").length;
    let videos = next.filter((file) => file.kind === "video").length;
    const problems = [];

    for (const file of picked) {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "";
      if (!kind) {
        problems.push(`${file.name} is not a screenshot or video.`);
        continue;
      }
      if (kind === "image" && images >= IMAGE_LIMIT) {
        problems.push(`Only ${IMAGE_LIMIT} screenshots can be added.`);
        continue;
      }
      if (kind === "video" && videos >= 1) {
        problems.push("Only one video can be added.");
        continue;
      }
      const limit = kind === "image" ? IMAGE_BYTES : VIDEO_BYTES;
      if (file.size > limit) {
        problems.push(`${file.name} is over ${kind === "image" ? "1.5 MB" : "2 MB"}.`);
        continue;
      }
      try {
        const url = await readFile(file);
        next.push({ id: uid(), name: file.name, kind, type: file.type, url });
        if (kind === "image") images += 1;
        else videos += 1;
      } catch {
        problems.push(`${file.name} could not be read.`);
      }
    }

    setAttachments(next);
    setErrors((current) => ({ ...current, files: problems[0] ?? "" }));
  }

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (subject.trim().length < 3) next.subject = "Add a short subject.";
    if (project.trim().length < 2) next.project = "Name the project this is about.";
    if (name.trim().length < 2) next.name = "Add your name.";
    if (!EMAIL.test(email.trim())) next.email = "Add a valid email.";
    if (channel === "call" && phone.trim().length < 7) next.phone = "Add a phone number so we can call.";
    if (needsReference(category) && reference.trim().length < 2) next.reference = "Add the invoice, order, or account.";
    if (description.trim().length < 8) next.description = "Tell us a little about the issue.";
    setErrors(next);
    const focus = [
      ["subject", subjectRef],
      ["project", projectRef],
      ["name", nameRef],
      ["email", emailRef],
      ["phone", phoneRef],
      ["reference", referenceRef],
      ["description", descriptionRef],
    ].find(([key]) => next[key]);
    if (focus) {
      focus[1].current?.focus();
      return;
    }
    const ticket = createTicket({
      subject,
      project,
      name,
      email,
      phone,
      channel,
      reference,
      location,
      steps,
      category,
      priority,
      description,
      expected,
      attachments,
    });
    navigate(`/tickets/${ticket.id}`);
  }

  return (
    <PageFrame>
      <div className="cove-in">
        <h1 className="font-display text-4xl tracking-tight text-balance sm:text-5xl">Tell us what you need.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-mute">Name the project, describe what happened, and add screenshots or a short video if they help. Nothing is sent until you create the ticket.</p>

        <ul className="mt-8 grid gap-6 border-y border-ink/10 py-6 sm:grid-cols-3">
          {POINTS.map(([Icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-ink" />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-mute">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <form noValidate onSubmit={submit} className="mt-2 grid gap-x-12 gap-y-6 py-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
          <label className="text-sm font-medium lg:pt-2.5" htmlFor="subject">
            Subject
          </label>
          <div>
            <input
              id="subject"
              data-tour="field-subject"
              ref={subjectRef}
              value={subject}
              maxLength={140}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Short summary"
              className={`${fieldClass} ${errors.subject ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            {errors.subject ? <p className="mt-1.5 text-xs text-ink">{errors.subject}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="project">
            Project
          </label>
          <div>
            <input
              id="project"
              data-tour="field-project"
              ref={projectRef}
              value={project}
              maxLength={80}
              list="ticket-projects"
              onChange={(event) => setProject(event.target.value)}
              placeholder="Which project is this for?"
              className={`${fieldClass} ${errors.project ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            <datalist id="ticket-projects">
              {PROJECTS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {errors.project ? <p className="mt-1.5 text-xs text-ink">{errors.project}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="name">
            Name
          </label>
          <div>
            <input
              id="name"
              data-tour="field-contact"
              ref={nameRef}
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className={`${fieldClass} ${errors.name ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            {errors.name ? <p className="mt-1.5 text-xs text-ink">{errors.name}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="email">
            Email
          </label>
          <div>
            <input
              id="email"
              ref={emailRef}
              type="email"
              value={email}
              maxLength={120}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className={`${fieldClass} ${errors.email ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            {errors.email ? <p className="mt-1.5 text-xs text-ink">{errors.email}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="phone">
            Phone
          </label>
          <div>
            <input
              id="phone"
              ref={phoneRef}
              type="tel"
              value={phone}
              maxLength={40}
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder={channel === "call" ? "Number for the callback" : "Optional"}
              className={`${fieldClass} ${errors.phone ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            {errors.phone ? <p className="mt-1.5 text-xs text-ink">{errors.phone}</p> : null}
          </div>

          <p className="text-sm font-medium lg:pt-2">Reply by</p>
          <div data-tour="field-channel" role="radiogroup" aria-label="Reply by" className="flex flex-wrap gap-2">
            {CHANNELS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={channel === item.id}
                onClick={() => setChannel(item.id)}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition ${channel === item.id ? "bg-ink text-paper" : "bg-mist text-ink hover:bg-ink/[0.06]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="reference">
            Reference
          </label>
          <div>
            <input
              id="reference"
              data-tour="field-reference"
              ref={referenceRef}
              value={reference}
              maxLength={80}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Invoice, order, or account"
              className={`${fieldClass} ${errors.reference ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            <p className="mt-1.5 text-xs leading-5 text-mute">Needed for billing, account, and order requests.</p>
            {errors.reference ? <p className="mt-1.5 text-xs text-ink">{errors.reference}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="location">
            Where it happens
          </label>
          <div>
            <input
              id="location"
              value={location}
              maxLength={160}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Page, screen, or link"
              className={fieldClass}
            />
          </div>

          <p className="text-sm font-medium lg:pt-2">Category</p>
          <div data-tour="field-category" role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={category === item}
                onClick={() => setCategory(item)}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition ${category === item ? "bg-ink text-paper" : "bg-mist text-ink hover:bg-ink/[0.06]"}`}
              >
                {item}
              </button>
            ))}
          </div>

          <p className="text-sm font-medium lg:pt-2">Priority</p>
          <div data-tour="field-priority" role="radiogroup" aria-label="Priority" className="grid max-w-md grid-cols-3 gap-1 rounded-full bg-mist p-1">
            {PRIORITIES.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={priority === item}
                onClick={() => setPriority(item)}
                className={`rounded-full py-2 text-sm transition ${priority === item ? "bg-ink text-paper" : "text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="description">
            What happened?
          </label>
          <div>
            <textarea
              id="description"
              data-tour="field-description"
              ref={descriptionRef}
              value={description}
              maxLength={2000}
              rows={6}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened, and what do you need from us?"
              className={`${fieldClass} resize-none ${errors.description ? "border-ink ring-4 ring-ink/10" : ""}`}
            />
            {errors.description ? <p className="mt-1.5 text-xs text-ink">{errors.description}</p> : null}
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="expected">
            What should have happened?
          </label>
          <div>
            <textarea
              id="expected"
              data-tour="field-expected"
              value={expected}
              maxLength={1000}
              rows={3}
              onChange={(event) => setExpected(event.target.value)}
              placeholder="Optional. What you expected instead."
              className={`${fieldClass} resize-none`}
            />
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="steps">
            Steps
          </label>
          <div>
            <textarea
              id="steps"
              data-tour="field-steps"
              value={steps}
              maxLength={2000}
              rows={4}
              onChange={(event) => setSteps(event.target.value)}
              placeholder="What did you do just before this happened?"
              className={`${fieldClass} resize-none`}
            />
          </div>

          <label className="text-sm font-medium lg:pt-2.5" htmlFor="attachments">
            Screenshots or video
          </label>
          <div data-tour="field-files">
            <input id="attachments" type="file" accept="image/*,video/*" multiple onChange={addFiles} className="sr-only" />
            <label htmlFor="attachments" className={`${ghostBtn} cursor-pointer`}>
              <IconPlus className="size-4" />
              Add files
            </label>
            <p className="mt-2 text-xs leading-5 text-mute">Up to 4 screenshots (1.5 MB each) and 1 video (2 MB).</p>
            {errors.files ? <p className="mt-1.5 text-xs text-ink">{errors.files}</p> : null}
            {attachments.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {attachments.map((file) => (
                  <li key={file.id} className="overflow-hidden rounded-xl border border-ink/10">
                    {file.kind === "video" ? (
                      <video src={file.url} controls className="aspect-video w-full bg-black" />
                    ) : (
                      <img src={file.url} alt="" className="aspect-video w-full object-cover" />
                    )}
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-xs text-mute">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}
                        className="shrink-0 text-xs text-ink underline-offset-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 lg:col-start-2">
            <Link to="/tickets" className={ghostBtn}>
              Cancel
            </Link>
            <button type="submit" data-tour="create-ticket" className={primaryBtn}>
              <IconPlus className="size-4" />
              Create ticket
            </button>
          </div>
        </form>
      </div>
    </PageFrame>
  );
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const CATEGORY_FALLBACK = ["Network", "Cabling", "Power", "Application", "Hardware", "Printer", "Software", "Connectivity", "Other"];
const PRIORITY_FALLBACK = ["Critical", "High", "Medium", "Low"];

const TICKET_FIELDS = [
  "name",
  "subject",
  "customer",
  "customer_site",
  "contact_person",
  "contact_email",
  "contact_mobile",
  "reported_by",
  "customer_equipment",
  "ticket_type",
  "service_category",
  "impact",
  "urgency",
  "priority",
  "source",
  "status",
  "description",
  "customer_complaint",
  "creation",
  "modified",
  "reported_datetime",
];

export function erpApi({ url, token }) {
  const env = {
    url: (url || "").replace(/\/$/, ""),
    token: token || "",
  };

  return {
    name: "erp-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        if (!requestUrl.pathname.startsWith("/api/erp")) return next();
        try {
          if (!env.url || !env.token) {
            send(res, 500, { error: "ERPNext is not configured. Add ERPNEXT_URL and ERPNEXT_TOKEN to .env and restart the dev server." });
            return;
          }
          await route(env, req, res, requestUrl);
        } catch (error) {
          send(res, error.status || 502, { error: error.message || "ERPNext request failed" });
        }
      });
    },
  };
}

async function route(env, req, res, requestUrl) {
  const { pathname } = requestUrl;
  if (req.method === "GET" && pathname === "/api/erp/options") {
    send(res, 200, await loadOptions(env));
    return;
  }
  if (req.method === "GET" && pathname === "/api/erp/tickets") {
    send(res, 200, { tickets: await loadTickets(env) });
    return;
  }
  const one = pathname.match(/^\/api\/erp\/tickets\/([^/]+)$/);
  if (req.method === "GET" && one) {
    const ticket = await loadTicket(env, decodeURIComponent(one[1]));
    if (!ticket) {
      send(res, 404, { error: "Ticket not found" });
      return;
    }
    send(res, 200, { ticket });
    return;
  }
  if (req.method === "POST" && pathname === "/api/erp/tickets") {
    const input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    send(res, 201, await createTicket(env, input));
    return;
  }
  const uploaded = pathname.match(/^\/api\/erp\/tickets\/([^/]+)\/files$/);
  if (req.method === "POST" && uploaded) {
    const name = decodeURIComponent(uploaded[1]);
    if (!/^ST-\d{4}-\d+$/.test(name)) throw httpError(400, "Unknown ticket.");
    const filename = requestUrl.searchParams.get("filename") || "attachment";
    const type = String(req.headers["content-type"] || "").split(";")[0].trim();
    const buffer = await readBody(req, 28 * 1024 * 1024);
    send(res, 201, { file: await uploadBuffer(env, name, { filename, type, buffer }) });
    return;
  }
  if (req.method === "GET" && pathname === "/api/erp/file") {
    await sendFile(env, res, requestUrl.searchParams.get("name") || "");
    return;
  }
  send(res, 404, { error: "Not found" });
}

async function loadOptions(env) {
  const [customers, sites, contacts, equipment, fields] = await Promise.all([
    erpList(env, "Customer", { fields: ["name", "customer_name"], orderBy: "customer_name asc" }),
    erpList(env, "Customer Site", { fields: ["name", "customer"], orderBy: "name asc" }),
    erpList(env, "Contact", { fields: ["name", "full_name"], orderBy: "name asc", limit: 200 }),
    erpList(env, "Customer Equipment", { fields: ["name", "customer", "item_name", "serial_no", "equipment_id"] }),
    selectFields(env),
  ]);
  return {
    customers: customers.map((row) => ({ name: row.name, label: row.customer_name || row.name })),
    sites: sites.map((row) => ({ name: row.name, customer: row.customer || "", label: row.name })),
    contacts: contacts.map((row) => ({ name: row.name, label: row.full_name || row.name })),
    equipment: equipment.map((row) => ({
      name: row.name,
      customer: row.customer || "",
      label: [row.name, row.item_name].filter(Boolean).join(" · "),
    })),
    ticketTypes: fields.ticketTypes,
    categories: fields.categories,
    impacts: fields.impacts,
    urgencies: fields.urgencies,
    priorities: fields.priorities,
    sources: fields.sources,
    statuses: fields.statuses,
  };
}

async function loadTickets(env) {
  const rows = await erpList(env, "Service Ticket", { fields: TICKET_FIELDS, orderBy: "modified desc" });
  const files = await loadTicketFiles(env);
  return rows.map((row) => mapTicket(row, files.get(row.name)));
}

async function loadTicket(env, name) {
  if (!/^ST-\d{4}-\d+$/.test(name)) return null;
  const body = await erp(env, `/api/resource/${encodeURIComponent("Service Ticket")}/${encodeURIComponent(name)}`);
  return mapTicket(body.data, await loadTicketFiles(env, name));
}

async function loadTicketFiles(env, name) {
  try {
    const filters = [["attached_to_doctype", "=", "Service Ticket"]];
    if (name) filters.push(["attached_to_name", "=", name]);
    const rows = await erpList(env, "File", {
      fields: ["name", "file_name", "attached_to_name"],
      filters,
      limit: 500,
    });
    if (name) return rows;
    return groupFiles(rows);
  } catch {
    return name ? [] : new Map();
  }
}

async function createTicket(env, input) {
  const options = await selectFields(env);
  const subject = String(input.subject || "").trim();
  const customer = String(input.customer || "").trim();
  if (!subject) throw httpError(400, "Add a subject.");
  if (!customer) throw httpError(400, "Choose a customer.");

  const payload = {
    naming_series: "ST-.YYYY.-.#####",
    customer,
    subject,
  };
  assign(payload, "customer_site", input.customerSite);
  assign(payload, "contact_person", input.contactPerson);
  assign(payload, "contact_email", input.contactEmail);
  assign(payload, "contact_mobile", input.contactMobile);
  assign(payload, "reported_by", input.reportedBy);
  assign(payload, "customer_equipment", input.customerEquipment);
  assignChoice(payload, "ticket_type", input.ticketType, options.ticketTypes, "ticket type");
  assignChoice(payload, "service_category", input.serviceCategory, options.categories, "service category");
  assignChoice(payload, "impact", input.impact, options.impacts, "impact");
  assignChoice(payload, "urgency", input.urgency, options.urgencies, "urgency");
  assignChoice(payload, "priority", input.priority, options.priorities, "priority");
  assignChoice(payload, "source", input.source, options.sources, "source");
  const complaint = String(input.customerComplaint || "").trim();
  const description = String(input.description || "").trim();
  if (complaint) payload.customer_complaint = complaint;
  if (description) payload.description = toHtml(description);

  const created = await erp(env, `/api/resource/${encodeURIComponent("Service Ticket")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { ticket: mapTicket(created.data), warning: "" };
}

async function uploadBuffer(env, docname, { filename, type, buffer }) {
  const kind = mediaKind(filename, type);
  if (!kind) throw httpError(400, "Add a photo or a video.");
  if (!buffer.length) throw httpError(400, "The file is empty.");
  const limit = kind === "video" ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (buffer.length > limit) throw httpError(413, kind === "video" ? "Each video must be under 25 MB." : "Each photo must be under 10 MB.");
  const safeName = safeFilename(filename, type || (kind === "video" ? "video/mp4" : "image/jpeg"));
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: type || "application/octet-stream" }), safeName);
  form.append("doctype", "Service Ticket");
  form.append("docname", docname);
  form.append("is_private", "1");
  const response = await fetch(`${env.url}/api/method/upload_file`, {
    method: "POST",
    headers: { Authorization: `token ${env.token}`, Accept: "application/json" },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, erpMessage(body));
  const uploaded = body.message || {};
  const file = mapFile({ name: uploaded.name, file_name: uploaded.file_name || safeName });
  if (!file) throw httpError(502, "Attachment could not be saved.");
  return file;
}

async function sendFile(env, res, name) {
  if (!/^[\w.-]+$/.test(name)) throw httpError(400, "Unknown file.");
  const doc = await erp(env, `/api/resource/File/${encodeURIComponent(name)}`);
  const fileUrl = doc.data?.file_url;
  if (!fileUrl || !fileUrl.startsWith("/")) throw httpError(404, "File not found.");
  if (doc.data.attached_to_doctype && doc.data.attached_to_doctype !== "Service Ticket") {
    throw httpError(404, "File not found.");
  }
  const download = await fetch(`${env.url}${fileUrl}`, {
    headers: { Authorization: `token ${env.token}` },
  });
  if (!download.ok) throw httpError(download.status, "Could not download the file.");
  const bytes = Buffer.from(await download.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", download.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.end(bytes);
}

async function selectFields(env) {
  try {
    const body = await erp(env, `/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent("Service Ticket")}`);
    const docs = body.docs || body.message?.docs || [];
    const doc = docs.find((item) => item.name === "Service Ticket") || docs[0];
    const fields = doc?.fields || [];
    return {
      ticketTypes: selectOptions(fields, "ticket_type"),
      categories: selectOptions(fields, "service_category").length ? selectOptions(fields, "service_category") : CATEGORY_FALLBACK,
      impacts: selectOptions(fields, "impact"),
      urgencies: selectOptions(fields, "urgency"),
      priorities: selectOptions(fields, "priority").length ? selectOptions(fields, "priority") : PRIORITY_FALLBACK,
      sources: selectOptions(fields, "source"),
      statuses: selectOptions(fields, "status"),
    };
  } catch {
    return {
      ticketTypes: [],
      categories: CATEGORY_FALLBACK,
      impacts: [],
      urgencies: [],
      priorities: PRIORITY_FALLBACK,
      sources: [],
      statuses: [],
    };
  }
}

function selectOptions(fields, fieldname) {
  const field = fields.find((item) => item.fieldname === fieldname);
  if (!field?.options) return [];
  return field.options
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function erpList(env, doctype, { fields, filters, limit = 100, orderBy } = {}) {
  const params = new URLSearchParams();
  if (fields) params.set("fields", JSON.stringify(fields));
  if (filters) params.set("filters", JSON.stringify(filters));
  params.set("limit_page_length", String(limit));
  if (orderBy) params.set("order_by", orderBy);
  const body = await erp(env, `/api/resource/${encodeURIComponent(doctype)}?${params}`);
  return body.data || [];
}

async function erp(env, path, options = {}) {
  const response = await fetch(`${env.url}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${env.token}`,
      Accept: "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, erpMessage(body));
  return body;
}

function mapTicket(doc, files = []) {
  const description = plain(doc.description);
  const customerComplaint = doc.customer_complaint || "";
  const createdAt = toIso(doc.reported_datetime || doc.creation);
  const updatedAt = toIso(doc.modified || doc.reported_datetime || doc.creation);
  return {
    id: doc.name,
    subject: doc.subject || doc.name,
    customer: doc.customer || "",
    customerSite: doc.customer_site || "",
    contactPerson: doc.contact_person || "",
    contactEmail: doc.contact_email || "",
    contactMobile: doc.contact_mobile || "",
    reportedBy: doc.reported_by || "",
    customerEquipment: doc.customer_equipment || "",
    ticketType: doc.ticket_type || "",
    serviceCategory: doc.service_category || "",
    impact: doc.impact || "",
    urgency: doc.urgency || "",
    priority: doc.priority || "",
    source: doc.source || "",
    status: doc.status || "",
    erpStatus: doc.status || "",
    description,
    customerComplaint,
    createdAt,
    updatedAt,
    attachments: (files || []).map(mapFile).filter(Boolean),
    messages: [
      {
        id: `m-${doc.name}`,
        from: "you",
        text: description || customerComplaint || doc.subject || "",
        at: createdAt,
      },
    ],
  };
}

function assign(payload, field, value) {
  const text = String(value || "").trim();
  if (text) payload[field] = text;
}

function assignChoice(payload, field, value, allowed, label) {
  const text = String(value || "").trim();
  if (!text) return;
  if (allowed.length && !allowed.includes(text)) throw httpError(400, `Choose a ${label} from the list.`);
  payload[field] = text;
}

function mapFile(file) {
  const filename = file.file_name || file.name || "";
  const kind = mediaKind(filename, "");
  if (!file.name || !kind) return null;
  return {
    id: file.name,
    name: filename,
    kind,
    type: mimeFor(filename, kind),
    url: `/api/erp/file?name=${encodeURIComponent(file.name)}`,
  };
}

function mediaKind(filename, type) {
  const lower = String(filename || "").toLowerCase();
  const mime = String(type || "").toLowerCase();
  if (mime === "image/svg+xml" || lower.endsWith(".svg")) return "";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(lower)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogg)$/.test(lower)) return "video";
  return "";
}

function mimeFor(filename, kind) {
  const ext = String(filename).split(".").pop().toLowerCase();
  const types = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    ogg: "video/ogg",
  };
  return types[ext] || (kind === "video" ? "video/mp4" : "image/jpeg");
}

function groupFiles(files) {
  const grouped = new Map();
  for (const file of files) {
    const key = file.attached_to_name;
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(file);
    grouped.set(key, list);
  }
  return grouped;
}

function toHtml(text) {
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function plain(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const [date, time = "00:00:00"] = String(value).split(" ");
  return `${date}T${time.split(".")[0]}`;
}

function safeFilename(name, type) {
  const cleaned = String(name || "attachment").replace(/[^\w.-]+/g, "_").slice(0, 80);
  if (/\.[a-z0-9]+$/i.test(cleaned)) return cleaned;
  const extension = type.split("/")[1] || "bin";
  return `${cleaned}.${extension}`;
}

function erpMessage(body) {
  if (body?._server_messages) {
    try {
      const messages = JSON.parse(body._server_messages).map((item) => {
        const parsed = typeof item === "string" ? JSON.parse(item) : item;
        return plain(parsed.message || "");
      });
      const text = messages.filter(Boolean).join(" ");
      if (text) return text;
    } catch {
      /* Fall through to the exception text. */
    }
  }
  if (typeof body?.exception === "string") {
    const text = plain(body.exception).replace(/^[\w.]*Error:\s*/, "");
    if (text) return text;
  }
  return "ERPNext rejected the request.";
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req, max = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(httpError(413, "Request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

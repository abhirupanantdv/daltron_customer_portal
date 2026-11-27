import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(root, "../.env");
const doctypesPath = path.resolve(root, "../config/doctypes.json");
const DOCTYPE_KEYS = ["ticket", "customer", "site", "contact", "equipment", "file"];

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
  "customer_equipment",
  "ticket_type",
  "category",
  "sub_category",
  "service_category",
  "impact",
  "priority",
  "status",
  "description",
  "creation",
  "modified",
  "reported_datetime",
];

function doctypes() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(doctypesPath, "utf8"));
  } catch {
    throw httpError(500, "Doctype library was not found. Check config/doctypes.json.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw httpError(500, "Doctype library must be a JSON object.");
  }
  const names = {};
  for (const key of DOCTYPE_KEYS) {
    const value = String(data[key] || "").trim();
    if (!value) throw httpError(500, `Doctype library is missing "${key}".`);
    names[key] = value;
  }
  return names;
}

const sessions = new Map();
const browserSessions = new Map();

export function erpApi({ url, token, user, password } = {}) {
  const fallback = {
    url: url || "",
    token: token || "",
    user: user || "",
    password: password || "",
  };

  return {
    name: "erp-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || "/", "http://localhost");
        if (!requestUrl.pathname.startsWith("/api/erp")) return next();
        try {
          const env = currentEnv(fallback);
          await route(env, req, res, requestUrl);
        } catch (error) {
          send(res, error.status || 502, { error: error.message || "ERPNext request failed" });
        }
      });
    },
  };
}

function currentEnv(fallback) {
  const file = readDotEnv(envPath);
  return {
    url: (file.ERPNEXT_URL ?? fallback.url).replace(/\/$/, ""),
    token: file.ERPNEXT_TOKEN ?? fallback.token,
    user: file.ERPNEXT_USER ?? fallback.user,
    password: file.ERPNEXT_PASSWORD ?? fallback.password,
  };
}

function envReady(env) {
  if (!env.url) return false;
  if (env.user && env.password) return true;
  return Boolean(env.token);
}

function readDotEnv(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return {};
  }
  const values = {};
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function usesSession(env) {
  return Boolean(env.user && env.password);
}

function serverKey(env) {
  return `${env.url}\n${env.user || ""}\n${env.token || ""}`;
}

function urlFromKey(key) {
  return key.split("\n")[0];
}

function rememberCookies(jar, setCookies) {
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(";").map((part) => part.trim());
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    let expiresAt = 0;
    let maxAge = null;
    for (const attr of attrs) {
      const [rawKey, ...rest] = attr.split("=");
      const key = rawKey.toLowerCase();
      const attrValue = rest.join("=");
      if (key === "max-age") maxAge = Number(attrValue);
      if (key === "expires") expiresAt = Date.parse(attrValue) || 0;
    }
    if (maxAge !== null && Number.isFinite(maxAge)) expiresAt = Date.now() + maxAge * 1000;
    jar.set(name, { value, expiresAt });
  }
}

function cookieHeader(jar) {
  const now = Date.now();
  return [...jar.entries()]
    .filter(([, item]) => item.value && (!item.expiresAt || item.expiresAt > now))
    .map(([name, item]) => `${name}=${item.value}`)
    .join("; ");
}

function setCookiesFrom(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  return [];
}

function sessionLive(session) {
  const sid = session?.jar.get("sid");
  if (!sid?.value) return false;
  return !sid.expiresAt || sid.expiresAt > Date.now();
}

async function loginToServer(env) {
  const result = await loginWithCredentials(env.url, { usr: env.user, pwd: env.password });
  if (result.status !== "ok") throw httpError(401, "Login failed");
  return result.session;
}

async function loginWithCredentials(url, { usr, pwd, otp, tmpId }) {
  const params = new URLSearchParams({ usr, pwd });
  if (otp) params.set("otp", otp);
  if (tmpId) params.set("tmp_id", tmpId);
  const response = await fetch(`${url}/api/method/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.verification && payload.message !== "Logged In") {
    return {
      status: "otp",
      prompt: payload.verification.prompt || payload.verification.method || "Enter the verification code",
      tmpId: payload.tmp_id || "",
    };
  }
  if (!response.ok || payload.message !== "Logged In") {
    const message = typeof payload.message === "string" && payload.message !== "Logged In" ? payload.message : erpMessage(payload);
    throw httpError(response.status || 401, message || "Those credentials were not accepted.");
  }
  const jar = new Map();
  rememberCookies(jar, setCookiesFrom(response));
  if (!jar.get("sid")?.value) throw httpError(401, "Login did not return a session.");
  const session = { jar };
  const logged = await loggedUser(url, { Cookie: cookieHeader(session.jar) });
  const user = logged || cookieText(jar.get("user_id")?.value) || usr;
  const fullName = cookieText(jar.get("full_name")?.value) || payload.full_name || user;
  return { status: "ok", session, user, fullName };
}

async function loggedUser(url, headers) {
  try {
    const response = await fetch(`${url}/api/method/frappe.auth.get_logged_user`, {
      headers: { Accept: "application/json", ...headers },
    });
    const payload = await response.json().catch(() => ({}));
    const user = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!response.ok || !user || user === "Guest") return "";
    return user;
  } catch {
    return "";
  }
}

async function loggedUserForEnv(env) {
  if (env.user && env.password) {
    const session = await ensureSession(env);
    if (session) {
      const user = await loggedUser(env.url, { Cookie: cookieHeader(session.jar) });
      if (user) return user;
      return env.user;
    }
  }
  if (!env.token) return "";
  return loggedUser(env.url, { Authorization: `token ${env.token}` });
}

function cookieText(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== name) continue;
    const value = rest.join("=");
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}

function setDevCookie(req, res, value, maxAge) {
  const secure = req.socket?.encrypted ? "; Secure" : "";
  res.setHeader("Set-Cookie", `erp_dev=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function browserSessionFor(req, url) {
  const id = readCookie(req, "erp_dev");
  if (!id) return null;
  const entry = browserSessions.get(id);
  if (!entry || entry.url !== url || !sessionLive(entry.session)) {
    if (entry) browserSessions.delete(id);
    return null;
  }
  return { ...entry, id };
}

async function scopeEnv(env, req) {
  const entry = browserSessionFor(req, env.url);
  if (entry) {
    return {
      ...env,
      token: "",
      _browser: true,
      _browserId: entry.id,
      _portalUser: entry.user,
      _session: entry.session,
    };
  }
  if (!envReady(env)) return null;
  const user = await loggedUserForEnv(env);
  return user ? { ...env, _portalUser: user } : env;
}

async function handleLogin(env, req, res) {
  if (!env.url) throw httpError(500, "ERPNext is not configured. Add ERPNEXT_URL to .env.");
  let input = {};
  try {
    input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  } catch {
    throw httpError(400, "Enter your email and password.");
  }
  const usr = String(input.usr || "").trim();
  const pwd = String(input.pwd || "");
  const otp = String(input.otp || "").trim();
  const tmpId = String(input.tmpId || "").trim();
  if (!usr || !pwd) throw httpError(400, "Enter your email and password.");
  if (usr.length > 320 || pwd.length > 4096 || otp.length > 32 || tmpId.length > 256) {
    throw httpError(400, "Those credentials were not accepted.");
  }
  const result = await loginWithCredentials(env.url, { usr, pwd, otp, tmpId });
  if (result.status === "otp") {
    send(res, 200, { status: "otp", prompt: result.prompt, tmpId: result.tmpId });
    return;
  }
  if (browserSessions.size >= 40) {
    const oldest = browserSessions.keys().next().value;
    if (oldest) browserSessions.delete(oldest);
  }
  const id = randomBytes(24).toString("hex");
  browserSessions.set(id, {
    session: result.session,
    user: result.user,
    fullName: result.fullName,
    url: env.url,
  });
  setDevCookie(req, res, id, 60 * 60 * 12);
  send(res, 200, { status: "ok", user: result.user, fullName: result.fullName });
}

async function handleLogout(env, req, res) {
  const id = readCookie(req, "erp_dev");
  const entry = id ? browserSessions.get(id) : null;
  if (id) browserSessions.delete(id);
  if (entry?.session && env.url) await logoutSession(env.url, entry.session);
  setDevCookie(req, res, "", 0);
  send(res, 200, { ok: true });
}

async function logoutSession(url, session) {
  const cookie = cookieHeader(session.jar);
  if (!cookie) return;
  try {
    await fetch(`${url}/api/method/logout`, {
      method: "GET",
      headers: { Accept: "application/json", Cookie: cookie },
      redirect: "manual",
    });
  } catch {
    // A closed old server should not block the next login.
  }
}

async function retireOtherSessions(env) {
  const key = serverKey(env);
  const stale = [];
  for (const [storedKey, entry] of sessions) {
    if (storedKey === key || !entry.session) continue;
    stale.push([storedKey, entry.session]);
  }
  for (const [storedKey, session] of stale) {
    sessions.delete(storedKey);
    await logoutSession(urlFromKey(storedKey), session);
  }
}

async function ensureSession(env) {
  if (env._session) return env._session;
  if (!usesSession(env)) return null;
  const key = serverKey(env);
  const cached = sessions.get(key);
  if (cached?.session) {
    if (sessionLive(cached.session)) return cached.session;
    sessions.delete(key);
  } else if (cached?.pending) {
    return cached.pending;
  }
  const pending = loginToServer(env).then((session) => {
    if (sessions.get(key)?.pending !== pending) return session;
    sessions.set(key, { session });
    return session;
  });
  sessions.set(key, { pending });
  try {
    return await pending;
  } catch (error) {
    if (sessions.get(key)?.pending === pending) sessions.delete(key);
    throw error;
  }
}

function dropSession(env) {
  sessions.delete(serverKey(env));
}

function absorbCookies(env, response) {
  const session = env._session || (usesSession(env) ? sessions.get(serverKey(env))?.session : null);
  if (!session) return;
  rememberCookies(session.jar, setCookiesFrom(response));
}

async function authHeaders(env, { method = "GET", headers = {} } = {}) {
  await retireOtherSessions(env);
  const session = await ensureSession(env);
  if (!session) {
    return { Accept: "application/json", Authorization: `token ${env.token}`, ...headers };
  }
  const next = {
    Accept: "application/json",
    Cookie: cookieHeader(session.jar),
    ...headers,
  };
  const csrf = cookieText(session.jar.get("csrf_token")?.value || "");
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) next["X-Frappe-CSRF-Token"] = csrf;
  return next;
}

async function erpFetch(env, requestPath, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const run = async () => {
    const headers = await authHeaders(env, { method, headers: options.headers });
    const response = await fetch(`${env.url}${requestPath}`, {
      ...options,
      method,
      headers,
    });
    absorbCookies(env, response);
    return response;
  };

  const response = await run();
  if (env._browser) {
    if (response.status === 401 && env._browserId) browserSessions.delete(env._browserId);
    return response;
  }
  if (!usesSession(env) || response.status !== 401) return response;
  dropSession(env);
  return run();
}

async function route(env, req, res, requestUrl) {
  const { pathname } = requestUrl;
  if (req.method === "POST" && pathname === "/api/erp/login") {
    await handleLogin(env, req, res);
    return;
  }
  if (req.method === "GET" && pathname === "/api/erp/session") {
    const entry = browserSessionFor(req, env.url);
    if (!entry) {
      send(res, 401, { error: "Sign in to continue." });
      return;
    }
    send(res, 200, { user: entry.user, fullName: entry.fullName });
    return;
  }
  if (req.method === "POST" && pathname === "/api/erp/logout") {
    await handleLogout(env, req, res);
    return;
  }
  const scoped = await scopeEnv(env, req);
  if (!scoped) {
    if (!env.url) {
      send(res, 500, { error: "ERPNext is not configured. Add ERPNEXT_URL to .env." });
      return;
    }
    send(res, 401, { error: "Sign in to continue." });
    return;
  }
  env = scoped;
  if (req.method === "GET" && pathname === "/api/erp/options") {
    send(res, 200, await loadOptions(env));
    return;
  }
  if (req.method === "GET" && pathname === "/api/erp/notifications") {
    const body = await erp(env, "/api/method/ticket_system.api.get_notifications");
    send(res, 200, body.message ?? body);
    return;
  }
  if (req.method === "POST" && pathname === "/api/erp/notifications/read") {
    const input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const body = await erp(env, "/api/method/ticket_system.api.mark_notification_read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name || "" }),
    });
    send(res, 200, body.message ?? body);
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
  const replied = pathname.match(/^\/api\/erp\/tickets\/([^/]+)\/reply$/);
  if (req.method === "POST" && replied) {
    const name = decodeURIComponent(replied[1]);
    if (!/^ST-\d{4}-\d+$/.test(name)) throw httpError(400, "Unknown ticket.");
    const input = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const body = await erp(env, "/api/method/ticket_system.api.reply_ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: name, message: input.message || "" }),
    });
    send(res, 200, body.message ?? body);
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

async function portalCustomer(env) {
  try {
    const body = await erp(env, "/api/method/ticket_system.api.portal_customer");
    return String(body.message || "").trim();
  } catch (error) {
    if (!methodMissing(error)) throw error;
  }
  return portalCustomerFromResources(env);
}

function methodMissing(error) {
  const message = String(error?.message || "");
  return error?.status === 404 || /failed to get method|has no attribute/i.test(message);
}

async function accountIds(env, user) {
  const ids = [];
  const add = (value) => {
    const text = String(value || "").trim();
    if (!text || ids.some((item) => item.toLowerCase() === text.toLowerCase())) return;
    ids.push(text);
  };
  add(user);
  if (!user) return ids;
  try {
    const body = await erp(env, `/api/resource/User/${encodeURIComponent(user)}`);
    add(body.data?.name);
    add(body.data?.email);
    add(body.data?.username);
  } catch {
    // A hidden User record still leaves the signed-in id for the Portal User match.
  }
  return ids;
}

async function portalCustomerFromResources(env) {
  const user = String(env._portalUser || "").trim();
  if (!user) return "";
  const names = doctypes();
  const ids = await accountIds(env, user);
  const emails = ids.filter((item) => item.includes("@"));

  const portalParent = await firstRow(env, "Portal User", ["parent"], [
    ["parenttype", "=", names.customer],
    ["user", "in", ids],
  ]);
  if (portalParent?.parent) return portalParent.parent;

  for (const email of emails) {
    const byEmail = await firstRow(env, names.customer, ["name"], [["email_id", "=", email]]);
    if (byEmail?.name) return byEmail.name;
  }

  let contactName = "";
  for (const id of ids) {
    contactName = (await firstRow(env, names.contact, ["name"], [["user", "=", id]]))?.name || "";
    if (contactName) break;
  }
  if (!contactName) {
    for (const email of emails) {
      contactName = (await firstRow(env, names.contact, ["name"], [["email_id", "=", email]]))?.name || "";
      if (contactName) break;
      contactName =
        (
          await firstRow(env, "Contact Email", ["parent"], [
            ["email_id", "=", email],
            ["parenttype", "=", names.contact],
          ])
        )?.parent || "";
      if (contactName) break;
    }
  }
  if (!contactName) return "";

  const primary = await firstRow(env, names.customer, ["name"], [["customer_primary_contact", "=", contactName]]);
  if (primary?.name) return primary.name;

  try {
    const doc = await erp(env, `/api/resource/${encodeURIComponent(names.contact)}/${encodeURIComponent(contactName)}`);
    const link = (doc.data?.links || []).find((row) => row.link_doctype === names.customer && row.link_name);
    if (link?.link_name) return link.link_name;
  } catch {
    // This contact's customer link is not readable through the resource API.
  }
  return "";
}

async function firstRow(env, doctype, fields, filters) {
  try {
    const rows = await erpList(env, doctype, { fields, filters, limit: 1 });
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function loadOptions(env) {
  const warnings = [];
  const fields = await selectFields(env, doctypes().ticket);
  warnings.push(...(fields.warnings || []));
  const masters = await loadMasters(env, warnings);
  return {
    customers: [],
    sites: [],
    contacts: [],
    equipment: [],
    ticketTypes: fields.ticketTypes,
    categories: fields.categories,
    ticketCategories: masters.ticketCategories,
    subCategories: masters.subCategories,
    impacts: fields.impacts,
    priorities: fields.priorities,
    statuses: fields.statuses,
    warnings: warnings.join(" "),
  };
}

async function loadTickets(env) {
  const customer = await portalCustomer(env);
  if (!customer) return [];
  const rows = await erpList(env, doctypes().ticket, {
    fields: TICKET_FIELDS,
    filters: [["customer", "=", customer]],
    orderBy: "modified desc",
  });
  const files = await loadTicketFiles(env);
  const labels = await subCategoryLabels(env, rows.map((row) => row.sub_category));
  const comments = await loadComments(env, rows.map((row) => row.name));
  const user = env._portalUser || "";
  return rows.map((row) => mapTicket(row, files.get(row.name), labels, comments.get(row.name) || [], user));
}

async function loadTicket(env, name) {
  if (!/^ST-\d{4}-\d+$/.test(name)) return null;
  const customer = await portalCustomer(env);
  if (!customer) return null;
  const ticket = doctypes().ticket;
  const body = await erp(env, `/api/resource/${encodeURIComponent(ticket)}/${encodeURIComponent(name)}`);
  if (body.data?.customer !== customer) return null;
  const comments = await loadComments(env, [name]);
  return mapTicket(
    body.data,
    await loadTicketFiles(env, name),
    await subCategoryLabels(env, [body.data?.sub_category]),
    comments.get(name) || [],
    env._portalUser || "",
  );
}

async function loadTicketFiles(env, name) {
  const names = doctypes();
  try {
    const filters = [["attached_to_doctype", "=", names.ticket]];
    if (name) filters.push(["attached_to_name", "=", name]);
    const rows = await erpList(env, names.file, {
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
  const customer = await portalCustomer(env);
  if (!subject) throw httpError(400, "Add a subject.");
  if (!customer) throw httpError(403, "This account is not linked to a customer.");

  const payload = {
    naming_series: "ST-.YYYY.-.#####",
    customer,
    subject,
  };
  assign(payload, "customer_site", input.customerSite);
  assign(payload, "contact_person", input.contactPerson);
  const portalEmail = String(env._portalUser || "").trim();
  assign(payload, "contact_email", portalEmail.includes("@") ? portalEmail : "");
  assign(payload, "contact_mobile", input.contactMobile);
  assign(payload, "customer_equipment", input.customerEquipment);
  assignChoice(payload, "ticket_type", input.ticketType, options.ticketTypes, "ticket type");
  const masters = await loadMasters(env, []);
  const category = String(input.category || "").trim();
  const subCategory = String(input.subCategory || "").trim();
  if (category) {
    if (!masters.ticketCategories.some((row) => row.name === category)) throw httpError(400, "Choose a category from the list.");
    payload.category = category;
  }
  if (subCategory) {
    const match = masters.subCategories.find((row) => row.name === subCategory);
    if (!category || !match || match.category !== category) throw httpError(400, "Choose a sub category from the list.");
    payload.sub_category = subCategory;
  }
  assignChoice(payload, "service_category", input.serviceCategory, options.categories, "service category");
  assignChoice(payload, "impact", input.impact, options.impacts, "impact");
  assignChoice(payload, "priority", input.priority, options.priorities, "priority");
  const description = String(input.description || "").trim();
  if (description) payload.description = toHtml(description);

  const created = await erp(env, `/api/resource/${encodeURIComponent(doctypes().ticket)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { ticket: mapTicket(created.data, [], await subCategoryLabels(env, [created.data?.sub_category])), warning: "" };
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
  form.append("doctype", doctypes().ticket);
  form.append("docname", docname);
  form.append("is_private", "1");
  const response = await erpFetch(env, "/api/method/upload_file", {
    method: "POST",
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
  const names = doctypes();
  const doc = await erp(env, `/api/resource/${encodeURIComponent(names.file)}/${encodeURIComponent(name)}`);
  const fileUrl = doc.data?.file_url;
  if (!fileUrl || !fileUrl.startsWith("/")) throw httpError(404, "File not found.");
  if (doc.data.attached_to_doctype && doc.data.attached_to_doctype !== names.ticket) {
    throw httpError(404, "File not found.");
  }
  const download = await erpFetch(env, fileUrl, {
    headers: { Accept: "*/*" },
  });
  if (!download.ok) throw httpError(download.status, "Could not download the file.");
  const bytes = Buffer.from(await download.arrayBuffer());
  res.statusCode = 200;
  res.setHeader("Content-Type", download.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.end(bytes);
}

async function selectFields(env, ticket = doctypes().ticket) {
  const warnings = [];
  try {
    const body = await erp(env, `/api/method/frappe.desk.form.load.getdoctype?doctype=${encodeURIComponent(ticket)}`);
    const docs = body.docs || body.message?.docs || [];
    const doc = docs.find((item) => item.name === ticket) || docs[0];
    const fields = doc?.fields || [];
    const [ticketTypes, categories, impacts, priorities, statuses] = await Promise.all([
      choiceValues(env, fields, "ticket_type", warnings, "ticket types"),
      choiceValues(env, fields, "service_category", warnings, "categories", CATEGORY_FALLBACK),
      choiceValues(env, fields, "impact", warnings, "impacts"),
      choiceValues(env, fields, "priority", warnings, "priorities", PRIORITY_FALLBACK),
      choiceValues(env, fields, "status", warnings, "statuses"),
    ]);
    return { ticketTypes, categories, impacts, priorities, statuses, warnings };
  } catch {
    warnings.push("Could not load ticket fields.");
    return {
      ticketTypes: [],
      categories: CATEGORY_FALLBACK,
      impacts: [],
      priorities: PRIORITY_FALLBACK,
      statuses: [],
      warnings,
    };
  }
}

async function choiceValues(env, fields, fieldname, warnings, label, fallback = null) {
  const field = fields.find((item) => item.fieldname === fieldname);
  if (!field) return fallback ? [...fallback] : [];
  if (field.fieldtype === "Link" && field.options) {
    try {
      const rows = await erpList(env, field.options, { fields: ["name"], orderBy: "name asc", limit: 200 });
      return rows.map((row) => row.name).filter(Boolean);
    } catch {
      warnings.push(`Could not load ${label}.`);
      return [];
    }
  }
  if (field.fieldtype !== "Select") return fallback ? [...fallback] : [];
  const values = String(field.options || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length && fallback) return [...fallback];
  return values;
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

async function erp(env, requestPath, options = {}) {
  const response = await erpFetch(env, requestPath, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status, erpMessage(body));
  return body;
}

async function loadMasters(env, warnings) {
  const masters = { ticketCategories: [], subCategories: [] };
  try {
    const rows = await erpList(env, "Category", { fields: ["name"], orderBy: "name asc", limit: 200 });
    masters.ticketCategories = rows.map((row) => ({ name: row.name, label: row.name }));
  } catch {
    warnings.push("Could not load ticket categories.");
  }
  try {
    const rows = await erpList(env, "Sub Category", {
      fields: ["name", "sub_category_name", "category"],
      orderBy: "sub_category_name asc",
      limit: 500,
    });
    masters.subCategories = rows.map((row) => ({
      name: row.name,
      label: row.sub_category_name || row.name,
      category: row.category || "",
    }));
  } catch {
    warnings.push("Could not load sub categories.");
  }
  return masters;
}

async function subCategoryLabels(env, names) {
  const wanted = [...new Set(names.filter(Boolean))];
  if (!wanted.length) return new Map();
  try {
    const rows = await erpList(env, "Sub Category", {
      fields: ["name", "sub_category_name"],
      filters: [["name", "in", wanted]],
      limit: wanted.length,
    });
    return new Map(rows.map((row) => [row.name, row.sub_category_name || row.name]));
  } catch {
    return new Map();
  }
}

async function loadComments(env, names) {
  const wanted = names.filter(Boolean);
  const grouped = new Map();
  if (!wanted.length) return grouped;
  try {
    const rows = await erpList(env, "Comment", {
      fields: ["name", "content", "creation", "comment_by", "comment_email", "reference_name", "owner"],
      filters: [
        ["reference_doctype", "=", doctypes().ticket],
        ["reference_name", "in", wanted],
        ["comment_type", "=", "Comment"],
      ],
      limit: 500,
      orderBy: "creation asc",
    });
    for (const row of rows) {
      if (!String(row.comment_by || "").trim() || !row.reference_name) continue;
      const list = grouped.get(row.reference_name) || [];
      list.push(row);
      grouped.set(row.reference_name, list);
    }
  } catch {
    return grouped;
  }
  return grouped;
}

function threadMessages(comments, portalUser) {
  const user = String(portalUser || "").trim().toLowerCase();
  const messages = [];
  for (const comment of comments || []) {
    if (!String(comment.comment_by || "").trim()) continue;
    const text = plain(comment.content);
    if (!text) continue;
    const owner = String(comment.owner || "").trim().toLowerCase();
    const email = String(comment.comment_email || "").trim().toLowerCase();
    const mine = Boolean(user) && (owner === user || email === user);
    messages.push({
      id: comment.name,
      from: mine ? "you" : "support",
      author: mine ? "" : String(comment.comment_by || "").trim(),
      text,
      at: toIso(comment.creation),
    });
  }
  return messages;
}

function mapTicket(doc, files = [], subLabels = new Map(), comments = [], portalUser = "") {
  const description = plain(doc.description);
  const createdAt = toIso(doc.reported_datetime || doc.creation);
  const updatedAt = toIso(doc.modified || doc.reported_datetime || doc.creation);
  const subCategory = doc.sub_category || "";
  return {
    id: doc.name,
    subject: doc.subject || doc.name,
    customer: doc.customer || "",
    customerSite: doc.customer_site || "",
    contactPerson: doc.contact_person || "",
    contactEmail: doc.contact_email || "",
    contactMobile: doc.contact_mobile || "",
    customerEquipment: doc.customer_equipment || "",
    ticketType: doc.ticket_type || "",
    category: doc.category || "",
    subCategory,
    subCategoryLabel: subLabels.get(subCategory) || subCategory,
    serviceCategory: doc.service_category || "",
    impact: doc.impact || "",
    priority: doc.priority || "",
    status: doc.status || "",
    erpStatus: doc.status || "",
    description,
    createdAt,
    updatedAt,
    attachments: (files || []).map(mapFile).filter(Boolean),
    messages: threadMessages(comments, portalUser),
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

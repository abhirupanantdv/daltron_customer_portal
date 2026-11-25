import json
import re
from pathlib import Path

import frappe
from frappe import _
from frappe.query_builder import Criterion
from frappe.query_builder.functions import Lower
from frappe.utils.file_manager import save_file

DOCTYPES_PATH = Path(__file__).resolve().parent.parent / "config" / "doctypes.json"
DOCTYPE_KEYS = ("ticket", "customer", "site", "contact", "equipment", "file")

TICKET_FIELDS = [
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
]

CATEGORY_FALLBACK = ["Network", "Cabling", "Power", "Application", "Hardware", "Printer", "Software", "Connectivity", "Other"]
PRIORITY_FALLBACK = ["Critical", "High", "Medium", "Low"]
TICKET_NAME = re.compile(r"^ST-\d{4}-\d+$")
FILE_NAME = re.compile(r"^[\w.-]+$")


def _doctypes():
    try:
        data = json.loads(DOCTYPES_PATH.read_text(encoding="utf-8"))
    except OSError:
        frappe.throw(_("Doctype library was not found at {0}.").format(DOCTYPES_PATH))
    except json.JSONDecodeError:
        frappe.throw(_("Doctype library at {0} is not valid JSON.").format(DOCTYPES_PATH))
    if not isinstance(data, dict):
        frappe.throw(_("Doctype library at {0} must be a JSON object.").format(DOCTYPES_PATH))
    names = {}
    for key in DOCTYPE_KEYS:
        value = str(data.get(key) or "").strip()
        if not value:
            frappe.throw(_("Doctype library is missing {0}.").format(key))
        names[key] = value
    return names


def check_app_permission():
    if frappe.session.user == "Guest":
        return False
    if "System Manager" in frappe.get_roles():
        return True
    ticket = _doctypes()["ticket"]
    if not frappe.db.exists("DocType", ticket):
        return False
    return bool(frappe.has_permission(ticket, "read"))


def _portal_customer():
    user = frappe.session.user
    if not user or user == "Guest":
        return ""
    names = _doctypes()
    customer_doctype = names["customer"]
    ids = _account_ids(user)
    emails = _portal_emails(ids)

    found = _customer_from_portal_user(ids, customer_doctype)
    if found:
        return found
    found = _customer_by_email(customer_doctype, emails)
    if found:
        return found

    contacts = _portal_contacts(ids, emails, names["contact"])
    customers = set()
    for contact in contacts:
        found = _customer_from_primary_contact(customer_doctype, contact)
        if not found:
            found = _customer_from_contact_link(names["contact"], contact, customer_doctype)
        if found:
            customers.add(found)
    if len(customers) == 1:
        return customers.pop()
    if customers:
        return ""
    return _customer_from_ticket_email(ids, customer_doctype, names["ticket"])


def _account_ids(user):
    ids = []

    def add(value):
        text = str(value or "").strip()
        if not text or any(text.lower() == existing.lower() for existing in ids):
            return
        ids.append(text)

    add(user)
    if not user or user == "Guest" or not frappe.db.exists("DocType", "User"):
        return ids

    meta = frappe.get_meta("User")
    name = user if frappe.db.exists("User", user) else ""
    if not name and meta.has_field("username"):
        name = frappe.db.get_value("User", {"username": user}, "name") or ""
    if not name and meta.has_field("email") and "@" in user:
        name = frappe.db.get_value("User", {"email": user}, "name") or ""
    if not name:
        return ids

    add(name)
    fields = [field for field in ("email", "username") if meta.has_field(field)]
    if not fields:
        return ids
    values = frappe.db.get_value("User", name, fields)
    if values is None:
        return ids
    if len(fields) == 1:
        values = (values,)
    for value in values:
        add(value)
    return ids


def _portal_emails(ids):
    return [item for item in ids if "@" in item]


def _customer_from_portal_user(ids, customer_doctype):
    if not ids or not frappe.db.exists("DocType", "Portal User"):
        return ""
    meta = frappe.get_meta("Portal User")
    if not meta.istable or not meta.has_field("user"):
        return ""
    if not frappe.db.exists("DocType", customer_doctype):
        return ""
    lowered = tuple(dict.fromkeys(item.lower() for item in ids))
    rows = frappe.db.sql(
        """
        select parent
        from `tabPortal User`
        where parenttype = %s and lower(`user`) in %s
        limit 2
        """,
        (customer_doctype, lowered),
    )
    found = rows[0][0] if len(rows) == 1 else ""
    if found and frappe.db.exists(customer_doctype, found):
        return found
    return ""


def _customer_by_email(customer_doctype, emails):
    if not emails or not frappe.db.exists("DocType", customer_doctype):
        return ""
    if not frappe.get_meta(customer_doctype).has_field("email_id"):
        return ""
    customer = frappe.qb.DocType(customer_doctype)
    matches = (
        frappe.qb.from_(customer)
        .select(customer.name)
        .where(Lower(customer.email_id).isin([email.lower() for email in emails]))
        .limit(2)
        .run(pluck=True)
    )
    return matches[0] if len(matches) == 1 else ""


def _customer_from_ticket_email(ids, customer_doctype, ticket_doctype):
    emails = _portal_emails(ids)
    if not emails or not frappe.db.exists("DocType", ticket_doctype):
        return ""
    meta = frappe.get_meta(ticket_doctype)
    if not meta.has_field("customer") or not meta.has_field("contact_email"):
        return ""
    ticket = frappe.qb.DocType(ticket_doctype)
    matches = (
        frappe.qb.from_(ticket)
        .select(ticket.customer)
        .distinct()
        .where(
            Lower(ticket.contact_email).isin([email.lower() for email in emails])
            & (ticket.customer != "")
        )
        .limit(2)
        .run(pluck=True)
    )
    found = matches[0] if len(matches) == 1 else ""
    if found and frappe.db.exists(customer_doctype, found):
        return found
    return ""


def _portal_contacts(ids, emails, contact_doctype):
    if not frappe.db.exists("DocType", contact_doctype):
        return []
    meta = frappe.get_meta(contact_doctype)
    contact = frappe.qb.DocType(contact_doctype)
    query = frappe.qb.from_(contact).select(contact.name).distinct()
    lowered_ids = [item.lower() for item in ids]
    lowered_emails = [item.lower() for item in emails]
    conditions = []
    if lowered_ids and meta.has_field("user"):
        conditions.append(Lower(contact.user).isin(lowered_ids))
    if lowered_emails and meta.has_field("email_id"):
        conditions.append(Lower(contact.email_id).isin(lowered_emails))
    if lowered_emails and frappe.db.exists("DocType", "Contact Email"):
        contact_email = frappe.qb.DocType("Contact Email")
        query = query.left_join(contact_email).on(
            (contact_email.parent == contact.name) & (contact_email.parenttype == contact_doctype)
        )
        conditions.append(Lower(contact_email.email_id).isin(lowered_emails))
    if not conditions:
        return []
    return query.where(Criterion.any(conditions)).run(pluck=True)


def _customer_from_primary_contact(customer_doctype, contact):
    if not frappe.db.exists("DocType", customer_doctype):
        return ""
    if not frappe.get_meta(customer_doctype).has_field("customer_primary_contact"):
        return ""
    matches = frappe.get_all(
        customer_doctype,
        filters={"customer_primary_contact": contact},
        pluck="name",
        limit_page_length=2,
    )
    return matches[0] if len(matches) == 1 else ""


def _customer_from_contact_link(contact_doctype, contact, customer_doctype):
    if not frappe.db.exists("DocType", "Dynamic Link") or not frappe.db.exists("DocType", customer_doctype):
        return ""
    matches = frappe.get_all(
        "Dynamic Link",
        filters={"parent": contact, "parenttype": contact_doctype, "link_doctype": customer_doctype},
        pluck="link_name",
        limit_page_length=2,
    )
    found = matches[0] if len(matches) == 1 else ""
    if found and frappe.db.exists(customer_doctype, found):
        return found
    return ""


def _portal_user_email():
    user = frappe.session.user
    if not user or user == "Guest":
        return ""
    emails = _portal_emails(_account_ids(user))
    return emails[0] if emails else ""


@frappe.whitelist()
def portal_customer():
    if not frappe.session.user or frappe.session.user == "Guest":
        frappe.throw(_("Sign in to continue."), frappe.PermissionError)
    return _portal_customer()


@frappe.whitelist()
def get_options():
    meta = _ticket_meta()
    warnings = []

    def load(label, loader):
        try:
            return loader()
        except Exception:
            warnings.append(_("Could not load {0}.").format(label))
            return []

    return {
        "customers": [],
        "sites": [],
        "contacts": [],
        "equipment": [],
        "ticketTypes": load("ticket types", lambda: _choice_options(meta, "ticket_type")),
        "categories": load("categories", lambda: _choice_or_fallback(meta, "service_category", CATEGORY_FALLBACK)),
        "impacts": load("impacts", lambda: _choice_options(meta, "impact")),
        "urgencies": load("urgencies", lambda: _choice_options(meta, "urgency")),
        "priorities": load("priorities", lambda: _choice_or_fallback(meta, "priority", PRIORITY_FALLBACK)),
        "sources": load("sources", lambda: _choice_options(meta, "source")),
        "statuses": load("statuses", lambda: _choice_options(meta, "status")),
        "warnings": " ".join(str(item) for item in warnings),
    }


@frappe.whitelist()
def get_tickets():
    meta = _ticket_meta()
    customer = _portal_customer()
    if not customer:
        frappe.throw(_("This account is not linked to a customer."), frappe.PermissionError)
    fields = _present_fields(meta, TICKET_FIELDS)
    rows = frappe.get_list(
        _doctypes()["ticket"],
        fields=fields,
        filters={"customer": customer},
        order_by="modified desc",
        limit_page_length=100,
    )
    files = _files_for([row.name for row in rows])
    return {"tickets": [_map_ticket(row, files.get(row.name, [])) for row in rows]}


@frappe.whitelist()
def create_ticket():
    meta = _ticket_meta()
    data = _request_data()
    subject = str(data.get("subject") or "").strip()
    customer = _portal_customer()
    if not subject:
        frappe.throw(_("Add a subject."))
    if not customer:
        frappe.throw(_("This account is not linked to a customer."), frappe.PermissionError)

    payload = {"doctype": _doctypes()["ticket"], "customer": customer, "subject": subject}
    series = "ST-.YYYY.-.#####"
    series_field = meta.get_field("naming_series")
    if series_field:
        allowed = _lines(series_field.options)
        if not allowed or series in allowed:
            payload["naming_series"] = series

    _assign(payload, meta, "customer_site", data.get("customerSite"))
    _assign(payload, meta, "contact_person", data.get("contactPerson"))
    _assign(payload, meta, "contact_email", _portal_user_email())
    _assign(payload, meta, "contact_mobile", data.get("contactMobile"))
    _assign(payload, meta, "reported_by", data.get("reportedBy"))
    _assign(payload, meta, "customer_equipment", data.get("customerEquipment"))
    _assign_choice(payload, meta, "ticket_type", data.get("ticketType"), "ticket type")
    _assign_choice(payload, meta, "service_category", data.get("serviceCategory"), "service category")
    _assign_choice(payload, meta, "impact", data.get("impact"), "impact")
    _assign_choice(payload, meta, "urgency", data.get("urgency"), "urgency")
    _assign_choice(payload, meta, "priority", data.get("priority"), "priority")
    _assign_choice(payload, meta, "source", data.get("source"), "source")

    complaint = str(data.get("customerComplaint") or "").strip()
    description = str(data.get("description") or "").strip()
    if complaint and meta.has_field("customer_complaint"):
        payload["customer_complaint"] = complaint
    if description and meta.has_field("description"):
        payload["description"] = _to_html(description)

    doc = frappe.get_doc(payload)
    doc.insert()
    return {"ticket": _map_ticket(doc.as_dict(), []), "warning": ""}


@frappe.whitelist()
def upload_ticket_file():
    ticket = str(frappe.form_dict.get("ticket") or "").strip()
    if not TICKET_NAME.match(ticket):
        frappe.throw(_("Unknown ticket."))
    ticket_doctype = _doctypes()["ticket"]
    if not frappe.db.exists(ticket_doctype, ticket):
        frappe.throw(_("Ticket not found"), frappe.DoesNotExistError)
    if not frappe.has_permission(ticket_doctype, "write", doc=ticket):
        frappe.throw(_("You cannot update this ticket."), frappe.PermissionError)

    uploaded = frappe.request.files.get("file") if frappe.request else None
    if not uploaded:
        frappe.throw(_("Add a photo or a video."))
    filename = uploaded.filename or "attachment"
    mime = (uploaded.content_type or "").split(";")[0].strip()
    content = uploaded.read()
    kind = _media_kind(filename, mime)
    if not kind:
        frappe.throw(_("Add a photo or a video."))
    if not content:
        frappe.throw(_("The file is empty."))
    limit = 25 * 1024 * 1024 if kind == "video" else 10 * 1024 * 1024
    if len(content) > limit:
        frappe.throw(_("Each video must be under 25 MB.") if kind == "video" else _("Each photo must be under 10 MB."))

    safe_name = _safe_filename(filename, mime or ("video/mp4" if kind == "video" else "image/jpeg"))
    file_doc = save_file(safe_name, content, ticket_doctype, ticket, is_private=1)
    mapped = _map_file(file_doc.as_dict())
    if not mapped:
        frappe.throw(_("Attachment could not be saved."))
    return {"file": mapped}


def _ticket_meta():
    ticket = _doctypes()["ticket"]
    if not frappe.db.exists("DocType", ticket):
        frappe.throw(_("{0} is not set up on this site.").format(ticket))
    if not frappe.has_permission(ticket, "read"):
        frappe.throw(_("You cannot view service tickets."), frappe.PermissionError)
    return frappe.get_meta(ticket)


def _request_data():
    if frappe.request and frappe.request.is_json:
        data = frappe.request.get_json(silent=True)
        if isinstance(data, dict):
            return data
    return frappe.form_dict or {}


def _present_fields(meta, wanted):
    available = {field.fieldname for field in meta.fields}
    available.update({"name", "creation", "modified", "owner"})
    return [field for field in wanted if field in available] or ["name"]


def _choice_options(meta, fieldname):
    field = meta.get_field(fieldname)
    if not field:
        return []
    if field.fieldtype == "Link" and field.options:
        rows = _link_rows(field.options, ["name"], "name asc", lambda row: row.name, limit=200)
        return [row["name"] for row in rows]
    if field.fieldtype == "Select":
        return _lines(field.options)
    return []


def _choice_or_fallback(meta, fieldname, fallback):
    field = meta.get_field(fieldname)
    if not field:
        return list(fallback)
    choices = _choice_options(meta, fieldname)
    if field.fieldtype == "Link":
        return choices
    return choices or list(fallback)


def _order(meta, order_by):
    parts = str(order_by or "name asc").split()
    field = parts[0]
    direction = "desc" if len(parts) > 1 and parts[1].lower() == "desc" else "asc"
    if field != "name" and not meta.has_field(field):
        field = "name"
    return f"{field} {direction}"


def _lines(options):
    return [line.strip() for line in str(options or "").split("\n") if line.strip()]


def _assign(payload, meta, fieldname, value):
    text = str(value or "").strip()
    if text and meta.has_field(fieldname):
        payload[fieldname] = text


def _assign_choice(payload, meta, fieldname, value, label):
    text = str(value or "").strip()
    if not text or not meta.has_field(fieldname):
        return
    allowed = _choice_options(meta, fieldname)
    if allowed and text not in allowed:
        frappe.throw(_("Choose a {0} from the list.").format(label))
    payload[fieldname] = text


def _link_rows(doctype, fields, order_by, label, limit=100, extra=None):
    if not frappe.db.exists("DocType", doctype) or not frappe.has_permission(doctype, "read"):
        return []
    meta = frappe.get_meta(doctype)
    present = _present_fields(meta, fields)
    rows = frappe.get_list(doctype, fields=present, order_by=_order(meta, order_by), limit_page_length=limit)
    result = []
    for row in rows:
        item = {"name": row.name, "label": label(row)}
        if extra:
            item.update(extra(row))
        result.append(item)
    return result


def _equipment_rows():
    doctype = _doctypes()["equipment"]
    if not frappe.db.exists("DocType", doctype) or not frappe.has_permission(doctype, "read"):
        return []
    meta = frappe.get_meta(doctype)
    fields = _present_fields(meta, ["name", "customer", "item_name", "serial_no", "equipment_id"])
    rows = frappe.get_list(doctype, fields=fields, limit_page_length=100)
    result = []
    for row in rows:
        item_name = row.get("item_name") or ""
        result.append(
            {
                "name": row.name,
                "customer": row.get("customer") or "",
                "label": " · ".join(part for part in (row.name, item_name) if part),
            }
        )
    return result


def _files_for(names):
    grouped = {}
    doctypes = _doctypes()
    if not names or not frappe.db.exists("DocType", doctypes["file"]):
        return grouped
    try:
        rows = frappe.get_all(
            doctypes["file"],
            filters={"attached_to_doctype": doctypes["ticket"], "attached_to_name": ["in", names]},
            fields=["name", "file_name", "file_url", "attached_to_name"],
            limit_page_length=500,
        )
    except Exception:
        return grouped
    allowed = set(names)
    for row in rows:
        if row.attached_to_name not in allowed:
            continue
        grouped.setdefault(row.attached_to_name, []).append(row)
    return grouped


def _map_ticket(doc, files):
    description = _plain(doc.get("description"))
    complaint = doc.get("customer_complaint") or ""
    created = _to_iso(doc.get("reported_datetime") or doc.get("creation"))
    updated = _to_iso(doc.get("modified") or doc.get("reported_datetime") or doc.get("creation"))
    subject = doc.get("subject") or doc.get("name")
    return {
        "id": doc.get("name"),
        "subject": subject,
        "customer": doc.get("customer") or "",
        "customerSite": doc.get("customer_site") or "",
        "contactPerson": doc.get("contact_person") or "",
        "contactEmail": doc.get("contact_email") or "",
        "contactMobile": doc.get("contact_mobile") or "",
        "reportedBy": doc.get("reported_by") or "",
        "customerEquipment": doc.get("customer_equipment") or "",
        "ticketType": doc.get("ticket_type") or "",
        "serviceCategory": doc.get("service_category") or "",
        "impact": doc.get("impact") or "",
        "urgency": doc.get("urgency") or "",
        "priority": doc.get("priority") or "",
        "source": doc.get("source") or "",
        "status": doc.get("status") or "",
        "erpStatus": doc.get("status") or "",
        "description": description,
        "customerComplaint": complaint,
        "createdAt": created,
        "updatedAt": updated,
        "attachments": [item for item in (_map_file(file) for file in files or []) if item],
        "messages": [
            {
                "id": f"m-{doc.get('name')}",
                "from": "you",
                "text": description or complaint or subject or "",
                "at": created,
            }
        ],
    }


def _map_file(file):
    filename = file.get("file_name") or file.get("name") or ""
    kind = _media_kind(filename, "")
    file_url = file.get("file_url") or ""
    if not file.get("name") or not kind or not str(file_url).startswith("/"):
        return None
    return {
        "id": file.get("name"),
        "name": filename,
        "kind": kind,
        "type": _mime_for(filename, kind),
        "url": file_url,
    }


def _media_kind(filename, mime):
    lower = str(filename or "").lower()
    media = str(mime or "").lower()
    if media == "image/svg+xml" or lower.endswith(".svg"):
        return ""
    if media.startswith("image/") or re.search(r"\.(png|jpe?g|gif|webp|bmp|heic|heif)$", lower):
        return "image"
    if media.startswith("video/") or re.search(r"\.(mp4|webm|mov|m4v|ogg)$", lower):
        return "video"
    return ""


def _mime_for(filename, kind):
    ext = str(filename).rsplit(".", 1)[-1].lower()
    types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "bmp": "image/bmp",
        "heic": "image/heic",
        "heif": "image/heif",
        "mp4": "video/mp4",
        "m4v": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "ogg": "video/ogg",
    }
    return types.get(ext) or ("video/mp4" if kind == "video" else "image/jpeg")


def _to_html(text):
    return "".join(f"<p>{_escape_html(line) or '<br>'}</p>" for line in text.split("\n"))


def _plain(html):
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", str(html), flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", '"')
    )
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _escape_html(value):
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _to_iso(value):
    if not value:
        value = frappe.utils.now_datetime()
    text = str(value).replace("T", " ")
    date, _, time = text.partition(" ")
    clock = (time or "00:00:00").split(".")[0]
    return f"{date}T{clock}"


def _safe_filename(name, mime):
    cleaned = re.sub(r"[^\w.-]+", "_", str(name or "attachment"))[:80]
    if re.search(r"\.[a-z0-9]+$", cleaned, flags=re.I):
        return cleaned
    extension = (mime.split("/")[1] if "/" in mime else "") or "bin"
    return f"{cleaned}.{extension}"

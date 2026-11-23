import re

import frappe
from frappe import _
from frappe.utils.file_manager import save_file

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


def check_app_permission():
    if frappe.session.user == "Guest":
        return False
    if "System Manager" in frappe.get_roles():
        return True
    if not frappe.db.exists("DocType", "Service Ticket"):
        return False
    return bool(frappe.has_permission("Service Ticket", "read"))


@frappe.whitelist()
def get_options():
    meta = _ticket_meta()
    categories = _select_options(meta, "service_category") or CATEGORY_FALLBACK
    priorities = _select_options(meta, "priority") or PRIORITY_FALLBACK
    return {
        "customers": _link_rows("Customer", ["name", "customer_name"], "customer_name asc", lambda row: row.customer_name or row.name),
        "sites": _link_rows("Customer Site", ["name", "customer"], "name asc", lambda row: row.name, extra=lambda row: {"customer": row.customer or ""}),
        "contacts": _link_rows("Contact", ["name", "full_name"], "name asc", lambda row: row.full_name or row.name, limit=200),
        "equipment": _equipment_rows(),
        "ticketTypes": _select_options(meta, "ticket_type"),
        "categories": categories,
        "impacts": _select_options(meta, "impact"),
        "urgencies": _select_options(meta, "urgency"),
        "priorities": priorities,
        "sources": _select_options(meta, "source"),
        "statuses": _select_options(meta, "status"),
    }


@frappe.whitelist()
def get_tickets():
    meta = _ticket_meta()
    fields = _present_fields(meta, TICKET_FIELDS)
    rows = frappe.get_list("Service Ticket", fields=fields, order_by="modified desc", limit_page_length=100)
    files = _files_for([row.name for row in rows])
    return {"tickets": [_map_ticket(row, files.get(row.name, [])) for row in rows]}


@frappe.whitelist()
def create_ticket():
    meta = _ticket_meta()
    data = _request_data()
    subject = str(data.get("subject") or "").strip()
    customer = str(data.get("customer") or "").strip()
    if not subject:
        frappe.throw(_("Add a subject."))
    if not customer:
        frappe.throw(_("Choose a customer."))

    payload = {"doctype": "Service Ticket", "customer": customer, "subject": subject}
    series = "ST-.YYYY.-.#####"
    series_field = meta.get_field("naming_series")
    if series_field:
        allowed = _lines(series_field.options)
        if not allowed or series in allowed:
            payload["naming_series"] = series

    _assign(payload, meta, "customer_site", data.get("customerSite"))
    _assign(payload, meta, "contact_person", data.get("contactPerson"))
    _assign(payload, meta, "contact_email", data.get("contactEmail"))
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
    if not frappe.db.exists("Service Ticket", ticket):
        frappe.throw(_("Ticket not found"), frappe.DoesNotExistError)
    if not frappe.has_permission("Service Ticket", "write", doc=ticket):
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
    file_doc = save_file(safe_name, content, "Service Ticket", ticket, is_private=1)
    mapped = _map_file(file_doc.as_dict())
    if not mapped:
        frappe.throw(_("Attachment could not be saved."))
    return {"file": mapped}


def _ticket_meta():
    if not frappe.db.exists("DocType", "Service Ticket"):
        frappe.throw(_("Service Ticket is not set up on this site."))
    if not frappe.has_permission("Service Ticket", "read"):
        frappe.throw(_("You cannot view service tickets."), frappe.PermissionError)
    return frappe.get_meta("Service Ticket")


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


def _select_options(meta, fieldname):
    field = meta.get_field(fieldname)
    if not field:
        return []
    return _lines(field.options)


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
    allowed = _select_options(meta, fieldname)
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
    doctype = "Customer Equipment"
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
    if not names or not frappe.db.exists("DocType", "File"):
        return grouped
    try:
        rows = frappe.get_all(
            "File",
            filters={"attached_to_doctype": "Service Ticket", "attached_to_name": ["in", names]},
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

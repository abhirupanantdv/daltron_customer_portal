import frappe


def email_customer_reply(doc, method=None):
	if doc.comment_type != "Comment" or not str(doc.comment_by or "").strip():
		return
	if not doc.reference_doctype or not doc.reference_name:
		return
	try:
		if frappe.flags.get("skip_ticket_reply_email"):
			_notify_desk(doc)
		else:
			_notify_customer(doc)
	except Exception:
		frappe.log_error(title="Service ticket reply email", message=frappe.get_traceback())


def _notify_customer(doc):
	ticket = _ticket_row(doc.reference_doctype, doc.reference_name)
	if not ticket:
		return
	recipient = str(ticket.get("contact_email") or "").strip()
	if "@" in recipient:
		title = _title(ticket)
		frappe.sendmail(
			recipients=[recipient],
			subject=f"Re: {title} ({ticket.name})",
			message=doc.content or "",
			reference_doctype=doc.reference_doctype,
			reference_name=ticket.name,
			delayed=True,
		)
	user = _user_by_email(recipient)
	_notify(
		user,
		doc,
		ticket.name,
		f"Service management replied on {ticket.name}",
		_snippet(doc.content),
	)


def _notify_desk(doc):
	ticket = _ticket_row(doc.reference_doctype, doc.reference_name)
	if not ticket:
		return
	author = str(doc.owner or "").strip()
	users = _desk_users(ticket, author)
	if not users:
		return
	title = _title(ticket)
	who = str(doc.comment_by or "Customer").strip() or "Customer"
	frappe.sendmail(
		recipients=users,
		subject=f"Customer reply: {title} ({ticket.name})",
		message=f"<p><b>{frappe.utils.escape_html(who)}</b> replied on {frappe.utils.escape_html(ticket.name)}.</p>{doc.content or ''}",
		reference_doctype=doc.reference_doctype,
		reference_name=ticket.name,
		delayed=True,
	)
	text = _snippet(doc.content)
	for user in users:
		_notify(user, doc, ticket.name, f"{who} replied on {ticket.name}", text)


def _notify(user, doc, ticket_name, title, text):
	user = str(user or "").strip()
	actor = str(doc.owner or "").strip()
	if not user or user in {"Guest", "Administrator"} or user == actor:
		return
	if not frappe.db.exists("User", user):
		return
	notice = frappe.get_doc(
		{
			"doctype": "Notification Log",
			"type": "Alert",
			"document_type": doc.reference_doctype,
			"document_name": ticket_name,
			"title": title[:140],
			"subject": title[:140],
			"description": text,
			"for_user": user,
			"from_user": actor if actor and frappe.db.exists("User", actor) else None,
		}
	)
	notice.insert(ignore_permissions=True)


def _desk_users(ticket, author=""):
	found = []
	customer = _user_by_email(ticket.get("contact_email"))

	def add(user):
		user = str(user or "").strip()
		if not user or user in {"Guest", "Administrator", customer, author} or user in found:
			return
		if frappe.db.get_value("User", user, "enabled"):
			found.append(user)

	add(ticket.get("assigned_to"))
	technician = ticket.get("assigned_technician")
	if technician and frappe.db.exists("Employee", technician):
		add(frappe.db.get_value("Employee", technician, "user_id"))
	for row in frappe.get_all(
		"Comment",
		filters={"reference_doctype": _ticket_doctype(), "reference_name": ticket.name, "comment_type": "Comment"},
		fields=["owner", "comment_by", "comment_email"],
		limit_page_length=50,
	):
		if not str(row.comment_by or "").strip():
			continue
		contact = str(ticket.get("contact_email") or "").strip().lower()
		if contact and str(row.comment_email or "").strip().lower() == contact:
			continue
		add(row.owner)
	if found:
		return found
	if frappe.db.exists("Role", "Service Manager"):
		for user in frappe.get_all("Has Role", filters={"role": "Service Manager", "parenttype": "User"}, pluck="parent"):
			add(user)
	return found


def _ticket_row(ticket_doctype, name):
	if ticket_doctype != _ticket_doctype() or not frappe.db.exists(ticket_doctype, name):
		return None
	meta = frappe.get_meta(ticket_doctype)
	fields = ["name", "owner"]
	for field in ("subject", "contact_email", "assigned_to", "assigned_technician"):
		if meta.has_field(field):
			fields.append(field)
	return frappe.db.get_value(ticket_doctype, name, fields, as_dict=True)


def _user_by_email(email):
	email = str(email or "").strip()
	if "@" not in email:
		return ""
	if frappe.db.exists("User", email):
		return email
	return frappe.db.get_value("User", {"email": email}, "name") or ""


def _title(ticket):
	return str(ticket.get("subject") or ticket.name).strip() or ticket.name


def _snippet(html):
	from ticket_system.api import _plain

	return _plain(html)[:500]


def _ticket_doctype():
	try:
		from ticket_system.api import _doctypes

		return _doctypes().get("ticket") or ""
	except Exception:
		return ""

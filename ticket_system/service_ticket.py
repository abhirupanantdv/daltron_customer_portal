import frappe
from frappe import _


def validate(doc, method=None):
	if not doc.meta.has_field("sub_category"):
		return
	sub_category = str(doc.get("sub_category") or "").strip()
	if not sub_category:
		return
	category = str(doc.get("category") or "").strip() if doc.meta.has_field("category") else ""
	if not category or not frappe.db.exists("Sub Category", sub_category):
		frappe.throw(_("Choose a sub category that belongs to the selected category."))
	parent = frappe.db.get_value("Sub Category", sub_category, "category")
	if parent != category:
		frappe.throw(_("Choose a sub category that belongs to the selected category."))

import frappe


def after_install():
    """Make /ticket the site home on the host this site already uses."""
    _set_single("Website Settings", "home_page", "ticket")
    _set_single("Portal Settings", "default_portal_home", "ticket")
    _set_single("System Settings", "default_app", "ticket_system")
    frappe.clear_cache()
    from frappe.website.utils import clear_cache

    clear_cache()


def get_home_page(user=None):
    return "ticket"


def _set_single(doctype, fieldname, value):
    if not frappe.db.exists("DocType", doctype):
        return
    if not frappe.get_meta(doctype).has_field(fieldname):
        return
    frappe.db.set_single_value(doctype, fieldname, value)

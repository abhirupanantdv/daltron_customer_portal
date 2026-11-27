import frappe

# Standard ITSM classification for Service Ticket.
ITSM_CATEGORIES = {
    "Hardware": ["Desktop", "Laptop", "Server", "Monitor", "Peripheral", "Storage"],
    "Software": ["Installation", "License", "Update", "Error", "Configuration"],
    "Network": ["Connectivity", "Wi-Fi", "VPN", "Cabling", "Internet"],
    "Application": ["Login", "Performance", "Data Error", "New Requirement", "Report"],
    "Printer": ["Paper Jam", "Print Quality", "Offline", "Toner", "Driver"],
    "Access": ["Password Reset", "New Account", "Permission Change", "Account Locked"],
    "Email": ["Cannot Send", "Cannot Receive", "Mailbox", "Spam"],
    "Security": ["Malware", "Phishing", "Unauthorized Access", "Data Loss"],
    "Infrastructure": ["Power", "Server Down", "Backup", "Storage"],
}


def after_install():
    """Make /ticket the site home on the host this site already uses."""
    _set_single("Website Settings", "home_page", "ticket")
    _set_single("Portal Settings", "default_portal_home", "ticket")
    _set_single("System Settings", "default_app", "ticket_system")
    ensure_itsm_categories()
    frappe.clear_cache()
    from frappe.website.utils import clear_cache

    clear_cache()


def after_migrate():
    ensure_itsm_categories()


def ensure_itsm_categories():
    if not frappe.db.exists("DocType", "Category") or not frappe.db.exists("DocType", "Sub Category"):
        return
    for category_name, sub_names in ITSM_CATEGORIES.items():
        if not frappe.db.exists("Category", category_name):
            frappe.get_doc({"doctype": "Category", "category_name": category_name}).insert(ignore_permissions=True)
        for sub_name in sub_names:
            sub_id = f"{category_name}-{sub_name}"
            if frappe.db.exists("Sub Category", sub_id):
                continue
            frappe.get_doc(
                {
                    "doctype": "Sub Category",
                    "sub_category_name": sub_name,
                    "category": category_name,
                }
            ).insert(ignore_permissions=True)
    frappe.db.commit()


def get_home_page(user=None):
    return "ticket"


def _set_single(doctype, fieldname, value):
    if not frappe.db.exists("DocType", doctype):
        return
    if not frappe.get_meta(doctype).has_field(fieldname):
        return
    frappe.db.set_single_value(doctype, fieldname, value)

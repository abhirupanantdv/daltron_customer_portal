import frappe

no_cache = 1
sitemap = 0


def get_context(context):
    context.no_cache = 1
    context.safe_render = False
    token = frappe.sessions.get_csrf_token()
    context.csrf_token = token
    if getattr(frappe.local, "cookie_manager", None):
        frappe.local.cookie_manager.set_cookie("csrf_token", token)
    frappe.db.commit()
    return context

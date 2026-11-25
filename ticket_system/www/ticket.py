import frappe

no_cache = 1
sitemap = 0


def get_context(context):
    context.no_cache = 1
    context.safe_render = False
    context.csrf_token = frappe.sessions.get_csrf_token()
    frappe.db.commit()
    return context

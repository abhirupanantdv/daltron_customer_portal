from urllib.parse import quote

import frappe

no_cache = 1
sitemap = 0


def get_context(context):
    context.no_cache = 1
    context.safe_render = False
    if frappe.session.user == "Guest":
        request = getattr(frappe.local, "request", None)
        target = request.path if request and request.path else "/ticket"
        frappe.flags.redirect_location = "/login?redirect-to=" + quote(target, safe="/")
        raise frappe.Redirect(302)
    return context

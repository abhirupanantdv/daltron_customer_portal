app_name = "ticket_system"
app_title = "Ticket System"
app_publisher = "AnantDV"
app_description = "AnantDV support tickets"
app_email = "support@anantdv.com"
app_license = "MIT"

required_apps = ["frappe", "erpnext"]

# Opening the site host lands on /ticket. Nested ticket paths stay on this page.
home_page = "ticket"
get_website_user_home_page = "ticket_system.install.get_home_page"

website_redirects = [
    {"source": "/", "target": "/ticket", "redirect_http_status": 302},
]

website_route_rules = [
    {"from_route": "/ticket/<path:app_path>", "to_route": "ticket"},
]

add_to_apps_screen = [
    {
        "name": "ticket_system",
        "logo": "/assets/ticket_system/images/logo.png",
        "title": "Tickets",
        "route": "/ticket",
        "has_permission": "ticket_system.api.check_app_permission",
        "sequence_id": 10,
    }
]

after_install = "ticket_system.install.after_install"

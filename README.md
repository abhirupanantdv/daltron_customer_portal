# Ticket System

AnantDV support tickets as an installable app for Frappe / ERPNext v16. It reads and writes the Service Ticket records already on the site. The browser stays on the site's current host.

After installation:

- `https://<existing-host>/` redirects to `/ticket`
- `/ticket` is the support app
- `/ticket/tickets`, `/ticket/tickets/new`, and ticket chat routes stay on that page
- The app is the site default app, so signing in from `/ticket` returns there
- Guests sign in with their existing ERPNext account. Ticket access follows Service Ticket permissions.

## Install on the bench that already serves this site

From the bench directory:

```bash
bench get-app /path/to/ticketsystem
bench --site <existing-site> install-app ticket_system
bench --site <existing-site> clear-cache
bench restart
```

`<existing-site>` is the site already bound to this host, for example `erp.daltronpng.com`. Do not change the site host or IP. Open `https://<existing-host>/ticket`.

Rebuild the browser assets after frontend changes, then restart:

```bash
npm run build
bench --site <existing-site> clear-cache
bench restart
```

`npm run dev` is only for local UI work. It still proxies `/api/erp` using `ERPNEXT_URL` and `ERPNEXT_TOKEN` in `.env`. The installed app does not use that token. It uses the logged-in session on the site.

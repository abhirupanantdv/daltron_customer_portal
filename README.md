# Ticket System

AnantDV support tickets as an installable app for Frappe / ERPNext v16. It reads and writes the Service Ticket records already on the site. The browser stays on the site's current host.

After installation:

- `https://<existing-host>/` redirects to `/ticket`
- `/ticket` is the support app
- `/ticket/tickets`, `/ticket/tickets/new`, and ticket chat routes stay on that page
- The app is the site default app. Signing in on `/ticket/login` returns to the page you asked for
- Guests sign in on the support login page with their existing ERPNext account. Ticket access follows Service Ticket permissions.

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

`npm run dev` is only for local UI work. It proxies `/api/erp` to the server in `.env`. Sign in on the login page with an account on that server. The proxy keeps that browser session for later requests. `ERPNEXT_URL` is required. `ERPNEXT_USER` and `ERPNEXT_PASSWORD`, or `ERPNEXT_TOKEN`, remain a fallback for API calls made without a browser session. Changing the URL in `.env` switches servers on the next request. The installed app does not use those values. It uses the session from the login page.

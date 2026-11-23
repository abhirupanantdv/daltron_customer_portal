import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import { erpApi } from "./server/erp.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const ticketDir = path.resolve(root, "ticket_system/public/ticket");

function jsxInJs() {
  return {
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      if (!/[/\\]src[/\\].*\.js$/.test(id)) return null;
      return transformWithEsbuild(code, id, {
        loader: "jsx",
        jsx: "automatic",
        sourcemap: true,
      });
    },
  };
}

function frappePage() {
  return {
    name: "frappe-ticket-page",
    apply: "build",
    closeBundle() {
      const html = fs.readFileSync(path.join(ticketDir, "index.html"), "utf8");
      const page = html.includes("<!-- csrf_token -->")
        ? html
        : html.replace("</body>", "    <!-- csrf_token -->\n  </body>");
      const www = path.resolve(root, "ticket_system/www");
      fs.mkdirSync(www, { recursive: true });
      fs.writeFileSync(path.join(www, "ticket.html"), page);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, root, "");
  const build = command === "build";
  return {
    base: build ? "/assets/ticket_system/ticket/" : "/",
    plugins: [
      jsxInJs(),
      react(),
      tailwindcss(),
      erpApi({
        url: env.ERPNEXT_URL,
        token: env.ERPNEXT_TOKEN,
      }),
      build ? frappePage() : null,
    ].filter(Boolean),
    build: {
      outDir: ticketDir,
      emptyOutDir: true,
      assetsDir: "assets",
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
      },
    },
  };
});

// Builds both deployments from app/:
//   cloudflare/public/app.js + index.html — everything bundled (the Worker's CSP only allows same-origin scripts)
//   artifact/index.html                     — claude.ai artifact page; React/Recharts load from jsDelivr
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const page = (body) => `<title>Training Dashboard</title>
<style>
  :root { color-scheme: dark; }
  html, body { background: #000; color: #fff; margin: 0; }
</style>
<div id="root"></div>
${body}`;

// Cloudflare: one self-contained bundle.
mkdirSync("cloudflare/public", { recursive: true });
await build({
  entryPoints: ["app/main-cloudflare.jsx"], bundle: true, minify: true, format: "iife",
  jsx: "automatic", loader: { ".js": "jsx" }, define: { "process.env.NODE_ENV": '"production"' },
  outfile: "cloudflare/public/app.js", legalComments: "none",
});
writeFileSync("cloudflare/public/index.html",
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${page("").replace(/<div id="root"><\/div>\n$/, "")}</head><body><div id="root"></div><script src="/app.js"></script></body></html>\n`);

// Artifact: map library imports to the UMD globals loaded from the CDN.
const globals = { "react": "React", "react-dom/client": "ReactDOM", "recharts": "Recharts", "react/jsx-runtime": null };
const umdGlobals = {
  name: "umd-globals",
  setup(b) {
    b.onResolve({ filter: /^(react|react-dom\/client|recharts|react\/jsx-runtime)$/ }, a => ({ path: a.path, namespace: "umd" }));
    b.onLoad({ filter: /.*/, namespace: "umd" }, a => ({
      contents: a.path === "react/jsx-runtime"
        ? "const R = window.React; export const Fragment = R.Fragment; export const jsx = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k }); export const jsxs = jsx;"
        : `module.exports = window.${globals[a.path]};`,
      loader: "js",
    }));
  },
};
const art = await build({
  entryPoints: ["app/main-artifact.jsx"], bundle: true, minify: true, format: "iife", write: false,
  jsx: "automatic", loader: { ".js": "jsx" }, plugins: [umdGlobals], legalComments: "none",
});
const CDN = "https://cdn.jsdelivr.net/npm";
mkdirSync("artifact", { recursive: true });
writeFileSync("artifact/index.html", page([
  `<script src="${CDN}/react@18.3.1/umd/react.production.min.js"></script>`,
  `<script src="${CDN}/react-dom@18.3.1/umd/react-dom.production.min.js"></script>`,
  `<script src="${CDN}/prop-types@15.8.1/prop-types.min.js"></script>`,
  `<script src="${CDN}/recharts@2.12.7/umd/Recharts.js"></script>`,
  `<script>${art.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`,
].join("\n")) + "\n");
console.log("built cloudflare/public and artifact/index.html");

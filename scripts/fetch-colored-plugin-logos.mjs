import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../src/assets/logos/plugins");

/** @type {Record<string, { homarr?: string; si?: string; hex?: string }>} */
const PLUGINS = {
  docker: { homarr: "docker", si: "docker" },
  figma: { homarr: "figma", si: "figma" },
  excalidraw: { homarr: "excalidraw", si: "excalidraw" },
  miro: { homarr: "miro", si: "miro" },
  supabase: { homarr: "supabase", si: "supabase" },
  planetscale: { si: "planetscale", hex: "E2E8F0" },
  "mongodb-atlas": { homarr: "mongodb", si: "mongodb" },
  vercel: { homarr: "vercel", si: "vercel", hex: "FFFFFF" },
  netlify: { homarr: "netlify", si: "netlify" },
  railway: { homarr: "railway", si: "railway", hex: "FFFFFF" },
  render: { si: "render", hex: "5ED5CE" },
  "fly-io": { si: "flydotio" },
  aws: { homarr: "aws", si: "amazonwebservices" },
  "google-cloud": { homarr: "google-cloud", si: "googlecloud" },
  cloudflare: { homarr: "cloudflare", si: "cloudflare" },
  linear: { homarr: "linear", si: "linear" },
  jira: { homarr: "jira", si: "jira" },
  trello: { si: "trello" },
  asana: { homarr: "asana", si: "asana" },
  slack: { homarr: "slack", si: "slack" },
  discord: { homarr: "discord", si: "discord" },
  openrouter: { homarr: "open-router", hex: "9CA3AF" },
  "hugging-face": { homarr: "hugging-face", si: "huggingface" },
  clerk: { si: "clerk" },
  auth0: { si: "auth0" },
  "firebase-authentication": { homarr: "firebase", si: "firebase" },
  stripe: { homarr: "stripe", si: "stripe" },
  paypal: { homarr: "paypal", si: "paypal" },
  "lemon-squeezy": { si: "lemonsqueezy" },
  posthog: { homarr: "posthog", si: "posthog" },
  mixpanel: { si: "mixpanel" },
  "google-analytics": { homarr: "google-analytics", si: "googleanalytics" },
  sentry: { homarr: "sentry", si: "sentry" },
  datadog: { homarr: "datadog", si: "datadog" },
};

const SKIP_IDS = new Set([
  "neon",
  "microsoft-azure",
  "microsoft-teams",
  "openai",
  "anthropic",
  "google-ai-studio",
  "logrocket",
]);

function hasColor(svg) {
  if (/gradient|stop-color|class="st\d|fill:url\(/i.test(svg)) return true;
  if (/style="fill:#(?!000\b|000000\b)/i.test(svg)) return true;
  if (/fill="#(?!000\b|000000\b|fff\b|ffffff\b)/i.test(svg)) return true;
  return false;
}

function colorizeSvg(svg, hex) {
  if (hasColor(svg)) return svg;

  const color = hex.startsWith("#") ? hex : `#${hex}`;
  let result = svg;

  result = result.replace(/<svg([^>]*)>/i, (match, attrs) => {
    if (/fill=/.test(attrs)) return match;
    return `<svg${attrs} fill="${color}">`;
  });

  result = result.replace(/<path(?![^>]*fill=)([^>]*)>/gi, `<path fill="${color}"$1>`);
  result = result.replace(/<circle(?![^>]*fill=)([^>]*)>/gi, `<circle fill="${color}"$1>`);
  result = result.replace(/<rect(?![^>]*fill=)([^>]*)>/gi, `<rect fill="${color}"$1>`);

  return result;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function main() {
  const iconsData = await fetch(
    "https://cdn.jsdelivr.net/npm/simple-icons@14.2.0/_data/simple-icons.json",
  ).then((r) => r.json());
  const normalizeSlug = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hexBySlug = Object.fromEntries(
    iconsData.flatMap((icon) => {
      const hex = icon.hex;
      const entries = [[normalizeSlug(icon.title), hex]];
      if (icon.slug) entries.push([icon.slug, hex]);
      return entries;
    }),
  );
  hexBySlug.flydotio = hexBySlug.flyio ?? "8134CC";

  await fs.mkdir(outDir, { recursive: true });

  for (const [id, config] of Object.entries(PLUGINS)) {
    if (SKIP_IDS.has(id)) continue;

    let svg = null;
    let source = "";

    if (config.homarr) {
      try {
        svg = await fetchText(
          `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${config.homarr}.svg`,
        );
        source = `homarr:${config.homarr}`;
      } catch {
        // fall through to simple-icons
      }
    }

    if (!svg && config.si) {
      svg = await fetchText(
        `https://cdn.jsdelivr.net/npm/simple-icons@14.2.0/icons/${config.si}.svg`,
      );
      source = `simple-icons:${config.si}`;
    }

    if (!svg) {
      console.warn(`SKIP ${id}: no source`);
      continue;
    }

    if (id === "vercel") {
      svg = svg.replace(/fill="#000"/gi, 'fill="#FFFFFF"');
      source += "+white";
    } else if (id === "openrouter") {
      svg = svg
        .replace(/fill="#111111"/gi, 'fill="#E5E7EB"')
        .replace(/stroke="#111111"/gi, 'stroke="#E5E7EB"');
      source += "+light";
    } else if (!hasColor(svg)) {
      const hex =
        config.hex ??
        (config.si ? hexBySlug[normalizeSlug(config.si)] ?? hexBySlug[config.si] : undefined);
      if (hex) {
        svg = colorizeSvg(svg, hex);
        source += `+color:${hex}`;
      }
    }

    const outPath = path.join(outDir, `${id}.svg`);
    await fs.writeFile(outPath, svg, "utf8");
    console.log(`OK ${id} <- ${source}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

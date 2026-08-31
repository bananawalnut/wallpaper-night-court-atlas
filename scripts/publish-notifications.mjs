import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const channel = argument("--channel");
if (channel !== "staging" && channel !== "production") throw new Error("--channel must be staging or production");
const origin = (argument("--origin") ?? process.env.ZENITH_PUBLISH_ORIGIN ?? "https://zenith-research.ca").replace(/\/$/, "");
if (!/^https:\/\//.test(origin) && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) {
  throw new Error("publisher origin must use HTTPS or loopback HTTP");
}

async function authorizationToken() {
  if (process.env.WALLPAPER_ADMIN_ACCESS_TOKEN) return process.env.WALLPAPER_ADMIN_ACCESS_TOKEN;
  const requestURL = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestURL || !requestToken) {
    throw new Error("set WALLPAPER_ADMIN_ACCESS_TOKEN locally or run in an id-token-enabled GitHub Actions job");
  }
  const url = new URL(requestURL);
  url.searchParams.set("audience", "zenith-wallpaper-publisher");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  const body = await response.json();
  if (!response.ok || typeof body.value !== "string") throw new Error("GitHub did not issue a publisher identity token");
  return body.value;
}

const feed = JSON.parse(await readFile(path.join(root, "notifications.json"), "utf8"));
const token = await authorizationToken();
const response = await fetch(`${origin}/api/admin/wallpapers/notifications`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ channel, feed }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(body.error ?? `notification publication failed with HTTP ${response.status}`);
console.log(`Published ${body.published.items} update(s) for ${body.published.wallpaperID} to ${body.channel}`);

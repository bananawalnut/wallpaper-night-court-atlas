import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
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

async function json(response, label) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `${label} failed with HTTP ${response.status}`);
  return body;
}

const publication = JSON.parse(await readFile(path.join(root, "dist", "publication.json"), "utf8"));
const packPath = path.join(root, "dist", "pack.zip");
const pack = await readFile(packPath);
const previews = (await readdir(path.join(root, "dist"))).filter((name) => /^preview\.(?:avif|webp|png)$/i.test(name));
if (previews.length !== 1) throw new Error("dist/ must contain exactly one preview asset");
const previewName = previews[0];
const previewPath = path.join(root, "dist", previewName);
const preview = await readFile(previewPath);
const previewType = previewName.endsWith(".avif") ? "image/avif" : previewName.endsWith(".webp") ? "image/webp" : "image/png";
const token = await authorizationToken();
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

const prepared = await json(await fetch(`${origin}/api/admin/wallpapers/prepare`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    channel,
    publication,
    archive: { bytes: (await stat(packPath)).size, sha256: createHash("sha256").update(pack).digest("hex") },
    preview: { bytes: (await stat(previewPath)).size, contentType: previewType },
  }),
}), "prepare publication");

const uploads = await Promise.all([
  fetch(prepared.uploads.pack, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: pack }),
  fetch(prepared.uploads.preview, { method: "PUT", headers: { "Content-Type": previewType }, body: preview }),
]);
if (uploads.some((response) => !response.ok)) throw new Error("object storage rejected a publisher upload");

const finalized = await json(await fetch(`${origin}/api/admin/wallpapers/finalize`, {
  method: "POST",
  headers,
  body: JSON.stringify({ token: prepared.token }),
}), "finalize publication");
console.log(`Published ${finalized.published.id}@${finalized.published.currentVersion} to ${finalized.channel}`);

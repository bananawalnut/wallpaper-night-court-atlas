import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePublication = JSON.parse(await readFile(path.join(root, "publication.json"), "utf8"));
const builtPublication = JSON.parse(await readFile(path.join(root, "dist", "publication.json"), "utf8"));
const summary = JSON.parse(await readFile(path.join(root, "dist", "release-summary.json"), "utf8"));
const semver = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const relativePath = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/\/)[^\\]+$/;

if (sourcePublication.schemaVersion !== 1 || !slug.test(sourcePublication.id ?? "") || !semver.test(sourcePublication.version ?? "")) {
  throw new Error("publication.json has an invalid schema version, id, or version");
}
if (!sourcePublication.title || !sourcePublication.summary || !relativePath.test(sourcePublication.entry ?? "")) {
  throw new Error("publication.json has invalid catalogue copy or entry path");
}
if (sourcePublication.runtime?.api !== "zenith-wallpaper-host"
  || !semver.test(sourcePublication.runtime?.minimumVersion ?? "")
  || !semver.test(sourcePublication.runtime?.maximumExclusiveVersion ?? "")
  || !semver.test(sourcePublication.requirements?.minimumMacOS ?? "")
  || typeof sourcePublication.requirements?.webgl2 !== "boolean"
  || typeof sourcePublication.requirements?.wasm !== "boolean"
  || typeof sourcePublication.motion?.supportsReducedMotion !== "boolean"
  || !Array.isArray(sourcePublication.actions)) {
  throw new Error("publication.json runtime contract is invalid");
}
if (!sourcePublication.sourceRepository?.startsWith("https://github.com/ZenithResearch/")) {
  throw new Error("sourceRepository must be an HTTPS ZenithResearch repository");
}
if (JSON.stringify(sourcePublication) !== JSON.stringify(builtPublication)) throw new Error("dist/publication.json is stale");

const archivePath = path.join(root, "dist", "pack.zip");
const archive = await readFile(archivePath);
const entries = execFileSync("/usr/bin/unzip", ["-Z1", archivePath], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
if (!entries.includes(sourcePublication.entry)) throw new Error(`pack is missing ${sourcePublication.entry}`);
if (entries.some((entry) => !relativePath.test(entry))) throw new Error("pack contains an unsafe archive path");
if (new Set(entries).size !== entries.length) throw new Error("pack contains duplicate paths");
const wasmEntries = entries.filter((entry) => entry.endsWith(".wasm"));
if (sourcePublication.requirements.wasm && wasmEntries.length === 0) throw new Error("pack declares WASM but contains no .wasm file");
for (const wasm of wasmEntries) {
  const bytes = execFileSync("/usr/bin/unzip", ["-p", archivePath, wasm]);
  if (!bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) throw new Error(`${wasm} has no WASM magic header`);
}
const hash = createHash("sha256").update(archive).digest("hex");
if (summary.id !== sourcePublication.id || summary.version !== sourcePublication.version
  || summary.bytes !== archive.byteLength || summary.sha256 !== hash || summary.entries !== entries.length) {
  throw new Error("release-summary.json does not describe the built archive");
}
if (!/^preview\.(?:avif|webp|png)$/i.test(summary.preview)) throw new Error("release summary has no valid preview");
await readFile(path.join(root, "dist", summary.preview));
console.log(`Verified ${sourcePublication.id}@${sourcePublication.version} (${archive.byteLength} bytes, ${hash})`);


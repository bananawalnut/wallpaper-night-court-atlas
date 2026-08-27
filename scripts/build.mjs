import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const output = path.join(root, "dist");
const stage = path.join(output, ".pack-stage");

async function files(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

const previews = (await readdir(path.join(root, "assets")))
  .filter((name) => /^preview\.(?:avif|webp|png)$/i.test(name));
if (previews.length !== 1) throw new Error("assets/ must contain exactly one preview.avif, preview.webp, or preview.png");

await mkdir(output, { recursive: true });
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(source, stage, { recursive: true });
const entries = await files(stage);
if (entries.length === 0) throw new Error("src/ contains no wallpaper files");
const normalizedTime = new Date("1980-01-01T00:00:00.000Z");
await Promise.all(entries.map((entry) => utimes(path.join(stage, entry), normalizedTime, normalizedTime)));

const archive = path.join(output, "pack.zip");
await rm(archive, { force: true });
execFileSync("/usr/bin/zip", ["-X", "-q", archive, ...entries], { cwd: stage });
const publication = JSON.parse(await readFile(path.join(root, "publication.json"), "utf8"));
const preview = previews[0];
await cp(path.join(root, "assets", preview), path.join(output, preview));
await cp(path.join(root, "publication.json"), path.join(output, "publication.json"));
const bytes = await readFile(archive);
const summary = {
  id: publication.id,
  version: publication.version,
  archive: "pack.zip",
  preview,
  bytes: (await stat(archive)).size,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  entries: entries.length,
};
await writeFile(path.join(output, "release-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
await rm(stage, { recursive: true, force: true });
console.log(`Built ${publication.id}@${publication.version} (${summary.bytes} bytes, ${summary.sha256})`);


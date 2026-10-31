// `npm run zip:extension`: zips extension/ into build/anylink-extension.zip for the Chrome Web Store.
// The store gives the extension its own id, so the manifest's dev `key` comes out, and so do private keys,
// tests and the README.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const out = resolve("build/anylink-extension.zip");
const dir = mkdtempSync(join(tmpdir(), "anylink-extension-"));
try {
  cpSync("extension", dir, { recursive: true, filter: (path) => !/(\.pem|\.test\.js|README\.md|\.DS_Store)$/.test(path) });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  delete manifest.key;
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  mkdirSync("build", { recursive: true });
  rmSync(out, { force: true });
  execFileSync("zip", ["-qr", out, "."], { cwd: dir });
  console.log(`${out} (version ${manifest.version})`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

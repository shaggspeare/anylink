// Lists every t("…") / msg("…") key in src/ and the keys each web dictionary is missing.
// `node scripts/i18n-check.mjs` exits 1 if any are missing; `--keys` prints the key list as JSON.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["uk", "ru", "ja", "fr", "de", "it", "ko", "id", "ar", "zh-Hans", "pl", "es", "pt-BR"];
const CALL = /\b(?:t|msg)\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/g;

const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });

const keys = new Set();
for (const f of files("src").filter((f) => !f.startsWith("src/i18n/"))) for (const m of readFileSync(f, "utf8").matchAll(CALL)) keys.add(JSON.parse(`"${m[2].replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`));

if (process.argv.includes("--keys")) {
  console.log(JSON.stringify([...keys].sort(), null, 1));
  process.exit(0);
}
let missing = 0;
for (const l of LOCALES) {
  const p = `src/i18n/messages/${l}.json`;
  const dict = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
  const gone = [...keys].filter((k) => !(k in dict));
  if (gone.length) console.log(`${l}: ${gone.length} missing`, gone.slice(0, 5));
  missing += gone.length;
}
console.log(`${keys.size} keys, ${missing} missing translations`);
process.exit(missing ? 1 : 0);

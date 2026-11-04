import { cp, mkdir, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const output = fileURLToPath(new URL("../public/document-workers/", import.meta.url));
const root = (name) => dirname(require.resolve(`${name}/package.json`));
const copy = async (from, to) => { await mkdir(dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); };

const pdf = root("pdfjs-dist");
await copy(join(pdf, "build/pdf.worker.min.mjs"), join(output, "pdf.worker.min.mjs"));
for (const folder of ["cmaps", "standard_fonts", "wasm", "iccs"]) await copy(join(pdf, folder), join(output, "pdf", folder));
await copy(join(pdf, "LICENSE"), join(output, "pdf/LICENSE"));

const ocr = join(output, "tesseract");
const tesseract = root("tesseract.js");
for (const file of ["tesseract.min.js", "tesseract.min.js.LICENSE.txt", "worker.min.js", "worker.min.js.LICENSE.txt"]) await copy(join(tesseract, "dist", file), join(ocr, file));
const core = root("tesseract.js-core");
for (const file of await readdir(core)) {
  if (/^tesseract-core(?:-simd|-relaxedsimd)?-lstm\.wasm(?:\.js)?$/.test(file)) await copy(join(core, file), join(ocr, file));
}
await copy(join(core, "LICENSE"), join(ocr, "CORE-LICENSE"));
await copy(join(root("@tesseract.js-data/eng"), "4.0.0_best_int/eng.traineddata.gz"), join(ocr, "lang/eng.traineddata.gz"));
console.log("Browser PDF and OCR assets ready.");

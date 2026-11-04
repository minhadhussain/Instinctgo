import { finishExtraction, pdfTextLines, type ExtractedDocument, type ExtractedPage, type ExtractionProgress } from "./document-text";

interface Options { signal: AbortSignal; onProgress: (progress: ExtractionProgress) => void }
const assets = "/document-workers/";

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Text conversion cancelled", "AbortError"));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

class BrowserOcr {
  private worker = new Worker("/document-ocr.js");
  private sequence = 0;
  private pending?: { id: number; resolve: (text: string) => void; reject: (error: Error) => void; progress: (value: number, message: string) => void };

  constructor() {
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending;
      if (!pending || data.id !== pending.id) return;
      if (data.type === "result") { this.pending = undefined; pending.resolve(data.text); }
      else if (data.type === "error") { this.pending = undefined; pending.reject(new Error(`OCR failed: ${data.message}`)); }
      else if (data.type === "progress") pending.progress(data.status === "recognizing text" ? 0.3 + data.progress * 0.7 : Math.min(0.25, data.progress * 0.25), data.status === "recognizing text" ? "Recognising text" : "Loading English OCR");
    };
    this.worker.onerror = (event) => { event.preventDefault(); this.pending?.reject(new Error("The browser OCR engine could not start. Reload the page and try again.")); this.pending = undefined; };
  }
  recognize(image: Blob, progress: (value: number, message: string) => void) {
    return new Promise<string>((resolve, reject) => {
      const id = ++this.sequence;
      this.pending = { id, resolve, reject, progress };
      this.worker.postMessage({ id, image });
    });
  }
  close() {
    this.worker.terminate();
    this.pending?.reject(new DOMException("Text conversion cancelled", "AbortError"));
    this.pending = undefined;
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The document image could not be prepared for OCR.")), "image/png"));
}

export async function extractDocumentText(file: File, { signal, onProgress }: Options): Promise<ExtractedDocument> {
  signal.throwIfAborted();
  let ocr: BrowserOcr | undefined;
  let highestProgress = 0;
  const report = (progress: number, message: string) => {
    if (signal.aborted) return;
    highestProgress = Math.max(highestProgress, Math.min(100, Math.round(progress)));
    onProgress({ progress: highestProgress, message });
  };
  const stopOcr = () => ocr?.close();
  signal.addEventListener("abort", stopOcr, { once: true });
  const recognize = (blob: Blob, progress: (value: number, message: string) => void) => {
    signal.throwIfAborted();
    ocr ??= new BrowserOcr();
    return abortable(ocr.recognize(blob, progress), signal);
  };
  try {
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    report(2, "Reading your document");
    if (extension === "txt" || extension === "md") {
      const bytes = await abortable(file.arrayBuffer(), signal);
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new Error("Save this text document as UTF-8 and upload it again."); }
      const result = finishExtraction([{ page: 1, text, ocr: false }], "Text");
      report(100, "Text converted");
      return result;
    }
    if (extension === "docx") {
      report(10, "Loading Word text reader");
      const mammoth = await abortable(import("mammoth"), signal);
      const bytes = await abortable(file.arrayBuffer(), signal);
      report(35, "Extracting paragraphs and table text");
      let value: string;
      try { value = (await abortable(mammoth.extractRawText({ arrayBuffer: bytes }), signal)).value; }
      catch (error) {
        if (signal.aborted) throw error;
        throw new Error("This Word document could not be read. Upload a valid, unprotected DOCX file.");
      }
      const text = finishExtraction([{ page: 1, text: value, ocr: false }], "Word");
      report(100, "Word document converted");
      return text;
    }
    if (extension === "pdf") {
      report(5, "Loading PDF text reader");
      const pdfjs = await abortable(import("pdfjs-dist"), signal);
      pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
      const data = await abortable(file.arrayBuffer(), signal);
      const loading = pdfjs.getDocument({ data, cMapUrl: `${assets}pdf/cmaps/`, cMapPacked: true, standardFontDataUrl: `${assets}pdf/standard_fonts/`, wasmUrl: `${assets}pdf/wasm/`, iccUrl: `${assets}pdf/iccs/` });
      const stopPdf = () => { void loading.destroy().catch(() => {}); };
      signal.addEventListener("abort", stopPdf, { once: true });
      try {
        const pdf = await abortable(loading.promise, signal);
        if (pdf.numPages > 100) throw new Error("For browser conversion, split PDFs longer than 100 pages into smaller files.");
        const pages: ExtractedPage[] = [];
        for (let number = 1; number <= pdf.numPages; number++) {
          signal.throwIfAborted();
          const start = 10 + (number - 1) / pdf.numPages * 85;
          report(start, `Reading page ${number} of ${pdf.numPages}`);
          const page = await abortable(pdf.getPage(number), signal);
          try {
            const content = await abortable(page.getTextContent(), signal);
            const text = pdfTextLines(content.items.filter((item): item is import("pdfjs-dist/types/src/display/api").TextItem => "str" in item));
            if (text.replace(/[\s\uFFFD]/g, "")) pages.push({ page: number, text, ocr: false });
            else {
              const base = page.getViewport({ scale: 1 });
              const viewport = page.getViewport({ scale: Math.min(2.5, 3000 / Math.max(base.width, base.height)) });
              const canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
              const render = page.render({ canvas, viewport });
              const stopRender = () => render.cancel();
              signal.addEventListener("abort", stopRender, { once: true });
              try {
                await abortable(render.promise, signal);
                const image = await abortable(canvasBlob(canvas), signal);
                const recognized = await recognize(image, (value, message) => report(start + value / pdf.numPages * 85, `${message} · page ${number} of ${pdf.numPages}`));
                pages.push({ page: number, text: recognized, ocr: true });
              } finally { signal.removeEventListener("abort", stopRender); canvas.width = 0; canvas.height = 0; }
            }
          } finally { page.cleanup(); }
        }
        const result = finishExtraction(pages, pages.some((page) => page.ocr) ? "PDF + OCR" : "PDF");
        report(100, "PDF converted");
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "PasswordException") throw new Error("This PDF is password-protected. Upload an unlocked copy to convert it.");
        if (error instanceof Error && error.name === "InvalidPDFException") throw new Error("This PDF could not be read. Upload a valid PDF file.");
        throw error;
      } finally { signal.removeEventListener("abort", stopPdf); await loading.destroy(); }
    }
    if (extension === "png" || extension === "jpg" || extension === "jpeg") {
      report(5, "Preparing image for text recognition");
      const bitmap = await abortable(createImageBitmap(file).then((image) => {
        if (signal.aborted) { image.close(); signal.throwIfAborted(); }
        return image;
      }), signal);
      const canvas = document.createElement("canvas");
      try {
        signal.throwIfAborted();
        const scale = Math.min(2, 3000 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.ceil(bitmap.width * scale); canvas.height = Math.ceil(bitmap.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the image for OCR.");
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const image = await abortable(canvasBlob(canvas), signal);
        const text = await recognize(image, (value, message) => report(10 + value * 85, message));
        const result = finishExtraction([{ page: 1, text, ocr: true }], "OCR");
        report(100, "Image converted to text");
        return result;
      } finally { bitmap.close(); canvas.width = 0; canvas.height = 0; }
    }
    throw new Error("This document format is not supported for text conversion.");
  } finally { signal.removeEventListener("abort", stopOcr); ocr?.close(); }
}

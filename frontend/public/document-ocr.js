/* OCR runs in an owned worker so cancellation also terminates its child engine. */
let engine;
let activeId;

globalThis.onmessage = async ({ data }) => {
  activeId = data.id;
  try {
    if (!engine) {
      const base = new URL("./document-workers/tesseract/", globalThis.location.href).href;
      globalThis.importScripts(`${base}tesseract.min.js`);
      engine = globalThis.Tesseract.createWorker("eng", 1, {
        workerPath: `${base}worker.min.js`,
        corePath: base,
        langPath: `${base}lang`,
        workerBlobURL: false,
        gzip: true,
        logger: (message) => globalThis.postMessage({ id: activeId, type: "progress", status: message.status, progress: message.progress }),
        errorHandler: (error) => globalThis.postMessage({ id: activeId, type: "error", message: String(error) }),
      });
    }
    const worker = await engine;
    const result = await worker.recognize(data.image, { rotateAuto: true }, { text: true });
    globalThis.postMessage({ id: data.id, type: "result", text: result.data.text });
  } catch (error) {
    globalThis.postMessage({ id: data.id, type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};

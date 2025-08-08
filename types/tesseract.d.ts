declare module "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js" {
  interface TesseractWorker {
    loadLanguage(lang: string): Promise<void>;
    initialize(lang: string): Promise<void>;
    setParameters(params: Record<string, string>): Promise<void>;
    recognize(blob: Blob): Promise<{ data: { text: string } }>;
    terminate(): Promise<void>;
  }

  export function createWorker(): Promise<TesseractWorker>;
}

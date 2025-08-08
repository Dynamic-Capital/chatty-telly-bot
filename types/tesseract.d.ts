declare module "tesseract.js" {
  interface Worker {
    loadLanguage(lang: string): Promise<void>;
    initialize(lang: string): Promise<void>;
    setParameters(params: Record<string, string>): Promise<void>;
    recognize(blob: Blob): Promise<{ data: { text: string } }>;
    terminate(): Promise<void>;
  }

  export function createWorker(): Promise<Worker>;
}

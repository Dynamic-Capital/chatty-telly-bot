interface BaseWorker {
  load(): Promise<void>;
  loadLanguage(lang: string): Promise<void>;
  initialize?(lang: string): Promise<void>;
  reinitialize?(lang: string): Promise<void>;
  setParameters(params: Record<string, string>): Promise<void>;
  recognize(blob: Blob): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

declare module "npm:tesseract.js@5" {
  export function createWorker(): Promise<BaseWorker>;
  export type Worker = BaseWorker;
}

declare module "tesseract.js" {
  export function createWorker(): Promise<BaseWorker>;
  export type Worker = BaseWorker;
}

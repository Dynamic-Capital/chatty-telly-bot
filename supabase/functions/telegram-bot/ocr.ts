import { createWorker } from "npm:tesseract.js@5";
import type { Worker as TesseractWorker } from "npm:tesseract.js@5";

type OCRWorker = TesseractWorker & {
  loadLanguage: (lang: string) => Promise<unknown>;
  initialize?: (lang: string) => Promise<unknown>;
  reinitialize?: (lang: string) => Promise<unknown>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (blob: Blob) => Promise<{ data: { text: string } }>;
};

export async function ocrTextFromBlob(blob: Blob): Promise<string> {
  const worker: OCRWorker = await createWorker();

  try {
    await worker.load();
    await worker.loadLanguage("eng");
    if (worker.initialize) {
      await worker.initialize("eng");
    } else if (worker.reinitialize) {
      await worker.reinitialize("eng");
    }
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$€₹:. -/()",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const { data } = await worker.recognize(blob);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export function parseReceipt(text: string) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const join = lines.join(" ");
  const amtMatch = join.match(/([0-9]+[.,][0-9]{2})/);
  const total = amtMatch ? Number(amtMatch[1].replace(",", ".")) : null;

  const dtMatch = join.match(/\b(20\d{2}[./-]\d{1,2}[./-]\d{1,2})[ T]*(\d{1,2}:\d{2}(:\d{2})?)\b/);
  const dateText = dtMatch ? `${dtMatch[1]} ${dtMatch[2]}` : null;

  const success = /\b(successful|completed|processed)\b/i.test(join);
  const beneficiary = lines.find(l => /\b(Dynamic|Capital)\b/i.test(l)) || null;
  const payCode = (join.match(/\bDC-[A-Z0-9]{6}\b/) || [null])[0];

  return { text, total, dateText, success, beneficiary, payCode };
}

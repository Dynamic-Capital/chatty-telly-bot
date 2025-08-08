export type Bank = "BML" | "MIB" | "UNKNOWN";

export interface ParsedSlip {
  bank: Bank;
  amount: number | null;
  currency: string | null;
  status: "SUCCESS" | "FAILED" | "PENDING" | null;
  successWord: boolean;
  reference: string | null;
  fromName: string | null;
  toName: string | null;
  toAccount: string | null;
  payCode: string | null; // e.g., DC-XXXXXX from remarks/purpose/message
  ocrTxnDateIso: string | null;    // +05:00
  ocrValueDateIso: string | null;  // +05:00
  rawText: string;
}

const PAY_CODE_REGEX = /\bDC-[A-Z0-9]{6}\b/;

function extractPayCode(text: string): string | null {
  const match = text.match(PAY_CODE_REGEX);
  return match ? match[0] : null;
}

export function parseBankSlip(ocrText: string): ParsedSlip {
  const text = ocrText.replace(/\r/g, "").trim();
  const lines = text.split(/\n+/).map(l => l.trim());
  const lower = text.toLowerCase();

  const parsed: ParsedSlip = {
    bank: "UNKNOWN",
    amount: null,
    currency: null,
    status: null,
    successWord: false,
    reference: null,
    fromName: null,
    toName: null,
    toAccount: null,
    payCode: null,
    ocrTxnDateIso: null,
    ocrValueDateIso: null,
    rawText: text,
  };

  // amount & currency
  const amtMatch = text.match(/([A-Z]{3})\s*([0-9,]+\.[0-9]{2})/);
  if (amtMatch) {
    parsed.currency = amtMatch[1].toUpperCase();
    parsed.amount = parseFloat(amtMatch[2].replace(/,/g, ""));
  } else {
    const fallback = text.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/);
    if (fallback) {
      parsed.amount = parseFloat(fallback[1].replace(/,/g, ""));
    }
  }

  // pre-scan for pay code in message/purpose/remarks
  for (const line of lines) {
    const l = line.toLowerCase();
    if (l.startsWith("message") || l.startsWith("remarks") || l.startsWith("purpose")) {
      const code = extractPayCode(line);
      if (code) {
        parsed.payCode = code;
        break;
      }
    }
  }
  if (!parsed.payCode) {
    parsed.payCode = extractPayCode(text);
  }

  // Detect & parse BML
  if (/bank of maldives/i.test(text) || /transaction date/i.test(text) && /\d{2}\/\d{2}\/\d{4}/.test(text)) {
    parsed.bank = "BML";

    const status = text.match(/Status\s*:?\s*([A-Za-z]+)/i);
    if (status) {
      parsed.status = status[1].toUpperCase() as ParsedSlip["status"];
      parsed.successWord = /success/i.test(status[1]);
    }

    const ref = text.match(/Reference\s*:?\s*([A-Z0-9]+)/i);
    if (ref) parsed.reference = ref[1];

    const txn = text.match(/Transaction date\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/i);
    if (txn) {
      const [, dd, mm, yyyy, hh, mi] = txn;
      parsed.ocrTxnDateIso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+05:00`;
    }

    const from = text.match(/From\s*:?\s*([^\n]+)/i);
    if (from) parsed.fromName = from[1].trim();

    const to = text.match(/To\s*:?\s*([^\n]+)/i);
    if (to) {
      const parts = to[1].trim().split(/\s+/);
      const account = parts.pop();
      parsed.toAccount = account || null;
      parsed.toName = parts.join(" ") || null;
    }
  }
  // Detect & parse MIB
  else if (/maldives islamic bank/i.test(text) || /value date/i.test(text)) {
    parsed.bank = "MIB";

    const status = text.match(/(Successful|Sucessful|Failed|Pending)/i);
    if (status) {
      const upper = status[1].toUpperCase();
      parsed.status = upper === "SUCESSFUL" ? "SUCCESS" : upper as ParsedSlip["status"];
      parsed.successWord = /su?ccessful/i.test(status[1]);
    }

    const ref = text.match(/Reference\s*#\s*([A-Z0-9]+)/i);
    if (ref) parsed.reference = ref[1];

    const to = text.match(/To Account\s*:?\s*(\d+)\s+([^\n]+)/i);
    if (to) {
      parsed.toAccount = to[1];
      parsed.toName = to[2].trim();
    }

    const val = text.match(/Value Date\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
    if (val) parsed.ocrValueDateIso = `${val[1]}+05:00`;

    const txn = text.match(/Transaction Date\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
    if (txn) parsed.ocrTxnDateIso = `${txn[1]}+05:00`;

    const purpose = text.match(/Purpose\s*:?\s*(.+)/i);
    if (purpose && !parsed.payCode) {
      const code = extractPayCode(purpose[1]);
      if (code) parsed.payCode = code;
    }
  }

  return parsed;
}


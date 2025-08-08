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

export function parseBankSlip(ocrText: string): ParsedSlip {
  const lines = ocrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(" ");

  const payCodeRegex = /\bDC-[A-Z0-9]{6}\b/;
  const remarkLine = lines.find((l) => /message|purpose|remarks/i.test(l));
  let payCode = remarkLine ? (remarkLine.match(payCodeRegex) || [null])[0] : null;
  if (!payCode) {
    const match = joined.match(payCodeRegex);
    payCode = match ? match[0] : null;
  }

  const amountRegex = /\b(MVR|USD)\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/i;
  const amtMatch = joined.match(amountRegex);
  let amount: number | null = null;
  let currency: string | null = null;
  if (amtMatch) {
    currency = amtMatch[1].toUpperCase();
    amount = parseFloat(amtMatch[2].replace(/,/g, ""));
  } else {
    const fallback = joined.match(/([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
    if (fallback) {
      amount = parseFloat(fallback[1].replace(/,/g, ""));
    }
  }

  let bank: Bank = "UNKNOWN";
  if (/bank of maldives|bml/i.test(joined)) bank = "BML";
  else if (/maldives islamic bank|mib/i.test(joined)) bank = "MIB";

  let status: "SUCCESS" | "FAILED" | "PENDING" | null = null;
  let reference: string | null = null;
  let fromName: string | null = null;
  let toName: string | null = null;
  let toAccount: string | null = null;
  let ocrTxnDateIso: string | null = null;
  let ocrValueDateIso: string | null = null;

  const successWord = /successful|sucessful/i.test(joined);

  if (bank === "BML") {
    const statusLine = lines.find((l) => /^status/i.test(l));
    if (statusLine) {
      const m = statusLine.split(/status[: ]*/i)[1];
      status = m ? m.trim().toUpperCase() as any : null;
    }
    const refLine = lines.find((l) => /^reference/i.test(l));
    if (refLine) reference = refLine.split(/reference[: ]*/i)[1]?.trim() || null;
    const txnLine = lines.find((l) => /^transaction date/i.test(l));
    if (txnLine) {
      const m = txnLine.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/);
      if (m) {
        const [_, dd, mm, yyyy, hhmm] = m;
        ocrTxnDateIso = `${yyyy}-${mm}-${dd}T${hhmm}:00+05:00`;
      }
    }
    const fromLine = lines.find((l) => /^from/i.test(l));
    if (fromLine) fromName = fromLine.replace(/^from[: ]*/i, "").trim();
    const toLine = lines.find((l) => /^to/i.test(l));
    if (toLine) {
      const rest = toLine.replace(/^to[: ]*/i, "").trim();
      const parts = rest.split(/\s+/);
      if (parts.length > 1) {
        toAccount = parts[parts.length - 1];
        toName = parts.slice(0, -1).join(" ");
      } else {
        toName = rest;
      }
      if (!payCode) {
        const m = rest.match(payCodeRegex);
        if (m) payCode = m[0];
      }
    }
    const msgLine = lines.find((l) => /^message/i.test(l));
    if (msgLine && !payCode) {
      const m = msgLine.match(payCodeRegex);
      if (m) payCode = m[0];
    }
  } else if (bank === "MIB") {
    const refLine = lines.find((l) => /^reference/i.test(l));
    if (refLine) reference = refLine.split(/#|reference/i).pop()?.trim() || null;
    const toLine = lines.find((l) => /^to account/i.test(l));
    if (toLine) {
      const rest = toLine.replace(/^to account[: ]*/i, "").trim();
      const parts = rest.split(/\s+/);
      if (parts.length > 1) {
        toAccount = parts[0];
        toName = parts.slice(1).join(" ");
      } else {
        toAccount = rest;
      }
    }
    const txnLine = lines.find((l) => /^transaction date/i.test(l));
    if (txnLine) {
      const m = txnLine.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (m) ocrTxnDateIso = `${m[1]}T${m[2]}+05:00`;
    }
    const valueLine = lines.find((l) => /^value date/i.test(l));
    if (valueLine) {
      const m = valueLine.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (m) ocrValueDateIso = `${m[1]}T${m[2]}+05:00`;
    }
    const purposeLine = lines.find((l) => /^purpose/i.test(l));
    if (purposeLine && !payCode) {
      const m = purposeLine.match(payCodeRegex);
      if (m) payCode = m[0];
    }
    const statusMatch = joined.match(/(successful|sucessful|pending|failed)/i);
    if (statusMatch) status = statusMatch[1].toUpperCase() as any;
  }

  return {
    bank,
    amount,
    currency,
    status,
    successWord,
    reference,
    fromName,
    toName,
    toAccount,
    payCode,
    ocrTxnDateIso,
    ocrValueDateIso,
    rawText: ocrText,
  };
}


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
  payCode: string | null; // e.g. DC-XXXXXX from remarks/purpose/message
  ocrTxnDateIso: string | null; // with +05:00
  ocrValueDateIso: string | null; // with +05:00
  rawText: string;
}

function toIsoFromDmy(dateStr: string): string | null {
  const m = dateStr.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/,
  );
  if (!m) return null;
  const [, dd, mm, yyyy, time] = m;
  const t = time.length === 5 ? `${time}:00` : time;
  return `${yyyy}-${mm}-${dd}T${t}+05:00`;
}

function toIsoFromYmd(dateStr: string): string | null {
  const m = dateStr.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  return `${m[1]}T${m[2]}+05:00`;
}

export function parseBankSlip(ocrText: string): ParsedSlip {
  const rawText = ocrText;
  const text = ocrText.replace(/\r/g, "");
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(" ");

  const bank: Bank = /Bank of Maldives/i.test(joined) || /\bBML\b/i.test(joined)
    ? "BML"
    : /Maldives Islamic Bank/i.test(joined) || /\bMIB\b/i.test(joined)
    ? "MIB"
    : "UNKNOWN";

  // Amount & currency
  let amount: number | null = null;
  let currency: string | null = null;
  let amtMatch = joined.match(/MVR\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    currency = "MVR";
  } else {
    amtMatch = joined.match(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ""));
  }

  const payCodeFromLines = () => {
    for (const l of lines) {
      if (/message|purpose|remarks/i.test(l)) {
        const m = l.match(/\bDC-[A-Z0-9]{6}\b/i);
        if (m) return m[0].toUpperCase();
      }
    }
    const m = joined.match(/\bDC-[A-Z0-9]{6}\b/i);
    return m ? m[0].toUpperCase() : null;
  };

  let status: "SUCCESS" | "FAILED" | "PENDING" | null = null;
  let reference: string | null = null;
  let fromName: string | null = null;
  let toName: string | null = null;
  let toAccount: string | null = null;
  let ocrTxnDateIso: string | null = null;
  let ocrValueDateIso: string | null = null;

  if (bank === "BML") {
    const statusMatch = joined.match(/Status\s*:?\s*(SUCCESS|PENDING|FAILED)/i);
    if (statusMatch) {
      status = statusMatch[1].toUpperCase() as "SUCCESS" | "PENDING" | "FAILED";
    }

    const refMatch = joined.match(/Reference\s*:?\s*([A-Z0-9-]{6,24})/i);
    if (refMatch) reference = refMatch[1];

    const txnMatch = joined.match(
      /Transaction Date\s*:?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/i,
    );
    if (txnMatch) ocrTxnDateIso = toIsoFromDmy(txnMatch[1]);

    for (let i = 0; i < lines.length; i++) {
      if (/^From\b/i.test(lines[i])) {
        fromName = lines[i + 1] || null;
      }
      if (/^To\b/i.test(lines[i])) {
        toName = lines[i + 1] || null;
        const accMatch = (lines[i + 2] || "").match(/\d{9,20}/);
        if (accMatch) toAccount = accMatch[0];
      }
    }
  } else if (bank === "MIB") {
    if (/Successful|Sucessful/i.test(joined)) status = "SUCCESS";

    const refMatch = joined.match(/Reference\s*#?\s*([A-Z0-9-]{6,24})/i);
    if (refMatch) reference = refMatch[1];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^To Account/i.test(l)) {
        const m = l.match(/To Account\s*(\d{9,20})\s*(.*)/i);
        if (m) {
          toAccount = m[1];
          toName = m[2].trim() || null;
        } else {
          const accMatch = (lines[i + 1] || "").match(/\d{9,20}/);
          if (accMatch) {
            toAccount = accMatch[0];
            toName = lines[i + 2] || null;
          }
        }
      }
    }

    const txnMatch = joined.match(
      /Transaction Date\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
    );
    if (txnMatch) ocrTxnDateIso = toIsoFromYmd(txnMatch[1]);

    const valMatch = joined.match(
      /Value Date\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
    );
    if (valMatch) ocrValueDateIso = toIsoFromYmd(valMatch[1]);
  }

  const successWord = /\bsuccess|successful|sucessful\b/i.test(joined);

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
    payCode: payCodeFromLines(),
    ocrTxnDateIso,
    ocrValueDateIso,
    rawText,
  };
}

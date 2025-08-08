/**
 * Judge whether a receipt should be auto-approved using an LLM.
 * @param {Record<string, unknown>} fields - Structured receipt fields.
 * @param {Record<string, unknown>} intent - Payment intent context.
 * @returns {Promise<{score: number; reasons: string[]; approve: boolean}>}
 * A judgement containing confidence score, reasons and approval flag.
 */
export async function llmJudgeAutoApproval(
  fields: Record<string, unknown>,
  intent: Record<string, unknown>,
): Promise<{ score: number; reasons: string[]; approve: boolean }> {
  // TODO: Implement OpenAI call for approval judging
  return { score: 0, reasons: [], approve: false };
}

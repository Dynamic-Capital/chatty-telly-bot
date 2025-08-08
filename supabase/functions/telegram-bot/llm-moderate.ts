/**
 * Perform lightweight moderation on user text using an LLM.
 * @param {string} text - Text to evaluate.
 * @returns {Promise<{flagged: boolean; categories: string[]}>}
 * Moderation result with flag status and categories.
 */
export async function llmModerateText(
  text: string,
): Promise<{ flagged: boolean; categories: string[] }> {
  // TODO: Implement OpenAI call for text moderation
  return { flagged: false, categories: [] };
}

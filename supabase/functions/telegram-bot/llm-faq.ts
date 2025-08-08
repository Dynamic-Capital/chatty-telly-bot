/**
 * Generate a short answer for a user's question using knowledge base snippets.
 * @param {string} userQuestion - Question from the user.
 * @param {string[]} kbSnippets - Relevant knowledge base snippets.
 * @returns {Promise<string>} Short answer string.
 */
export async function llmAnswerFaq(
  userQuestion: string,
  kbSnippets: string[],
): Promise<string> {
  // TODO: Implement OpenAI call for FAQ answering
  return "";
}

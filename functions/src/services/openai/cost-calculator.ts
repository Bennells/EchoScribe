/**
 * OpenAI Cost Calculator
 *
 * Calculates costs for OpenAI API usage based on current pricing (2025)
 * Supports GPT-4o, GPT-4o-mini, and GPT-4o-transcribe models
 */

/**
 * Calculate cost for OpenAI text generation (GPT models)
 *
 * Pricing (as of 2025):
 * - GPT-4o: $2.50/1M input tokens, $10.00/1M output tokens
 * - GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
 *
 * @param model - Model name ("gpt-4o" or "gpt-4o-mini")
 * @param inputTokens - Number of input (prompt) tokens
 * @param outputTokens - Number of output (completion) tokens
 * @returns Cost in USD and EUR
 */
export function calculateOpenAICost(
  model: "gpt-4o" | "gpt-4o-mini",
  inputTokens: number,
  outputTokens: number
): { costUSD: number; costEUR: number } {

  const rates = {
    "gpt-4o": {
      input: 2.50 / 1_000_000,  // $2.50 per 1M tokens
      output: 10.00 / 1_000_000, // $10.00 per 1M tokens
    },
    "gpt-4o-mini": {
      input: 0.15 / 1_000_000,  // $0.15 per 1M tokens
      output: 0.60 / 1_000_000, // $0.60 per 1M tokens
    }
  };

  const rate = rates[model];
  const costUSD = (inputTokens * rate.input) + (outputTokens * rate.output);
  const costEUR = costUSD * 0.93; // Approximate EUR conversion rate

  return { costUSD, costEUR };
}

/**
 * Calculate cost for GPT-4o-transcribe audio transcription
 *
 * Pricing (as of 2025):
 * - GPT-4o-transcribe: $0.006 per minute (same as legacy Whisper)
 *
 * @param durationMinutes - Audio duration in minutes
 * @returns Cost in USD and EUR
 */
export function calculateTranscriptionCost(durationMinutes: number): { costUSD: number; costEUR: number } {
  const costUSD = durationMinutes * 0.006; // $0.006 per minute
  const costEUR = costUSD * 0.93; // Approximate EUR conversion rate

  return { costUSD, costEUR };
}

/**
 * Calculate total cost for a complete podcast processing pipeline
 *
 * @param durationMinutes - Audio duration in minutes
 * @param articleInputTokens - Tokens in article generation input
 * @param articleOutputTokens - Tokens in article generation output
 * @param metadataInputTokens - Tokens in metadata generation input
 * @param metadataOutputTokens - Tokens in metadata generation output
 * @param articleModel - Model used for article generation (default: "gpt-4o-mini")
 * @param metadataModel - Model used for metadata generation (default: "gpt-4o-mini")
 * @returns Breakdown of costs and totals
 */
export function calculateTotalPipelineCost(
  durationMinutes: number,
  articleInputTokens: number,
  articleOutputTokens: number,
  metadataInputTokens: number,
  metadataOutputTokens: number,
  articleModel: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini",
  metadataModel: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini"
): {
  transcription: { costUSD: number; costEUR: number };
  article: { costUSD: number; costEUR: number };
  metadata: { costUSD: number; costEUR: number };
  total: { costUSD: number; costEUR: number };
} {
  const transcription = calculateTranscriptionCost(durationMinutes);
  const article = calculateOpenAICost(articleModel, articleInputTokens, articleOutputTokens);
  const metadata = calculateOpenAICost(metadataModel, metadataInputTokens, metadataOutputTokens);

  return {
    transcription,
    article,
    metadata,
    total: {
      costUSD: transcription.costUSD + article.costUSD + metadata.costUSD,
      costEUR: transcription.costEUR + article.costEUR + metadata.costEUR,
    }
  };
}

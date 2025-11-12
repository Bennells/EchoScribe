/**
 * Cost Calculator for Vertex AI / Gemini API Usage
 *
 * Calculates costs based on token usage and converts to EUR
 * for analytics and cost tracking purposes.
 */

import {
  GEMINI_PRICING,
  EUR_USD_EXCHANGE_RATE,
} from "./constants";

/**
 * Token usage information from Gemini API
 */
export interface TokenUsage {
  /** Number of tokens in the prompt/input */
  promptTokens: number;

  /** Number of tokens in the generated output */
  candidatesTokens: number;

  /** Total tokens (prompt + candidates) */
  totalTokens: number;
}

/**
 * Detailed cost breakdown
 */
export interface CostBreakdown {
  /** Input cost in USD */
  inputCostUSD: number;

  /** Output cost in USD */
  outputCostUSD: number;

  /** Total cost in USD */
  totalCostUSD: number;

  /** Input cost in EUR */
  inputCostEUR: number;

  /** Output cost in EUR */
  outputCostEUR: number;

  /** Total cost in EUR */
  totalCostEUR: number;

  /** Exchange rate used */
  exchangeRate: number;
}

/**
 * Calculate cost for text-based token usage
 *
 * @param usage Token usage information
 * @returns Detailed cost breakdown
 */
export function calculateTextTokenCost(usage: TokenUsage): CostBreakdown {
  // Calculate cost per token
  const inputCostPerToken = GEMINI_PRICING.INPUT_TEXT_PER_1M_TOKENS / 1_000_000;
  const outputCostPerToken = GEMINI_PRICING.OUTPUT_TEXT_PER_1M_TOKENS / 1_000_000;

  // Calculate costs in USD
  const inputCostUSD = usage.promptTokens * inputCostPerToken;
  const outputCostUSD = usage.candidatesTokens * outputCostPerToken;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  // Convert to EUR
  const inputCostEUR = inputCostUSD / EUR_USD_EXCHANGE_RATE;
  const outputCostEUR = outputCostUSD / EUR_USD_EXCHANGE_RATE;
  const totalCostEUR = totalCostUSD / EUR_USD_EXCHANGE_RATE;

  return {
    inputCostUSD,
    outputCostUSD,
    totalCostUSD,
    inputCostEUR,
    outputCostEUR,
    totalCostEUR,
    exchangeRate: EUR_USD_EXCHANGE_RATE,
  };
}

/**
 * Calculate cost for audio input (Stage 1 only)
 *
 * @param durationMinutes Audio duration in minutes
 * @returns Cost in USD and EUR
 */
export function calculateAudioInputCost(durationMinutes: number): {
  costUSD: number;
  costEUR: number;
} {
  const costUSD = durationMinutes * GEMINI_PRICING.AUDIO_INPUT_PER_MINUTE;
  const costEUR = costUSD / EUR_USD_EXCHANGE_RATE;

  return { costUSD, costEUR };
}

/**
 * Calculate total cost for a two-stage processing pipeline
 *
 * @param stage1Usage Token usage for Stage 1 (Audio → Article)
 * @param audioDurationMinutes Audio duration in minutes
 * @param stage2Usage Token usage for Stage 2 (Article → Metadata)
 * @returns Combined cost breakdown
 */
export function calculateTotalPipelineCost(
  stage1Usage: TokenUsage,
  audioDurationMinutes: number,
  stage2Usage: TokenUsage
): {
  stage1: CostBreakdown & { audioCostUSD: number; audioCostEUR: number };
  stage2: CostBreakdown;
  totalCostUSD: number;
  totalCostEUR: number;
  totalTokens: number;
} {
  // Calculate Stage 1 costs (text + audio)
  const stage1TextCost = calculateTextTokenCost(stage1Usage);
  const stage1AudioCost = calculateAudioInputCost(audioDurationMinutes);

  const stage1 = {
    ...stage1TextCost,
    audioCostUSD: stage1AudioCost.costUSD,
    audioCostEUR: stage1AudioCost.costEUR,
    totalCostUSD: stage1TextCost.totalCostUSD + stage1AudioCost.costUSD,
    totalCostEUR: stage1TextCost.totalCostEUR + stage1AudioCost.costEUR,
  };

  // Calculate Stage 2 costs (text only)
  const stage2 = calculateTextTokenCost(stage2Usage);

  // Calculate totals
  const totalCostUSD = stage1.totalCostUSD + stage2.totalCostUSD;
  const totalCostEUR = stage1.totalCostEUR + stage2.totalCostEUR;
  const totalTokens = stage1Usage.totalTokens + stage2Usage.totalTokens;

  return {
    stage1,
    stage2,
    totalCostUSD,
    totalCostEUR,
    totalTokens,
  };
}

/**
 * Format cost for display (e.g., "€0.0123" or "€0.00" for very small amounts)
 *
 * @param costEUR Cost in EUR
 * @returns Formatted string
 */
export function formatCostEUR(costEUR: number): string {
  if (costEUR < 0.01) {
    // For very small amounts, show more decimals
    return `€${costEUR.toFixed(4)}`;
  }

  return `€${costEUR.toFixed(2)}`;
}

/**
 * Format cost for display in USD
 *
 * @param costUSD Cost in USD
 * @returns Formatted string
 */
export function formatCostUSD(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${costUSD.toFixed(4)}`;
  }

  return `$${costUSD.toFixed(2)}`;
}

/**
 * Estimate token count from text (rough approximation)
 * Useful for pre-flight cost estimates
 *
 * Rule of thumb: ~4 characters per token for English text
 *
 * @param text Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost before making API call
 *
 * @param promptText Input prompt text
 * @param expectedOutputWords Expected output length in words
 * @param audioDurationMinutes Optional audio duration (for Stage 1)
 * @returns Estimated cost breakdown
 */
export function estimateCost(
  promptText: string,
  expectedOutputWords: number,
  audioDurationMinutes?: number
): CostBreakdown & { audioCostUSD?: number; audioCostEUR?: number } {
  // Estimate tokens (words * 1.3 to account for punctuation)
  const promptTokens = estimateTokenCount(promptText);
  const outputTokens = Math.ceil(expectedOutputWords * 1.3);

  const textCost = calculateTextTokenCost({
    promptTokens,
    candidatesTokens: outputTokens,
    totalTokens: promptTokens + outputTokens,
  });

  if (audioDurationMinutes) {
    const audioCost = calculateAudioInputCost(audioDurationMinutes);
    return {
      ...textCost,
      audioCostUSD: audioCost.costUSD,
      audioCostEUR: audioCost.costEUR,
      totalCostUSD: textCost.totalCostUSD + audioCost.costUSD,
      totalCostEUR: textCost.totalCostEUR + audioCost.costEUR,
    };
  }

  return textCost;
}

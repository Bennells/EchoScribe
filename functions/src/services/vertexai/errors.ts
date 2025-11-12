/**
 * Custom Error Classes for Vertex AI Processing
 *
 * Provides structured error context for better debugging and error handling
 */

/**
 * Processing stage where error occurred
 */
export type ProcessingStage = "stage1_article" | "stage2_metadata" | "pipeline" | "validation" | "retry";

/**
 * Error code for categorizing errors
 */
export type ErrorCode =
  | "MAX_TOKENS_EXCEEDED"
  | "SAFETY_FILTER_TRIGGERED"
  | "RECITATION_DETECTED"
  | "INVALID_RESPONSE_FORMAT"
  | "VALIDATION_FAILED"
  | "WORD_COUNT_TOO_LOW"
  | "MISSING_REQUIRED_FIELD"
  | "JSON_PARSE_ERROR"
  | "API_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "UNKNOWN";

/**
 * Structured error context
 */
export interface ErrorContext {
  /** Processing stage where error occurred */
  stage: ProcessingStage;

  /** Error code for categorization */
  code: ErrorCode;

  /** Attempt number (for retries) */
  attempt?: number;

  /** Maximum attempts allowed */
  maxAttempts?: number;

  /** Storage path being processed */
  storagePath?: string;

  /** Duration of podcast (if available) */
  durationMinutes?: number;

  /** Partial results (if any) */
  partialResults?: {
    wordCount?: number;
    responseLength?: number;
    finishReason?: string;
  };

  /** Token usage at time of error */
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };

  /** Original error (if wrapping another error) */
  originalError?: Error;

  /** Additional context-specific data */
  metadata?: Record<string, any>;
}

/**
 * Base error class for Vertex AI processing errors
 */
export class VertexAIProcessingError extends Error {
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(message: string, context: ErrorContext) {
    super(message);
    this.name = "VertexAIProcessingError";
    this.context = context;
    this.timestamp = new Date();

    // Maintain proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VertexAIProcessingError);
    }
  }

  /**
   * Get a human-readable summary of the error
   */
  public getSummary(): string {
    const parts: string[] = [
      `[${this.context.stage}]`,
      `[${this.context.code}]`,
      this.message,
    ];

    if (this.context.attempt && this.context.maxAttempts) {
      parts.push(`(Attempt ${this.context.attempt}/${this.context.maxAttempts})`);
    }

    return parts.join(" ");
  }

  /**
   * Get detailed error information for logging
   */
  public getDetails(): Record<string, any> {
    return {
      error: {
        name: this.name,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
      },
      context: {
        ...this.context,
        originalError: this.context.originalError
          ? {
              name: this.context.originalError.name,
              message: this.context.originalError.message,
              stack: this.context.originalError.stack,
            }
          : undefined,
      },
    };
  }

  /**
   * Check if error is retryable based on error code
   */
  public isRetryable(): boolean {
    const retryableCodes: ErrorCode[] = [
      "WORD_COUNT_TOO_LOW",
      "NETWORK_ERROR",
      "TIMEOUT",
      "API_ERROR",
    ];

    return retryableCodes.includes(this.context.code);
  }
}

/**
 * Error thrown when token limit is exceeded
 */
export class TokenLimitExceededError extends VertexAIProcessingError {
  constructor(stage: ProcessingStage, context: Partial<ErrorContext> = {}) {
    super(
      "Token limit exceeded - response was truncated before completion",
      {
        ...context,
        stage,
        code: "MAX_TOKENS_EXCEEDED",
      } as ErrorContext
    );
    this.name = "TokenLimitExceededError";
  }
}

/**
 * Error thrown when content violates safety filters
 */
export class SafetyFilterError extends VertexAIProcessingError {
  constructor(stage: ProcessingStage, context: Partial<ErrorContext> = {}) {
    super(
      "Content generation blocked by safety filters",
      {
        ...context,
        stage,
        code: "SAFETY_FILTER_TRIGGERED",
      } as ErrorContext
    );
    this.name = "SafetyFilterError";
  }
}

/**
 * Error thrown when response format is invalid
 */
export class InvalidResponseFormatError extends VertexAIProcessingError {
  constructor(stage: ProcessingStage, message: string, context: Partial<ErrorContext> = {}) {
    super(
      message,
      {
        ...context,
        stage,
        code: "INVALID_RESPONSE_FORMAT",
      } as ErrorContext
    );
    this.name = "InvalidResponseFormatError";
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends VertexAIProcessingError {
  constructor(stage: ProcessingStage, message: string, context: Partial<ErrorContext> = {}) {
    super(
      message,
      {
        ...context,
        stage,
        code: "VALIDATION_FAILED",
      } as ErrorContext
    );
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when article word count is too low
 */
export class WordCountTooLowError extends VertexAIProcessingError {
  constructor(
    actualWordCount: number,
    minimumRequired: number,
    context: Partial<ErrorContext> = {}
  ) {
    super(
      `Article too short: ${actualWordCount} words (minimum: ${minimumRequired})`,
      {
        ...context,
        stage: "validation",
        code: "WORD_COUNT_TOO_LOW",
        partialResults: {
          wordCount: actualWordCount,
        },
        metadata: {
          minimumRequired,
        },
      } as ErrorContext
    );
    this.name = "WordCountTooLowError";
  }
}

/**
 * Helper function to wrap unknown errors with context
 */
export function wrapError(
  error: unknown,
  stage: ProcessingStage,
  context: Partial<ErrorContext> = {}
): VertexAIProcessingError {
  if (error instanceof VertexAIProcessingError) {
    // Already wrapped, just return it
    return error;
  }

  const originalError = error instanceof Error ? error : new Error(String(error));

  return new VertexAIProcessingError(
    originalError.message,
    {
      ...context,
      stage,
      code: "UNKNOWN",
      originalError,
    } as ErrorContext
  );
}

/**
 * Helper function to determine error code from finishReason
 */
export function getErrorCodeFromFinishReason(finishReason: string): ErrorCode {
  switch (finishReason) {
    case "MAX_TOKENS":
      return "MAX_TOKENS_EXCEEDED";
    case "SAFETY":
      return "SAFETY_FILTER_TRIGGERED";
    case "RECITATION":
      return "RECITATION_DETECTED";
    default:
      return "UNKNOWN";
  }
}

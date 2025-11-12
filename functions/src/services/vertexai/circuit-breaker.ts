/**
 * Circuit Breaker Pattern for Vertex AI API Calls
 *
 * Protects the system from repeated calls to a failing service (Vertex AI).
 * Opens the circuit after N consecutive failures and prevents further calls
 * for a cooldown period, saving quota and providing faster user feedback.
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Too many failures, all requests rejected immediately
 * - HALF_OPEN: Testing if service recovered, one request allowed
 */

import * as logger from "firebase-functions/logger";
import {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_COOLDOWN_SECONDS,
} from "./constants";

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = "CLOSED",     // Normal operation
  OPEN = "OPEN",         // Rejecting requests
  HALF_OPEN = "HALF_OPEN" // Testing recovery
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;

  /** Cooldown period in seconds before attempting recovery */
  cooldownSeconds: number;

  /** Service name for logging */
  serviceName: string;
}

/**
 * Circuit breaker statistics
 */
interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: Date | null;
  totalFailures: number;
  totalSuccesses: number;
  circuitOpenedAt: Date | null;
  circuitClosedAt: Date | null;
}

/**
 * Circuit Breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures: number = 0;
  private lastFailureTime: Date | null = null;
  private circuitOpenedAt: Date | null = null;
  private circuitClosedAt: Date | null = null;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  constructor(private config: CircuitBreakerConfig) {
    logger.info(`[CircuitBreaker] Initialized for ${config.serviceName}`);
    logger.info(`[CircuitBreaker] Failure threshold: ${config.failureThreshold}`);
    logger.info(`[CircuitBreaker] Cooldown: ${config.cooldownSeconds}s`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        logger.info(`[CircuitBreaker] Cooldown elapsed, transitioning to HALF_OPEN`);
        this.state = CircuitState.HALF_OPEN;
      } else {
        const remainingCooldown = this.getRemainingCooldown();
        logger.warn(`[CircuitBreaker] Circuit is OPEN, rejecting request`);
        logger.warn(`[CircuitBreaker] Remaining cooldown: ${remainingCooldown}s`);
        throw new Error(
          `Circuit breaker is OPEN for ${this.config.serviceName}. ` +
          `Service is experiencing issues. ` +
          `Retry in ${remainingCooldown} seconds.`
        );
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Success! Reset failure counter
      this.onSuccess();

      return result;
    } catch (error) {
      // Failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    const previousState = this.state;

    if (this.state === CircuitState.HALF_OPEN) {
      // Recovery successful, close the circuit
      logger.info(`[CircuitBreaker] ✅ Recovery successful, closing circuit`);
      this.state = CircuitState.CLOSED;
      this.circuitClosedAt = new Date();
      this.consecutiveFailures = 0;
      this.lastFailureTime = null;
    } else if (this.consecutiveFailures > 0) {
      // Had some failures but now succeeded, reset counter
      logger.info(`[CircuitBreaker] Success after ${this.consecutiveFailures} failures, resetting`);
      this.consecutiveFailures = 0;
      this.lastFailureTime = null;
    }

    if (previousState !== this.state) {
      logger.info(`[CircuitBreaker] State transition: ${previousState} → ${this.state}`);
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(): void {
    this.totalFailures++;
    this.consecutiveFailures++;
    this.lastFailureTime = new Date();

    const previousState = this.state;

    logger.warn(`[CircuitBreaker] ❌ Failure recorded (${this.consecutiveFailures}/${this.config.failureThreshold})`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Recovery attempt failed, reopen circuit
      logger.error(`[CircuitBreaker] Recovery attempt failed, reopening circuit`);
      this.state = CircuitState.OPEN;
      this.circuitOpenedAt = new Date();
    } else if (this.consecutiveFailures >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      logger.error(`[CircuitBreaker] Failure threshold reached, opening circuit`);
      logger.error(`[CircuitBreaker] ${this.config.serviceName} will be blocked for ${this.config.cooldownSeconds}s`);
      this.state = CircuitState.OPEN;
      this.circuitOpenedAt = new Date();
    }

    if (previousState !== this.state) {
      logger.info(`[CircuitBreaker] State transition: ${previousState} → ${this.state}`);
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (!this.circuitOpenedAt) {
      return false;
    }

    const elapsedSeconds = (Date.now() - this.circuitOpenedAt.getTime()) / 1000;
    return elapsedSeconds >= this.config.cooldownSeconds;
  }

  /**
   * Get remaining cooldown time in seconds
   */
  private getRemainingCooldown(): number {
    if (!this.circuitOpenedAt) {
      return 0;
    }

    const elapsedSeconds = (Date.now() - this.circuitOpenedAt.getTime()) / 1000;
    const remaining = Math.max(0, this.config.cooldownSeconds - elapsedSeconds);
    return Math.ceil(remaining);
  }

  /**
   * Get current circuit breaker statistics
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      circuitOpenedAt: this.circuitOpenedAt,
      circuitClosedAt: this.circuitClosedAt,
    };
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Force reset the circuit (for testing or manual intervention)
   */
  public reset(): void {
    logger.info(`[CircuitBreaker] Manual reset triggered`);
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.circuitOpenedAt = null;
  }

  /**
   * Check if circuit is currently allowing requests
   */
  public isRequestAllowed(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    // OPEN state
    return this.shouldAttemptReset();
  }
}

/**
 * Singleton instance for Vertex AI circuit breaker
 */
let vertexAICircuitBreaker: CircuitBreaker | null = null;

/**
 * Get the Vertex AI circuit breaker instance (singleton)
 */
export function getVertexAICircuitBreaker(): CircuitBreaker {
  if (!vertexAICircuitBreaker) {
    vertexAICircuitBreaker = new CircuitBreaker({
      failureThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      cooldownSeconds: CIRCUIT_BREAKER_COOLDOWN_SECONDS,
      serviceName: "Vertex AI / Gemini",
    });
  }

  return vertexAICircuitBreaker;
}

/**
 * Reset the Vertex AI circuit breaker (for testing)
 */
export function resetVertexAICircuitBreaker(): void {
  if (vertexAICircuitBreaker) {
    vertexAICircuitBreaker.reset();
  }
}

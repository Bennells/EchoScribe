import { VertexAI } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";
import { config } from "../../config/environment";

/**
 * Singleton Vertex AI client instance
 */
let vertexAI: VertexAI | null = null;

/**
 * Get or initialize the Vertex AI client
 *
 * Lazy initialization pattern ensures client is only created when needed
 * and reused across multiple function calls.
 *
 * @returns Initialized Vertex AI client
 * @throws Error if projectId or location is missing
 */
export function getVertexAIClient(): VertexAI {
  if (!vertexAI) {
    logger.info("[Vertex AI] Initializing client...");

    const projectId = config.projectId;
    const location = config.region;

    if (!projectId || !location) {
      throw new Error("Vertex AI initialization failed: missing projectId or location");
    }

    vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    logger.info(`[Vertex AI] ✅ Client initialized | Region: ${location}`);
  }

  return vertexAI;
}

/**
 * Reset the Vertex AI client (useful for testing)
 */
export function resetVertexAIClient(): void {
  vertexAI = null;
}

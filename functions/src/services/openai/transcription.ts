import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as fs from "fs";
import { getOpenAIClient } from "./client";
import { calculateTranscriptionCost } from "./cost-calculator";
import { retryWithExponentialBackoff, withTimeout } from "./utils";
import { getOpenAICircuitBreaker } from "./circuit-breaker";
import { chunkAudioFile, cleanupChunks, mergeTranscripts } from "./audio-chunker";
import { TRANSCRIPTION_TIMEOUT_MS } from "./constants";

/**
 * Transcribe audio file using OpenAI GPT-4o-transcribe API
 *
 * This function handles both small (<25MB) and large (>25MB) files:
 * - Small files: Stream directly from Cloud Storage (no temp files, very fast)
 * - Large files: Chunk into 20-minute segments, transcribe each, merge results
 *
 * Uses retry logic, circuit breaker, and timeout protection
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param durationMinutes - Optional audio duration in minutes (for cost calculation)
 * @returns Transcript text and cost information
 */
export async function transcribeAudio(
  storagePath: string,
  durationMinutes?: number
): Promise<{
  transcript: string;
  costUSD: number;
  costEUR: number;
  durationSeconds?: number;
}> {
  logger.info("=".repeat(80));
  logger.info("[GPT-4o-transcribe] Starting audio transcription");
  logger.info("=".repeat(80));
  logger.info(`[GPT-4o-transcribe] Storage path: ${storagePath}`);
  if (durationMinutes) {
    logger.info(`[GPT-4o-transcribe] Expected duration: ${durationMinutes} minutes`);
  }

  const startTime = Date.now();

  try {
    // Get file metadata from Cloud Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`Audio file not found: ${storagePath}`);
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const fileSizeBytes = typeof metadata.size === 'number'
      ? metadata.size
      : parseInt(metadata.size || "0");
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    logger.info(`[GPT-4o-transcribe] File size: ${fileSizeMB.toFixed(2)} MB`);

    // ========================================
    // DECISION: Streaming vs Chunking
    // ========================================

    const needsChunking = fileSizeMB > 25;

    if (needsChunking) {
      // ========================================
      // LARGE FILE PATH: Use chunking strategy
      // ========================================
      logger.warn(`[GPT-4o-transcribe] File exceeds 25 MB limit`);
      logger.info(`[GPT-4o-transcribe] Using chunking strategy for large file`);

      return await transcribeWithChunking(storagePath, fileSizeMB, durationMinutes);

    } else {
      // ========================================
      // SMALL FILE PATH: Stream directly (FAST!)
      // ========================================
      logger.info(`[GPT-4o-transcribe] File is under 25 MB, using fast streaming`);

      return await transcribeWithStreaming(file, fileSizeMB, durationMinutes, startTime);
    }

  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error(String(error));
    logger.error("=".repeat(80));
    logger.error("[GPT-4o-transcribe] ❌ Transcription FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);

    throw typedError;
  }
}

/**
 * Transcribe small file using streaming download to /tmp
 *
 * FAST PATH (Phase 1):
 * - Streams file to /tmp using createReadStream (fast!)
 * - OpenAI SDK reads from local file
 * - Automatically cleans up temp file
 * - Works with Workload Identity (no signBlob permission needed)
 *
 * Why this approach:
 * 1. createReadStream() is MUCH faster than file.download()
 * 2. Works with Cloud Run service account (no special permissions)
 * 3. Local /tmp file = fastest for OpenAI SDK
 *
 * @param file Cloud Storage file reference
 * @param fileSizeMB File size in MB
 * @param durationMinutes Optional duration in minutes
 * @param startTime Start time for duration calculation
 */
async function transcribeWithStreaming(
  file: any, // Cloud Storage file reference (admin.storage().bucket().file())
  fileSizeMB: number,
  durationMinutes: number | undefined,
  startTime: number
): Promise<{
  transcript: string;
  costUSD: number;
  costEUR: number;
  durationSeconds?: number;
}> {

  // Fast download using streaming (works with Workload Identity)
  const tmpFilePath = `/tmp/${Date.now()}_${file.name.split('/').pop()}`;
  logger.info(`[GPT-4o-transcribe] Downloading file to: ${tmpFilePath}`);

  const downloadStart = Date.now();

  // Stream download using createReadStream (MUCH faster than file.download())
  const readStream = file.createReadStream();
  const writeStream = fs.createWriteStream(tmpFilePath);

  // Track download progress
  let downloadedBytes = 0;
  let lastLoggedMB = 0;

  readStream.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    const currentMB = Math.floor(downloadedBytes / (1024 * 1024));

    // Log every 1MB
    if (currentMB > lastLoggedMB) {
      const elapsedSec = (Date.now() - downloadStart) / 1000;
      const speedMBps = (downloadedBytes / (1024 * 1024)) / elapsedSec;
      logger.info(`[GPT-4o-transcribe] Download progress: ${currentMB} MB / ${fileSizeMB.toFixed(2)} MB (${speedMBps.toFixed(2)} MB/s)`);
      lastLoggedMB = currentMB;
    }
  });

  await new Promise<void>((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
  });

  const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(2);
  const avgSpeedMBps = (fileSizeMB / parseFloat(downloadDuration)).toFixed(2);
  logger.info(`[GPT-4o-transcribe] ✅ Download complete in ${downloadDuration}s (${fileSizeMB.toFixed(2)} MB @ ${avgSpeedMBps} MB/s)`);

  try {
    // Get OpenAI client
    const openai = getOpenAIClient();
    const circuitBreaker = getOpenAICircuitBreaker();

    // Transcribe with protection layers (retry + circuit breaker + timeout)
    const transcription = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            // Read from local temp file (FAST!)
            const audioStream = fs.createReadStream(tmpFilePath);

            const result = await openai.audio.transcriptions.create({
              file: audioStream as any,
              model: "gpt-4o-transcribe",
              language: "de",
              response_format: "json",
            });

            return result;
          });
        });
      },
      TRANSCRIPTION_TIMEOUT_MS,
      "GPT-4o-transcribe Transcription"
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[GPT-4o-transcribe] ✅ Transcription completed in ${duration}s (${downloadDuration}s download + API processing)`);

    // Extract transcript text
    const transcriptText = typeof transcription === 'string'
      ? transcription
      : transcription.text;

    logger.info(`[GPT-4o-transcribe] Transcript length: ${transcriptText.length} characters`);
    logger.info(`[GPT-4o-transcribe] Transcript preview (first 200 chars): ${transcriptText.slice(0, 200)}...`);

    const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;

    if (durationMinutes) {
      logger.info(`[GPT-4o-transcribe] Audio duration (provided): ${durationMinutes} minutes`);
    }

    // Calculate cost
    const audioMinutes = durationMinutes || 1;
    const { costUSD, costEUR } = calculateTranscriptionCost(audioMinutes);

    logger.info(`[GPT-4o-transcribe] 💰 Cost: $${costUSD.toFixed(6)} / €${costEUR.toFixed(6)}`);
    logger.info("=".repeat(80));
    logger.info("[GPT-4o-transcribe] ✅ Transcription successful");
    logger.info("=".repeat(80));

    return {
      transcript: transcriptText,
      costUSD,
      costEUR,
      durationSeconds,
    };
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
        logger.info(`[GPT-4o-transcribe] 🧹 Cleaned up temp file`);
      }
    } catch (cleanupError: unknown) {
      const error = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
      logger.warn(`[GPT-4o-transcribe] ⚠️ Failed to clean up temp file: ${error.message}`);
    }
  }
}

/**
 * Transcribe large file using chunking strategy
 *
 * CHUNKING PATH (Phase 2):
 * - Splits audio into 20-minute chunks with 30-second overlap
 * - Transcribes each chunk sequentially
 * - Merges transcripts with context preservation
 * - Cleans up temporary chunk files
 *
 * @param storagePath Cloud Storage path to audio file
 * @param fileSizeMB File size in MB
 * @param durationMinutes Optional duration in minutes
 */
async function transcribeWithChunking(
  storagePath: string,
  fileSizeMB: number,
  durationMinutes: number | undefined
): Promise<{
  transcript: string;
  costUSD: number;
  costEUR: number;
  durationSeconds?: number;
}> {

  logger.info("=".repeat(80));
  logger.info("[GPT-4o-transcribe] CHUNKING MODE: Processing large file");
  logger.info("=".repeat(80));

  // Chunk the audio file
  const chunks = await chunkAudioFile(storagePath, fileSizeMB, durationMinutes);

  logger.info(`[GPT-4o-transcribe] Processing ${chunks.length} chunks sequentially...`);

  // Transcribe each chunk
  const transcripts: string[] = [];
  let totalCostUSD = 0;
  let totalCostEUR = 0;

  const openai = getOpenAIClient();
  const circuitBreaker = getOpenAICircuitBreaker();

  for (const chunk of chunks) {
    logger.info("\n" + "-".repeat(80));
    logger.info(`[GPT-4o-transcribe] Chunk ${chunk.chunkIndex + 1}/${chunks.length}`);
    logger.info(`[GPT-4o-transcribe] Start: ${chunk.startSeconds}s | Duration: ${(chunk.durationSeconds / 60).toFixed(2)} min`);
    logger.info("-".repeat(80));

    const chunkStart = Date.now();

    const chunkTranscription = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            // Read chunk file as stream
            const fileStream = fs.createReadStream(chunk.filePath);

            const result = await openai.audio.transcriptions.create({
              file: fileStream as any,
              model: "gpt-4o-transcribe",
              language: "de",
              response_format: "json",
            });

            return result;
          });
        });
      },
      TRANSCRIPTION_TIMEOUT_MS, // 60 minutes timeout per chunk
      `GPT-4o-transcribe Chunk ${chunk.chunkIndex + 1}`
    );

    const chunkDuration = ((Date.now() - chunkStart) / 1000).toFixed(2);

    const chunkText = typeof chunkTranscription === 'string'
      ? chunkTranscription
      : chunkTranscription.text;

    transcripts.push(chunkText);

    // Calculate chunk cost
    const chunkMinutes = chunk.durationSeconds / 60;
    const { costUSD, costEUR } = calculateTranscriptionCost(chunkMinutes);
    totalCostUSD += costUSD;
    totalCostEUR += costEUR;

    logger.info(`[GPT-4o-transcribe] ✅ Chunk ${chunk.chunkIndex + 1} complete in ${chunkDuration}s`);
    logger.info(`[GPT-4o-transcribe]    - Transcript: ${chunkText.length} chars`);
    logger.info(`[GPT-4o-transcribe]    - Cost: $${costUSD.toFixed(6)} / €${costEUR.toFixed(6)}`);
  }

  logger.info("\n" + "=".repeat(80));
  logger.info("[GPT-4o-transcribe] All chunks transcribed, merging results...");
  logger.info("=".repeat(80));

  // Merge transcripts
  const mergedTranscript = mergeTranscripts(chunks, transcripts);

  // Clean up chunk files
  await cleanupChunks(chunks);

  // Calculate final duration
  const durationSeconds = durationMinutes ? durationMinutes * 60 : undefined;

  logger.info("\n" + "=".repeat(80));
  logger.info("[GPT-4o-transcribe] ✅ Chunked transcription complete");
  logger.info(`[GPT-4o-transcribe] Final transcript: ${mergedTranscript.length} characters`);
  logger.info(`[GPT-4o-transcribe] Total cost: $${totalCostUSD.toFixed(6)} / €${totalCostEUR.toFixed(6)}`);
  logger.info("=".repeat(80));

  return {
    transcript: mergedTranscript,
    costUSD: totalCostUSD,
    costEUR: totalCostEUR,
    durationSeconds,
  };
}

import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import {
  createTempFilePath,
  createChunkFilePath,
  cleanupTempFile,
  cleanupTempFiles,
  formatBytes,
} from "./temp-file-manager";

// Point fluent-ffmpeg to static binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface AudioChunk {
  chunkIndex: number;
  startSeconds: number;
  durationSeconds: number;
  filePath: string;
}

/**
 * Split large audio files into chunks for OpenAI transcription
 *
 * Strategy:
 * - 20-minute chunks (1200 seconds) - stay well under 25MB limit
 * - 30-second overlap between chunks (for context preservation)
 * - Uses ffmpeg with -c copy (no re-encoding, very fast)
 *
 * @param storagePath Cloud Storage path to audio file
 * @param fileSizeMB File size in MB
 * @param durationMinutes Estimated audio duration in minutes (optional)
 * @returns Array of audio chunks ready for transcription
 */
export async function chunkAudioFile(
  storagePath: string,
  fileSizeMB: number,
  durationMinutes?: number
): Promise<AudioChunk[]> {

  const CHUNK_DURATION_SECONDS = 1200; // 20 minutes
  const OVERLAP_SECONDS = 30; // 30 second overlap for context

  logger.info("=".repeat(80));
  logger.info(`[Audio Chunker] Starting chunking for large file`);
  logger.info(`[Audio Chunker] File size: ${formatBytes(fileSizeMB * 1024 * 1024)}`);
  if (durationMinutes) {
    logger.info(`[Audio Chunker] Estimated duration: ${durationMinutes} minutes`);
  }
  logger.info("=".repeat(80));

  // Download file to temp location for chunking
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const fileExtension = path.extname(storagePath) || ".mp3";
  const tempInputPath = createTempFilePath(storagePath, "input");

  logger.info(`[Audio Chunker] Downloading to: ${tempInputPath}`);
  const downloadStart = Date.now();

  await file.download({ destination: tempInputPath });

  const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(2);
  logger.info(`[Audio Chunker] ✅ Download complete in ${downloadDuration}s`);

  // Get actual audio duration using ffprobe
  logger.info(`[Audio Chunker] Analyzing audio file with ffprobe...`);
  const actualDuration = await getAudioDuration(tempInputPath);
  const actualMinutes = (actualDuration / 60).toFixed(2);
  logger.info(`[Audio Chunker] Actual duration: ${actualMinutes} minutes (${actualDuration.toFixed(2)}s)`);

  // Calculate number of chunks needed
  const totalChunks = Math.ceil(actualDuration / CHUNK_DURATION_SECONDS);
  logger.info(`[Audio Chunker] Splitting into ${totalChunks} chunks (${CHUNK_DURATION_SECONDS / 60} minutes each with ${OVERLAP_SECONDS}s overlap)`);

  const chunks: AudioChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startSeconds = i * CHUNK_DURATION_SECONDS;
    const remainingDuration = actualDuration - startSeconds;

    // For the last chunk, don't add overlap (no next chunk to overlap with)
    const isLastChunk = (i === totalChunks - 1);
    const chunkDuration = isLastChunk
      ? remainingDuration
      : Math.min(CHUNK_DURATION_SECONDS + OVERLAP_SECONDS, remainingDuration);

    const chunkPath = createChunkFilePath(i, fileExtension);

    logger.info(`[Audio Chunker] Creating chunk ${i + 1}/${totalChunks}: ${startSeconds}s - ${(startSeconds + chunkDuration).toFixed(0)}s (${(chunkDuration / 60).toFixed(2)} min)`);

    const chunkStart = Date.now();
    await splitAudioChunk(tempInputPath, chunkPath, startSeconds, chunkDuration);
    const chunkTime = ((Date.now() - chunkStart) / 1000).toFixed(2);

    logger.info(`[Audio Chunker] ✅ Chunk ${i + 1} created in ${chunkTime}s: ${chunkPath}`);

    chunks.push({
      chunkIndex: i,
      startSeconds,
      durationSeconds: chunkDuration,
      filePath: chunkPath,
    });
  }

  // Clean up input file using centralized utility
  cleanupTempFile(tempInputPath);

  logger.info("=".repeat(80));
  logger.info(`[Audio Chunker] ✅ Chunking complete: ${chunks.length} chunks created`);
  logger.info("=".repeat(80));

  return chunks;
}

/**
 * Get audio duration using ffprobe
 *
 * @param filePath Path to audio file
 * @returns Duration in seconds
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logger.error(`[Audio Chunker] ffprobe error: ${err.message}`);
        reject(err);
        return;
      }

      const duration = metadata.format.duration;
      if (!duration) {
        reject(new Error("Could not determine audio duration from metadata"));
        return;
      }

      resolve(duration);
    });
  });
}

/**
 * Split audio file into chunk using ffmpeg
 *
 * Uses -c copy for fast processing (no re-encoding):
 * - Extracts audio segment without quality loss
 * - 10-100x faster than re-encoding
 * - Maintains original codec and bitrate
 *
 * @param inputPath Path to input audio file
 * @param outputPath Path to output chunk file
 * @param startSeconds Start time in seconds
 * @param durationSeconds Duration of chunk in seconds
 */
function splitAudioChunk(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  durationSeconds: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(durationSeconds)
      .outputOptions([
        "-c copy", // Copy codec (no re-encoding, very fast)
        "-avoid_negative_ts make_zero", // Fix timestamp issues at boundaries
      ])
      .output(outputPath)
      .on("start", (commandLine) => {
        logger.info(`[Audio Chunker] ffmpeg command: ${commandLine}`);
      })
      .on("end", () => {
        logger.info(`[Audio Chunker] ffmpeg complete: ${outputPath}`);
        resolve();
      })
      .on("error", (err) => {
        logger.error(`[Audio Chunker] ffmpeg error: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/**
 * Clean up chunk files after transcription
 *
 * @param chunks Array of audio chunks to clean up
 */
export async function cleanupChunks(chunks: AudioChunk[]): Promise<void> {
  logger.info(`[Audio Chunker] Cleaning up ${chunks.length} chunk files`);

  const filePaths = chunks.map(chunk => chunk.filePath);
  const deletedCount = cleanupTempFiles(filePaths);

  if (deletedCount === chunks.length) {
    logger.info(`[Audio Chunker] ✅ Cleanup complete: ${deletedCount} files deleted`);
  } else {
    logger.warn(`[Audio Chunker] ⚠️ Partial cleanup: ${deletedCount}/${chunks.length} files deleted`);
  }
}

/**
 * Merge transcripts from multiple chunks
 *
 * Handles overlap by simple concatenation with paragraph breaks.
 * The 30-second overlap ensures context is preserved at chunk boundaries,
 * but we don't try to detect and remove duplicate text (GPT-4o-transcribe
 * may produce slightly different transcriptions even for the same audio).
 *
 * @param chunks Array of audio chunks
 * @param transcripts Array of transcript texts (must match chunks length)
 * @returns Merged transcript
 */
export function mergeTranscripts(
  chunks: AudioChunk[],
  transcripts: string[]
): string {
  if (chunks.length !== transcripts.length) {
    throw new Error(
      `Chunk count mismatch: ${chunks.length} chunks but ${transcripts.length} transcripts`
    );
  }

  if (chunks.length === 1) {
    return transcripts[0];
  }

  logger.info("=".repeat(80));
  logger.info(`[Audio Chunker] Merging ${transcripts.length} transcripts`);
  logger.info("=".repeat(80));

  let mergedTranscript = transcripts[0];
  logger.info(`[Audio Chunker] Base transcript (chunk 0): ${transcripts[0].length} chars`);

  for (let i = 1; i < transcripts.length; i++) {
    // Simple merge: add paragraph break and append next transcript
    // The 30-second overlap ensures smooth transitions
    mergedTranscript += "\n\n" + transcripts[i];

    logger.info(`[Audio Chunker] Added chunk ${i}: +${transcripts[i].length} chars (total: ${mergedTranscript.length} chars)`);
  }

  logger.info("=".repeat(80));
  logger.info(`[Audio Chunker] ✅ Merged transcript complete: ${mergedTranscript.length} characters`);
  logger.info("=".repeat(80));

  return mergedTranscript;
}

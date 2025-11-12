/**
 * Temp File Manager
 *
 * Centralized utilities for managing temporary files in /tmp directory
 * during audio processing operations.
 */

import * as fs from "fs";
import * as path from "path";
import * as functions from "firebase-functions";

/**
 * Creates a standardized temporary file path in /tmp directory
 *
 * @param originalFileName - Original filename from Cloud Storage
 * @param prefix - Optional prefix (default: 'echoscribe')
 * @returns Full path to temporary file
 *
 * @example
 * createTempFilePath('podcast.mp3')
 * // Returns: '/tmp/echoscribe_1699564123456_podcast.mp3'
 */
export function createTempFilePath(
  originalFileName: string,
  prefix = "echoscribe"
): string {
  const timestamp = Date.now();
  const basename = path.basename(originalFileName);
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return path.join("/tmp", `${prefix}_${timestamp}_${sanitized}`);
}

/**
 * Creates a temporary file path for audio chunks
 *
 * @param chunkIndex - Index of the chunk (0-based)
 * @param fileExtension - File extension including dot (e.g., '.mp3')
 * @returns Full path to chunk file
 *
 * @example
 * createChunkFilePath(0, '.mp3')
 * // Returns: '/tmp/echoscribe_chunk_0_1699564123456.mp3'
 */
export function createChunkFilePath(
  chunkIndex: number,
  fileExtension: string
): string {
  const timestamp = Date.now();
  return path.join("/tmp", `echoscribe_chunk_${chunkIndex}_${timestamp}${fileExtension}`);
}

/**
 * Ensures the /tmp directory exists (should always exist on Cloud Functions)
 *
 * @returns true if directory exists or was created
 */
export function ensureTempDir(): boolean {
  try {
    if (!fs.existsSync("/tmp")) {
      fs.mkdirSync("/tmp", { recursive: true });
      functions.logger.info("Created /tmp directory");
    }
    return true;
  } catch (error) {
    functions.logger.error("Failed to ensure /tmp directory exists", { error });
    return false;
  }
}

/**
 * Safely deletes a temporary file with error handling
 *
 * @param filePath - Path to file to delete
 * @returns true if file was deleted or didn't exist, false on error
 */
export function cleanupTempFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      functions.logger.debug(`Cleaned up temp file: ${filePath}`);
      return true;
    }
    return true; // File doesn't exist, nothing to clean
  } catch (error) {
    functions.logger.error(`Failed to cleanup temp file: ${filePath}`, { error });
    return false;
  }
}

/**
 * Safely deletes multiple temporary files
 *
 * @param filePaths - Array of file paths to delete
 * @returns Number of successfully deleted files
 */
export function cleanupTempFiles(filePaths: string[]): number {
  let successCount = 0;

  for (const filePath of filePaths) {
    if (cleanupTempFile(filePath)) {
      successCount++;
    }
  }

  if (successCount < filePaths.length) {
    functions.logger.warn(
      `Cleanup incomplete: ${successCount}/${filePaths.length} files deleted`
    );
  } else {
    functions.logger.debug(
      `Successfully cleaned up ${successCount} temp files`
    );
  }

  return successCount;
}

/**
 * Cleans up all temp files matching a pattern
 *
 * @param pattern - Glob pattern to match (e.g., 'echoscribe_chunk_*')
 * @returns Number of deleted files
 */
export function cleanupTempFilesByPattern(pattern: string): number {
  try {
    const files = fs.readdirSync("/tmp");
    const matchingFiles = files.filter(file => {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(file);
    });

    const fullPaths = matchingFiles.map(file => path.join("/tmp", file));
    return cleanupTempFiles(fullPaths);
  } catch (error) {
    functions.logger.error(`Failed to cleanup files by pattern: ${pattern}`, { error });
    return 0;
  }
}

/**
 * Gets file size in bytes
 *
 * @param filePath - Path to file
 * @returns File size in bytes, or 0 if file doesn't exist
 */
export function getFileSize(filePath: string): number {
  try {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).size;
    }
    return 0;
  } catch (error) {
    functions.logger.error(`Failed to get file size: ${filePath}`, { error });
    return 0;
  }
}

/**
 * Formats bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

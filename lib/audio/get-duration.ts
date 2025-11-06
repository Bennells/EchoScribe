/**
 * Extract audio duration in minutes from an audio file using the browser's Audio API
 * @param file Audio file to extract duration from
 * @returns Duration in minutes (rounded up to nearest minute)
 */
export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(objectUrl);
      // Convert seconds to minutes and round up
      const minutes = Math.ceil(audio.duration / 60);
      resolve(minutes);
    });

    audio.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load audio metadata"));
    });

    audio.src = objectUrl;
  });
}

/**
 * Extract durations for multiple audio files
 * @param files Array of audio files
 * @returns Array of durations in minutes
 */
export async function getAudioDurations(files: File[]): Promise<number[]> {
  return Promise.all(files.map((file) => getAudioDuration(file)));
}

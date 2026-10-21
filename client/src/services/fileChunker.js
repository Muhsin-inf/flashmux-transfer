export const DEFAULT_CHUNK_SIZE = 65536; // 64 KB per chunk

/**
 * Slices a chunk from a File or Blob and returns an ArrayBuffer
 * Operates on-demand to maintain zero RAM bloat.
 */
export async function readChunkSlice(file, chunkIndex, chunkSize = DEFAULT_CHUNK_SIZE) {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const slice = file.slice(start, end);
  return await slice.arrayBuffer();
}

/**
 * Calculates total chunks for a given file size
 */
export function calculateTotalChunks(fileSize, chunkSize = DEFAULT_CHUNK_SIZE) {
  if (fileSize <= 0) return 1;
  return Math.ceil(fileSize / chunkSize);
}

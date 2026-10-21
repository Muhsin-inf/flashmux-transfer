import { CHUNK_SIZE } from '../config/webrtcConfig.js';

/**
 * Splits a File into chunks and reads each chunk as ArrayBuffer
 */
export async function* getFileChunks(file) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let offset = 0;
  let chunkIndex = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();

    yield {
      chunkIndex,
      totalChunks,
      data: buffer,
      isLast: chunkIndex === totalChunks - 1
    };

    offset += CHUNK_SIZE;
    chunkIndex++;
  }
}

/**
 * Class to assemble incoming chunks into a downloaded file
 */
export class FileAssembler {
  constructor(metadata) {
    this.name = metadata.name;
    this.size = metadata.size;
    this.type = metadata.type || 'application/octet-stream';
    this.totalChunks = metadata.totalChunks;
    this.chunks = [];
    this.receivedBytes = 0;
  }

  addChunk(chunkBuffer) {
    this.chunks.push(chunkBuffer);
    this.receivedBytes += chunkBuffer.byteLength;
  }

  isComplete() {
    return this.chunks.length >= this.totalChunks;
  }

  getProgress() {
    if (this.size === 0) return 100;
    return Math.min(100, Math.round((this.receivedBytes / this.size) * 100));
  }

  getBlob() {
    return new Blob(this.chunks, { type: this.type });
  }

  download() {
    const blob = this.getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/**
 * FlashMux Optical QR Fountain Code Engine
 * Implements Luby Transform / Systematic Fountain Codes with pako zlib compression.
 */
import { deflate, inflate } from 'pako';

export const DEFAULT_QR_BLOCK_SIZE = 1200; // Optimal byte payload per QR frame (reduced block count)
export const MAGIC_HEADER = 'FM1';

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple CRC32 implementation for integrity verification
 */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Fast binary XOR between two Uint8Arrays
 */
function xorBlocks(a, b) {
  const len = Math.max(a.length, b.length);
  const res = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    res[i] = (a[i] || 0) ^ (b[i] || 0);
  }
  return res;
}

/**
 * Converts Uint8Array to base64 string
 */
function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to Uint8Array
 */
function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * FountainEncoder: splits compressed payload into K blocks and generates systematic + fountain droplets.
 */
export class FountainEncoder {
  /**
   * @param {Uint8Array} fileBytes - Raw file data
   * @param {Object} metadata - File metadata { fileName, fileType, originalSize }
   * @param {number} blockSize - Block size in bytes (default: 450)
   */
  constructor(fileBytes, metadata = {}, blockSize = DEFAULT_QR_BLOCK_SIZE) {
    this.blockSize = blockSize;
    this.metadata = {
      name: metadata.fileName || 'file.bin',
      type: metadata.fileType || 'application/octet-stream',
      size: metadata.fileSize || fileBytes.length,
      crc: crc32(fileBytes),
    };

    // 1. Pack metadata header (2 bytes length + UTF8 JSON) + fileBytes
    const metaJson = JSON.stringify(this.metadata);
    const metaBytes = new TextEncoder().encode(metaJson);
    const packed = new Uint8Array(2 + metaBytes.length + fileBytes.length);
    new DataView(packed.buffer).setUint16(0, metaBytes.length, true);
    packed.set(metaBytes, 2);
    packed.set(fileBytes, 2 + metaBytes.length);

    // 2. Compress packed data with pako deflate
    this.compressed = deflate(packed);
    this.totalCompressedBytes = this.compressed.length;

    // 3. Partition into K blocks
    this.K = Math.max(1, Math.ceil(this.totalCompressedBytes / this.blockSize));
    this.blocks = [];

    for (let i = 0; i < this.K; i++) {
      const start = i * this.blockSize;
      const end = Math.min(start + this.blockSize, this.totalCompressedBytes);
      const block = new Uint8Array(this.blockSize);
      block.set(this.compressed.subarray(start, end));
      this.blocks.push(block);
    }

    // Short transfer ID (4 hex chars)
    this.transferId = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
    this.currentSeq = 0;
  }

  /**
   * Generates the droplet indices for non-systematic droplets (seq >= K)
   */
  getDropletIndices(seq) {
    if (seq < this.K) {
      return [seq];
    }
    const seed = (parseInt(this.transferId, 16) * 31 + seq) >>> 0;
    const rng = mulberry32(seed);

    // Degree between 2 and min(K, 8)
    const maxDegree = Math.min(this.K, 8);
    const degree = Math.min(this.K, Math.floor(rng() * (maxDegree - 1)) + 2);

    const indices = new Set();
    while (indices.size < degree) {
      const idx = Math.floor(rng() * this.K);
      indices.add(idx);
    }
    return Array.from(indices);
  }

  /**
   * Encodes droplet at sequence number into QR text packet
   * Format: FM1|<transferId>|<seq>|<K>|<totalCompressedBytes>|<payloadBase64>
   */
  getDroplet(seq = this.currentSeq) {
    const indices = this.getDropletIndices(seq);
    let payload = new Uint8Array(this.blockSize);

    for (let i = 0; i < indices.length; i++) {
      payload = xorBlocks(payload, this.blocks[indices[i]]);
    }

    const payloadB64 = uint8ToBase64(payload);
    const packet = `${MAGIC_HEADER}|${this.transferId}|${seq}|${this.K}|${this.totalCompressedBytes}|${payloadB64}`;

    this.currentSeq += 1;
    return {
      packet,
      seq,
      K: this.K,
      transferId: this.transferId,
      metadata: this.metadata,
      totalCompressedBytes: this.totalCompressedBytes,
      isSystematic: seq < this.K,
    };
  }

  reset() {
    this.currentSeq = 0;
  }
}

/**
 * FountainDecoder: processes incoming droplets and reconstructs original file via peeling decoder.
 */
export class FountainDecoder {
  constructor() {
    this.reset();
  }

  reset() {
    this.transferId = null;
    this.K = 0;
    this.totalCompressedBytes = 0;
    this.blockSize = 0;
    this.solvedBlocks = new Map(); // index -> Uint8Array
    this.equations = []; // { indices: Set<number>, data: Uint8Array }
    this.scannedSeqs = new Set();
    this.isComplete = false;
    this.reconstructedFile = null;
    this.reconstructedMetadata = null;
    this.error = null;
  }

  /**
   * Parses and validates raw QR string
   */
  parsePacket(qrString) {
    if (!qrString || typeof qrString !== 'string') return null;
    if (!qrString.startsWith(MAGIC_HEADER + '|')) return null;

    const parts = qrString.split('|');
    if (parts.length < 6) return null;

    const [, transferId, seqStr, kStr, totalBytesStr, payloadB64] = parts;
    const seq = parseInt(seqStr, 10);
    const K = parseInt(kStr, 10);
    const totalCompressedBytes = parseInt(totalBytesStr, 10);

    if (isNaN(seq) || isNaN(K) || isNaN(totalCompressedBytes) || !payloadB64) {
      return null;
    }

    try {
      const data = base64ToUint8(payloadB64);
      return {
        transferId,
        seq,
        K,
        totalCompressedBytes,
        data,
      };
    } catch {
      return null;
    }
  }

  /**
   * Recreates droplet indices from seed (must match encoder)
   */
  getDropletIndices(transferId, seq, K) {
    if (seq < K) {
      return [seq];
    }
    const seed = (parseInt(transferId, 16) * 31 + seq) >>> 0;
    const rng = mulberry32(seed);
    const maxDegree = Math.min(K, 8);
    const degree = Math.min(K, Math.floor(rng() * (maxDegree - 1)) + 2);

    const indices = new Set();
    while (indices.size < degree) {
      const idx = Math.floor(rng() * K);
      indices.add(idx);
    }
    return Array.from(indices);
  }

  /**
   * Ingests a scanned QR string
   * @param {string} qrString
   * @returns {Object} Progress information
   */
  processPacket(qrString) {
    if (this.isComplete) {
      return {
        isComplete: true,
        progress: 100,
        solved: this.K,
        K: this.K,
        reconstructedFile: this.reconstructedFile,
        metadata: this.reconstructedMetadata,
      };
    }

    const parsed = this.parsePacket(qrString);
    if (!parsed) {
      return { valid: false };
    }

    const { transferId, seq, K, totalCompressedBytes, data } = parsed;

    // If new transferId detected, reset session
    if (this.transferId && this.transferId !== transferId) {
      this.reset();
    }

    this.transferId = transferId;
    this.K = K;
    this.totalCompressedBytes = totalCompressedBytes;
    this.blockSize = data.length;
    this.scannedSeqs.add(seq);

    // Initial indices for this droplet
    const rawIndices = this.getDropletIndices(transferId, seq, K);
    let dropletIndices = new Set(rawIndices);
    let dropletData = new Uint8Array(data);

    // 1. Substitute already solved blocks
    for (const solvedIdx of this.solvedBlocks.keys()) {
      if (dropletIndices.has(solvedIdx)) {
        dropletIndices.delete(solvedIdx);
        dropletData = xorBlocks(dropletData, this.solvedBlocks.get(solvedIdx));
      }
    }

    // 2. If degree is 1, we found a new solved block!
    if (dropletIndices.size === 1) {
      const [newSolvedIdx] = dropletIndices;
      if (!this.solvedBlocks.has(newSolvedIdx)) {
        this.solvedBlocks.set(newSolvedIdx, dropletData);
        this.peelEquations();
      }
    } else if (dropletIndices.size > 1) {
      // Add equation to backlog
      this.equations.push({
        indices: dropletIndices,
        data: dropletData,
      });
    }

    const progress = Math.min(100, Math.round((this.solvedBlocks.size / this.K) * 100));

    // Check completion
    if (this.solvedBlocks.size >= this.K && !this.isComplete) {
      try {
        this.finalizeReconstruction();
        this.isComplete = true;
      } catch (err) {
        console.error('[FountainDecoder] Reconstruction error:', err);
        this.error = err.message;
      }
    }

    return {
      valid: true,
      transferId,
      seq,
      solved: this.solvedBlocks.size,
      K: this.K,
      progress,
      isComplete: this.isComplete,
      scannedCount: this.scannedSeqs.size,
      reconstructedFile: this.reconstructedFile,
      metadata: this.reconstructedMetadata,
      error: this.error,
    };
  }

  /**
   * Peeling step: iteratively solves equations with degree 1
   */
  peelEquations() {
    let progressMade = true;

    while (progressMade) {
      progressMade = false;

      for (let i = this.equations.length - 1; i >= 0; i--) {
        const eq = this.equations[i];

        // Substitute known blocks
        for (const solvedIdx of this.solvedBlocks.keys()) {
          if (eq.indices.has(solvedIdx)) {
            eq.indices.delete(solvedIdx);
            eq.data = xorBlocks(eq.data, this.solvedBlocks.get(solvedIdx));
          }
        }

        if (eq.indices.size === 0) {
          // Redundant equation
          this.equations.splice(i, 1);
        } else if (eq.indices.size === 1) {
          const [newSolvedIdx] = eq.indices;
          if (!this.solvedBlocks.has(newSolvedIdx)) {
            this.solvedBlocks.set(newSolvedIdx, eq.data);
            progressMade = true;
          }
          this.equations.splice(i, 1);
        }
      }
    }
  }

  /**
   * Finalizes file reconstruction by assembling blocks, decompressing, and verifying CRC
   */
  finalizeReconstruction() {
    // 1. Assemble K blocks in order
    const compressed = new Uint8Array(this.totalCompressedBytes);
    for (let i = 0; i < this.K; i++) {
      const block = this.solvedBlocks.get(i);
      if (!block) {
        throw new Error(`Missing block ${i} during reconstruction`);
      }
      const start = i * this.blockSize;
      const end = Math.min(start + this.blockSize, this.totalCompressedBytes);
      compressed.set(block.subarray(0, end - start), start);
    }

    // 2. Decompress with pako
    const unpacked = inflate(compressed);

    // 3. Read metadata length and parse
    const metaLen = new DataView(unpacked.buffer, unpacked.byteOffset, unpacked.byteLength).getUint16(0, true);
    const metaBytes = unpacked.subarray(2, 2 + metaLen);
    const metaJson = new TextDecoder().decode(metaBytes);
    const metadata = JSON.parse(metaJson);

    // 4. Extract raw file bytes
    const rawFileBytes = unpacked.subarray(2 + metaLen);

    // 5. Verify CRC
    const calculatedCrc = crc32(rawFileBytes);
    if (metadata.crc !== undefined && calculatedCrc !== metadata.crc) {
      console.warn(`[FountainDecoder] CRC mismatch: expected ${metadata.crc}, got ${calculatedCrc}`);
    }

    this.reconstructedMetadata = metadata;
    this.reconstructedFile = new Blob([rawFileBytes], { type: metadata.type || 'application/octet-stream' });
    this.reconstructedFile.name = metadata.name || 'received_file';
  }
}

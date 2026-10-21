import { DEFAULT_CHUNK_SIZE, calculateTotalChunks, readChunkSlice } from './fileChunker.js';
import { createIncrementalHasher } from '../utils/hashCalculator.js';

/**
 * Checks if FileSystem Access API is supported for single files
 */
export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Checks if Directory Picker is supported for saving entire folders
 */
export function isDirectoryPickerSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Prompts user to pick a folder on desktop (Chrome/Edge) to stream all received files directly to disk
 */
export async function promptSaveDirectoryHandle() {
  if (!isDirectoryPickerSupported()) {
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[FileWriter] User cancelled directory picker');
      return null;
    }
    console.warn('[FileWriter] showDirectoryPicker failed:', err.message);
    return null;
  }
}

/**
 * Prompts user for single file save location
 */
export async function promptSaveFileHandle(suggestedName) {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || 'downloaded_file',
      types: [
        {
          description: 'All Files',
          accept: { '*/*': [] },
        },
      ],
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[FileWriter] User cancelled file picker');
      return null;
    }
    console.warn('[FileWriter] showSaveFilePicker failed:', err.message);
    return null;
  }
}

/**
 * Helper to compute MD5 hash from a File or Blob
 */
export async function computeFileMD5(file) {
  const hasher = createIncrementalHasher();
  const totalChunks = calculateTotalChunks(file.size, DEFAULT_CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunkBuffer = await readChunkSlice(file, i, DEFAULT_CHUNK_SIZE);
    hasher.append(chunkBuffer);
  }
  return hasher.finalize();
}

/**
 * BatchFileWriter coordinates writing multiple files and folders directly to disk
 * or buffering files one-by-one for mobile fallback to ensure minimal RAM usage.
 */
export class BatchFileWriter {
  constructor({ directoryHandle = null, singleFileHandle = null }) {
    this.directoryHandle = directoryHandle;
    this.singleFileHandle = singleFileHandle;

    this.currentFile = null;
    this.currentFileHandle = null;
    this.currentStream = null;
    this.currentChunksMap = new Map();
    this.isClosed = false;
    this.completedFiles = [];
  }

  async startFile(fileMeta) {
    this.currentFile = fileMeta;
    this.currentFileHandle = null;
    this.currentChunksMap.clear();

    const chunkSize = fileMeta.chunkSize || DEFAULT_CHUNK_SIZE;
    this.currentChunkSize = chunkSize;

    // Strategy 1: User provided a Directory Handle (Folder or multi-file on Desktop)
    if (this.directoryHandle) {
      try {
        const pathSegments = (fileMeta.relativePath || fileMeta.fileName).split('/').filter(Boolean);
        const fileName = pathSegments.pop();

        let dir = this.directoryHandle;
        for (const segment of pathSegments) {
          dir = await dir.getDirectoryHandle(segment, { create: true });
        }

        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        this.currentFileHandle = fileHandle;
        this.currentStream = await fileHandle.createWritable();
        console.log(`[BatchFileWriter] Direct stream opened for: ${fileMeta.relativePath}`);
        return;
      } catch (err) {
        console.warn(`[BatchFileWriter] Failed to open stream for ${fileMeta.relativePath}, falling back:`, err.message);
        this.currentStream = null;
        this.currentFileHandle = null;
      }
    }

    // Strategy 2: User provided a Single File Handle
    if (this.singleFileHandle && !this.directoryHandle) {
      try {
        this.currentFileHandle = this.singleFileHandle;
        this.currentStream = await this.singleFileHandle.createWritable();
        console.log(`[BatchFileWriter] Single file stream opened for: ${fileMeta.fileName}`);
        return;
      } catch (err) {
        console.warn('[BatchFileWriter] Failed to open single file stream, falling back:', err.message);
        this.currentStream = null;
        this.currentFileHandle = null;
      }
    }

    // Strategy 3: Fallback (Mobile / non-supported browser)
    console.log(`[BatchFileWriter] Using memory buffer for: ${fileMeta.fileName}`);
  }

  async writeChunk(chunkIndex, payloadBuffer) {
    if (this.isClosed) return;

    if (this.currentStream) {
      const position = chunkIndex * this.currentChunkSize;
      await this.currentStream.write({
        type: 'write',
        position,
        data: payloadBuffer,
      });
    } else {
      this.currentChunksMap.set(chunkIndex, payloadBuffer);
    }
  }

  async finishCurrentFile() {
    if (!this.currentFile) return null;

    const fileMeta = this.currentFile;
    let savedDirectly = false;
    let localHash = '';

    if (this.currentStream) {
      try {
        await this.currentStream.close();
        savedDirectly = true;

        if (this.currentFileHandle) {
          try {
            const diskFile = await this.currentFileHandle.getFile();
            localHash = await computeFileMD5(diskFile);
          } catch (e) {
            console.warn('[BatchFileWriter] Readback hash check error:', e);
          }
        }
      } catch (err) {
        console.error(`[BatchFileWriter] Error closing stream for ${fileMeta.fileName}:`, err);
      }
      this.currentStream = null;
    } else {
      // Assemble and trigger auto-download in fallback mode
      const totalChunks = fileMeta.totalChunks || this.currentChunksMap.size;
      const sortedChunks = [];
      const hasher = createIncrementalHasher();

      for (let i = 0; i < totalChunks; i++) {
        const chunk = this.currentChunksMap.get(i);
        if (chunk) {
          sortedChunks.push(chunk);
          hasher.append(chunk);
        }
      }

      localHash = hasher.finalize();

      const blob = new Blob(sortedChunks, { type: fileMeta.fileType || 'application/octet-stream' });
      this.currentChunksMap.clear();

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      // Sanitize relative path for fallback download filename
      a.download = (fileMeta.relativePath || fileMeta.fileName).replace(/\//g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      savedDirectly = false;
    }

    const result = {
      fileIndex: fileMeta.fileIndex,
      fileName: fileMeta.fileName,
      relativePath: fileMeta.relativePath,
      savedDirectly,
      localHash,
    };

    this.completedFiles.push(result);
    this.currentFile = null;
    this.currentFileHandle = null;
    return result;
  }

  async finishBatch() {
    this.isClosed = true;
    return {
      completedFiles: this.completedFiles,
      totalSaved: this.completedFiles.length,
      savedToDirectory: Boolean(this.directoryHandle),
    };
  }

  async abort() {
    this.isClosed = true;
    if (this.currentStream) {
      try {
        await this.currentStream.abort();
      } catch {
        // Ignore
      }
      this.currentStream = null;
    }
    this.currentFileHandle = null;
    this.currentChunksMap.clear();
  }
}

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
 * Sanitizes restricted Windows/Office filenames so Chromium File System Access API
 * does not reject getFileHandle with 'Name is not allowed'.
 */
export function sanitizeFileNameForDisk(fileName) {
  if (!fileName) return 'unnamed_file';
  let clean = fileName.trim();
  const lower = clean.toLowerCase();
  if (lower === 'desktop.ini' || lower === 'thumbs.db' || lower === '.ds_store') {
    clean = `_safe_${clean}.txt`;
  } else if (lower.endsWith('.lnk')) {
    clean = clean.replace(/\.lnk$/i, '.shortcut_file');
  } else if (clean.startsWith('~$')) {
    clean = clean.replace(/^~\$/, '_temp_');
  }
  return clean;
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
    this.currentHasher = null;
    this.writePromiseChain = Promise.resolve();
    this.currentChunksMap = new Map();
    this.isClosed = false;
    this.completedFiles = [];
  }

  async startFile(fileMeta) {
    this.currentFile = fileMeta;
    this.currentFileHandle = null;
    this.currentChunksMap.clear();
    this.currentHasher = createIncrementalHasher();
    this.writePromiseChain = Promise.resolve();

    const chunkSize = fileMeta.chunkSize || DEFAULT_CHUNK_SIZE;
    this.currentChunkSize = chunkSize;

    // Handle empty directory creation
    if (fileMeta.isDirectory) {
      if (this.directoryHandle) {
        try {
          const pathSegments = (fileMeta.relativePath || fileMeta.fileName).split('/').filter(Boolean);
          let dir = this.directoryHandle;
          for (const segment of pathSegments) {
            dir = await dir.getDirectoryHandle(segment, { create: true });
          }
          console.log(`[BatchFileWriter] Directory created: ${fileMeta.relativePath}`);
        } catch (err) {
          console.warn(`[BatchFileWriter] Failed to create directory ${fileMeta.relativePath}:`, err.message);
        }
      }
      return;
    }

    // Strategy 1: User provided a Directory Handle (Folder or multi-file on Desktop)
    if (this.directoryHandle) {
      try {
        const pathSegments = (fileMeta.relativePath || fileMeta.fileName).split('/').filter(Boolean);
        const rawFileName = pathSegments.pop() || fileMeta.fileName || 'file';
        const fileName = sanitizeFileNameForDisk(rawFileName);

        let dir = this.directoryHandle;
        for (const segment of pathSegments) {
          dir = await dir.getDirectoryHandle(segment, { create: true });
        }

        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        this.currentFileHandle = fileHandle;
        this.currentStream = await fileHandle.createWritable();
        console.log(`[BatchFileWriter] Direct stream opened for: ${fileMeta.relativePath || fileName}`);
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

    if (this.currentHasher) {
      this.currentHasher.append(payloadBuffer);
    }

    if (this.currentStream) {
      // Enqueue sequential write promise to avoid concurrent stream write collisions
      this.writePromiseChain = this.writePromiseChain.then(async () => {
        if (this.isClosed || !this.currentStream) return;
        try {
          const position = chunkIndex * this.currentChunkSize;
          await this.currentStream.write({
            type: 'write',
            position,
            data: payloadBuffer,
          });
        } catch (err) {
          console.warn(`[BatchFileWriter] Write chunk ${chunkIndex} error:`, err.message);
        }
      });
      return this.writePromiseChain;
    } else {
      this.currentChunksMap.set(chunkIndex, payloadBuffer);
    }
  }

  async finishCurrentFile() {
    if (!this.currentFile) return null;

    const fileMeta = this.currentFile;

    // Handle directory entry
    if (fileMeta.isDirectory) {
      const result = {
        fileIndex: fileMeta.fileIndex,
        fileName: fileMeta.fileName,
        relativePath: fileMeta.relativePath,
        savedDirectly: Boolean(this.directoryHandle),
        isDirectory: true,
        localHash: '',
      };
      this.completedFiles.push(result);
      this.currentFile = null;
      return result;
    }

    let savedDirectly = false;
    let localHash = '';

    if (this.currentStream) {
      try {
        // 1. Wait for all queued writes to finish flushing to disk
        await this.writePromiseChain;
        // 2. Safely close stream
        await this.currentStream.close();
        savedDirectly = true;
      } catch (err) {
        console.error(`[BatchFileWriter] Error closing stream for ${fileMeta.fileName}:`, err);
      }
      this.currentStream = null;
      // Get hash calculated on the fly during chunk writes (0ms disk I/O!)
      localHash = this.currentHasher ? this.currentHasher.finalize() : '';
    } else {
      // Assemble and trigger auto-download in fallback mode
      const totalChunks = fileMeta.totalChunks || this.currentChunksMap.size;
      const sortedChunks = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunk = this.currentChunksMap.get(i);
        if (chunk) {
          sortedChunks.push(chunk);
        }
      }

      localHash = this.currentHasher ? this.currentHasher.finalize() : '';

      const blob = new Blob(sortedChunks, { type: fileMeta.fileType || 'application/octet-stream' });
      this.currentChunksMap.clear();

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const sanitizedName = sanitizeFileNameForDisk(fileMeta.fileName || 'download');
      a.download = (fileMeta.relativePath || sanitizedName).replace(/\//g, '_');
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
    this.currentHasher = null;
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

/**
 * Recursively reads all entries from a FileSystemDirectoryReader in batches of 100
 */
async function readAllEntriesFromReader(dirReader) {
  const entries = [];
  let readBatch = await new Promise((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });

  while (readBatch.length > 0) {
    entries.push(...readBatch);
    readBatch = await new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
  }

  return entries;
}

/**
 * Recursively scans a FileSystemEntry (file or directory)
 */
async function scanEntry(entry, pathPrefix = '') {
  if (!entry) return [];

  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => {
      entry.file(resolve, reject);
    });
    const relativePath = pathPrefix ? `${pathPrefix}${file.name}` : file.name;
    return [{ file, relativePath, size: file.size, type: file.type }];
  }

  if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const childEntries = await readAllEntriesFromReader(dirReader);
    const newPrefix = pathPrefix ? `${pathPrefix}${entry.name}/` : `${entry.name}/`;

    const nestedResults = await Promise.all(
      childEntries.map((child) => scanEntry(child, newPrefix))
    );
    return nestedResults.flat();
  }

  return [];
}

/**
 * Scans dropped items from DragEvent.dataTransfer
 * Supports arbitrary mix of individual files and nested folders
 */
export async function scanDroppedItems(dataTransfer) {
  const results = [];
  const items = dataTransfer.items;

  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
    const scanned = await Promise.all(entries.map((entry) => scanEntry(entry)));
    results.push(...scanned.flat());
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      const relativePath = file.webkitRelativePath || file.name;
      results.push({
        file,
        relativePath,
        size: file.size,
        type: file.type,
      });
    }
  }

  return results;
}

/**
 * Scans files from HTML file input (single, multiple, or webkitdirectory)
 */
export function scanFileInput(fileList) {
  const results = [];
  if (!fileList) return results;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const relativePath = file.webkitRelativePath || file.name;
    results.push({
      file,
      relativePath,
      size: file.size,
      type: file.type,
    });
  }

  return results;
}

/**
 * Summarizes a batch of staged files (e.g. "3 photos, 2 videos, 1 document")
 */
export function summarizeBatchCategories(stagedFiles) {
  if (!stagedFiles || stagedFiles.length === 0) return '0 files';

  let photos = 0;
  let videos = 0;
  let audio = 0;
  let docs = 0;
  let others = 0;

  for (const item of stagedFiles) {
    const type = item.type || '';
    const name = (item.relativePath || item.file?.name || '').toLowerCase();

    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) {
      photos += 1;
    } else if (type.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm|m4v)$/i.test(name)) {
      videos += 1;
    } else if (type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(name)) {
      audio += 1;
    } else if (
      type.startsWith('text/') ||
      type.includes('pdf') ||
      /\.(pdf|txt|md|doc|docx|xls|xlsx|csv|json)$/i.test(name)
    ) {
      docs += 1;
    } else {
      others += 1;
    }
  }

  const parts = [];
  if (photos > 0) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  if (videos > 0) parts.push(`${videos} video${videos > 1 ? 's' : ''}`);
  if (audio > 0) parts.push(`${audio} audio`);
  if (docs > 0) parts.push(`${docs} doc${docs > 1 ? 's' : ''}`);
  if (others > 0) parts.push(`${others} other${others > 1 ? 's' : ''}`);

  return parts.join(', ');
}

import React, { useState, useRef } from 'react';
import { Upload, FolderUp, FilePlus, FileText, Folder, X, ArrowUpRight } from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';
import { scanDroppedItems, scanFileInput, summarizeBatchCategories } from '../utils/fileScanner.js';

export default function DropZone({
  onSendBatch,
  selectedPeerIds = [],
  selectedPeerNames = [],
  disabled,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    try {
      setIsScanning(true);
      const scanned = await scanDroppedItems(e.dataTransfer);
      if (scanned.length > 0) {
        setStagedFiles((prev) => [...prev, ...scanned]);
      }
    } catch (err) {
      console.error('[DropZone] Error scanning dropped items:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = scanFileInput(e.target.files);
      setStagedFiles((prev) => [...prev, ...scanned]);
      e.target.value = '';
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    setStagedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAll = () => {
    setStagedFiles([]);
  };

  const handleSend = () => {
    if (stagedFiles.length > 0 && selectedPeerIds.length > 0 && !disabled) {
      onSendBatch(selectedPeerIds, stagedFiles);
    }
  };

  const totalBytes = stagedFiles.reduce((acc, curr) => acc + curr.size, 0);
  const categorySummary = summarizeBatchCategories(stagedFiles);

  const recipientLabel =
    selectedPeerIds.length === 0
      ? 'No Peers Selected'
      : selectedPeerIds.length === 1
      ? selectedPeerNames[0] || '1 Selected Peer'
      : `${selectedPeerIds.length} Selected Peers`;

  return (
    <div className="panel dropzone-panel">
      <div className="panel-header">
        <h2 className="panel-title">File & Folder Dispatch</h2>
        {stagedFiles.length > 0 && (
          <button
            type="button"
            className="btn-link"
            onClick={handleClearAll}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Hidden inputs for multi-file and folder picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden-file-input"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden-file-input"
        onChange={handleFileInputChange}
      />

      {stagedFiles.length === 0 ? (
        <div
          className={`dropzone-box ${dragActive ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <Upload size={24} className="dropzone-icon" />
          <p className="dropzone-label">
            {isScanning ? 'Scanning files and directories...' : 'Drag & drop files or folders here'}
          </p>
          <span className="dropzone-sub">
            Supports multiple photos, videos, and full folder hierarchies without zip compression
          </span>

          <div className="picker-button-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <FilePlus size={14} />
              <span>Choose Files</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={disabled}
            >
              <FolderUp size={14} />
              <span>Choose Folder</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="staged-batch-container">
          <div className="staged-summary-bar">
            <div className="summary-left">
              <span className="summary-title">
                {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'} ({formatBytes(totalBytes)})
              </span>
              <span className="summary-categories">{categorySummary}</span>
            </div>

            <div className="summary-actions">
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title="Add more files"
              >
                <FilePlus size={12} />
                <span>Add Files</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => folderInputRef.current?.click()}
                disabled={disabled}
                title="Add a folder"
              >
                <FolderUp size={12} />
                <span>Add Folder</span>
              </button>
            </div>
          </div>

          <div className="staged-items-list">
            {stagedFiles.slice(0, 50).map((item, idx) => {
              const isNested = (item.relativePath || '').includes('/');
              return (
                <div key={idx} className="staged-item-row">
                  <div className="item-icon-box">
                    {isNested ? <Folder size={14} className="folder-icon" /> : <FileText size={14} />}
                  </div>
                  <div className="item-name-box" title={item.relativePath}>
                    <span className="item-rel-path">{item.relativePath}</span>
                  </div>
                  <span className="item-size mono">{formatBytes(item.size)}</span>
                  <button
                    type="button"
                    className="btn-icon btn-xs"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={disabled}
                    title="Remove item"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            {stagedFiles.length > 50 && (
              <div className="staged-overflow-hint">
                + {stagedFiles.length - 50} more items
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dispatch-actions">
        <button
          type="button"
          className="btn btn-primary dispatch-button"
          onClick={handleSend}
          disabled={stagedFiles.length === 0 || selectedPeerIds.length === 0 || disabled}
        >
          <span>
            Send {stagedFiles.length > 0 ? `${stagedFiles.length} Items` : 'Files'} to {recipientLabel}
          </span>
          <ArrowUpRight size={15} />
        </button>

        {selectedPeerIds.length === 0 && (
          <span className="dispatch-hint">Select one or more destination peers from the list on the left</span>
        )}
      </div>
    </div>
  );
}

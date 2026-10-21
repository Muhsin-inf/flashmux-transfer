import React from 'react';
import { Download, Folder, FileText } from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';
import {
  promptSaveDirectoryHandle,
  promptSaveFileHandle,
  isDirectoryPickerSupported,
  isFileSystemAccessSupported,
} from '../services/fileWriter.js';

export default function TransferModal({ incomingOffer, onAccept, onReject, peers = [] }) {
  if (!incomingOffer) return null;

  const { from, metadata } = incomingOffer;
  const senderPeer = peers.find((p) => p.peerId === from);
  const senderName = senderPeer ? senderPeer.clientName : from.slice(0, 8);

  const totalFiles = metadata.totalFiles || metadata.files?.length || 1;
  const totalBytes = metadata.totalBytes || metadata.fileSize || 0;
  const isFolder = metadata.isFolder || false;

  const handleAcceptClick = async () => {
    let directoryHandle = null;
    let singleFileHandle = null;

    if (totalFiles > 1 || isFolder) {
      if (isDirectoryPickerSupported()) {
        try {
          directoryHandle = await promptSaveDirectoryHandle();
          // If user explicitly dismissed the folder picker dialog
          if (!directoryHandle) {
            console.log('[TransferModal] User dismissed directory picker');
            return;
          }
        } catch (err) {
          console.warn('[TransferModal] Directory picker fallback:', err);
        }
      }
    } else {
      if (isFileSystemAccessSupported()) {
        try {
          const suggestedName = metadata.files?.[0]?.fileName || metadata.fileName || 'downloaded_file';
          singleFileHandle = await promptSaveFileHandle(suggestedName);
          if (!singleFileHandle) {
            console.log('[TransferModal] User dismissed single file picker');
            return;
          }
        } catch (err) {
          console.warn('[TransferModal] Single file picker fallback:', err);
        }
      }
    }

    onAccept({ directoryHandle, singleFileHandle });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h3 className="modal-title">Incoming File Transfer</h3>
        </div>

        <div className="modal-body">
          <p className="modal-prompt">
            <strong>{senderName}</strong> wants to send you {totalFiles} {totalFiles === 1 ? 'file' : 'items'}:
          </p>

          <div className="modal-file-card">
            {isFolder ? (
              <Folder size={20} className="modal-file-icon" />
            ) : (
              <FileText size={20} className="modal-file-icon" />
            )}
            <div className="modal-file-details">
              <span className="modal-file-name">
                {totalFiles === 1
                  ? metadata.files?.[0]?.fileName || metadata.fileName
                  : `${totalFiles} Files ${isFolder ? '(Folder Structure)' : ''}`}
              </span>
              <span className="modal-file-meta">
                {formatBytes(totalBytes)} · {isFolder ? 'Preserves subdirectories' : 'Batch transfer'}
              </span>
            </div>
          </div>

          <div className="modal-file-preview-list">
            {(metadata.files || []).slice(0, 4).map((f, idx) => (
              <div key={idx} className="modal-preview-item">
                <span className="preview-path" title={f.relativePath || f.fileName}>
                  {f.relativePath || f.fileName}
                </span>
                <span className="preview-size mono">{formatBytes(f.fileSize)}</span>
              </div>
            ))}
            {(metadata.files || []).length > 4 && (
              <div className="modal-preview-more">
                + {(metadata.files.length - 4)} more files
              </div>
            )}
          </div>

          <p className="modal-notice">
            Transferred directly device-to-device through 4 parallel WebRTC channels without cloud storage or zip compression.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReject}
          >
            Decline
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAcceptClick}
          >
            <Download size={14} />
            <span>
              {isDirectoryPickerSupported() && (totalFiles > 1 || isFolder)
                ? 'Select Folder & Accept'
                : 'Accept Transfer'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

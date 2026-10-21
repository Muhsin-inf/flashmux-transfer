import React from 'react';
import { X, AlertCircle, Check, CheckCircle2 } from 'lucide-react';
import { formatBytes, formatSpeed, formatDuration, formatElapsedTime } from '../utils/formatters.js';

export default function TransferProgress({
  transferState,
  targetPeerNames = [],
  onCancel,
  onReset,
}) {
  const {
    status,
    role,
    batchMetadata,
    currentFile,
    progress,
    channels,
    completedFiles = [],
    result,
    error,
  } = transferState;

  if (status === 'idle') {
    return null;
  }

  const isCompleted = status === 'completed';
  const isFailed = status === 'error' || status === 'cancelled';
  const isTransferring = status === 'transferring';
  const isConnecting = status === 'connecting' || status === 'offering';

  const totalFiles = batchMetadata?.totalFiles || progress.totalFiles || 1;
  const currentFileIdx = Math.min(progress.currentFileIndex + 1, totalFiles);
  const activeFileName =
    currentFile?.relativePath ||
    currentFile?.fileName ||
    progress.currentRelativePath ||
    progress.currentFileName ||
    'Preparing items...';

  const peerNamesLabel =
    targetPeerNames.length > 0
      ? targetPeerNames.join(', ')
      : `${transferState.targetPeerIds?.length || 1} peer(s)`;

  const totalDuration = result?.totalDurationSeconds || progress.elapsedSeconds || 0;
  const averageSpeed = result?.averageSpeed || (totalDuration > 0 ? progress.totalBytesTransferred / totalDuration : progress.speed);

  return (
    <div className={`panel progress-panel ${isCompleted ? 'panel-success' : ''} ${isFailed ? 'panel-error' : ''}`}>
      <div className="panel-header">
        <div className="progress-title-wrap">
          <span className="role-tag">{role === 'sender' ? 'Sending' : 'Receiving'}</span>
          <div className="progress-header-text">
            <h2 className="file-heading">
              {role === 'sender' ? `Sending to ${peerNamesLabel}` : `Receiving from ${peerNamesLabel}`}
            </h2>
            <span className="progress-sub-heading">
              Item {currentFileIdx} of {totalFiles}: {activeFileName}
            </span>
          </div>
        </div>

        <div className="status-badge-wrap">
          {isConnecting && <span className="badge badge-warning">Negotiating WebRTC</span>}
          {isTransferring && <span className="badge badge-active">Streaming 4x (IDM Segments)</span>}
          {isCompleted && <span className="badge badge-success">Batch Complete</span>}
          {isFailed && <span className="badge badge-danger">Failed / Cancelled</span>}
        </div>
      </div>

      {/* Completion Summary Card */}
      {isCompleted && (
        <div className="completion-summary-card">
          <div className="summary-card-header">
            <CheckCircle2 size={18} className="text-success" />
            <span className="summary-card-title">Transfer Successfully Completed</span>
          </div>

          <div className="summary-stats-grid">
            <div className="summary-stat-cell">
              <span className="stat-label">Total Time</span>
              <span className="stat-val highlight">{formatElapsedTime(totalDuration)}</span>
            </div>

            <div className="summary-stat-cell">
              <span className="stat-label">Average Speed</span>
              <span className="stat-val mono">{formatSpeed(averageSpeed)}</span>
            </div>

            <div className="summary-stat-cell">
              <span className="stat-label">Transferred</span>
              <span className="stat-val mono">
                {formatBytes(result?.totalBytes || progress.totalBytesTransferred)}
              </span>
            </div>

            <div className="summary-stat-cell">
              <span className="stat-label">Total Items</span>
              <span className="stat-val">{totalFiles} file(s)</span>
            </div>
          </div>
        </div>
      )}

      {/* Main batch progress bar & telemetry */}
      <div className="progress-section">
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill ${isCompleted ? 'fill-success' : ''}`}
            style={{ width: `${Math.min(100, progress.progressPercent || 0)}%` }}
          />
        </div>

        <div className="telemetry-grid telemetry-5-cols">
          <div className="telemetry-cell">
            <span className="telemetry-label">Transferred</span>
            <span className="telemetry-val mono">
              {formatBytes(progress.totalBytesTransferred)} / {formatBytes(progress.batchTotalBytes)}
            </span>
          </div>

          <div className="telemetry-cell">
            <span className="telemetry-label">Throughput</span>
            <span className="telemetry-val mono">
              {isTransferring ? formatSpeed(progress.speed) : isCompleted ? formatSpeed(averageSpeed) : '--'}
            </span>
          </div>

          <div className="telemetry-cell">
            <span className="telemetry-label">Elapsed Time</span>
            <span className="telemetry-val mono highlight-time">
              {formatDuration(progress.elapsedSeconds)}
            </span>
          </div>

          <div className="telemetry-cell">
            <span className="telemetry-label">ETA Remaining</span>
            <span className="telemetry-val mono">
              {isTransferring ? formatDuration(progress.etaSeconds) : isCompleted ? '00:00' : '--'}
            </span>
          </div>

          <div className="telemetry-cell">
            <span className="telemetry-label">Progress</span>
            <span className="telemetry-val mono">
              {progress.progressPercent?.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 4-Channel Independent Segments (IDM-Style) */}
      <div className="channels-section">
        <div className="channels-header">
          <span className="section-label">IDM-Style Parallel Segment Distribution</span>
          <span className="section-meta">
            {progress.currentChunks} / {progress.totalChunks} Chunks (Current File)
          </span>
        </div>

        <div className="channel-grid">
          {channels.map((chan) => (
            <div key={chan.id} className={`channel-card ${chan.active ? 'active' : ''}`}>
              <div className="channel-card-head">
                <span className="channel-name">Channel {chan.id}</span>
                <span className={`channel-indicator ${chan.active ? 'live' : 'idle'}`} />
              </div>

              <span className="channel-range-label">{chan.rangeLabel || `Part ${chan.id + 1}`}</span>

              <div className="channel-progress-track">
                <div
                  className="channel-progress-fill"
                  style={{ width: `${Math.min(100, chan.progressPercent || 0)}%` }}
                />
              </div>

              <div className="channel-stats">
                <span className="chan-chunks mono">{chan.chunks.toLocaleString()} chunks</span>
                <span className="chan-bytes mono">{formatBytes(chan.bytes)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Completed Files & Checksum Log */}
      {completedFiles.length > 0 && (
        <div className="completed-batch-list">
          <span className="completed-list-title">
            Completed Files ({completedFiles.length} of {totalFiles})
          </span>
          <div className="completed-rows-scroll">
            {completedFiles.map((file, idx) => (
              <div key={idx} className="completed-file-row">
                <div className="row-left">
                  <Check size={13} className="text-success check-icon" />
                  <span className="completed-file-name" title={file.relativePath || file.fileName}>
                    {file.relativePath || file.fileName}
                  </span>
                </div>
                <div className="row-right">
                  <span className="completed-file-size mono">{formatBytes(file.fileSize)}</span>
                  {file.verified !== undefined && (
                    <span className={`checksum-badge ${file.verified ? 'verified' : 'unverified'}`}>
                      {file.verified ? 'MD5 Verified' : 'MD5 Checksum'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {isFailed && error && (
        <div className="error-box">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Control Actions */}
      <div className="progress-actions">
        {(isTransferring || isConnecting) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onCancel('Transfer cancelled by user')}
          >
            <X size={14} />
            <span>Cancel Transfer</span>
          </button>
        )}

        {(isCompleted || isFailed) && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onReset}
          >
            <span>Close / New Transfer</span>
          </button>
        )}
      </div>
    </div>
  );
}

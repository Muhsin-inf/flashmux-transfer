import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';

export default function QrStreamReceiver({
  cameraActive,
  cameraError,
  receiverProgress,
  receiverStats,
  solvedBlockSet,
  receivedFile,
  receivedMetadata,
  isReceiveComplete,
  startScanning,
  stopScanning,
  switchCamera,
  resetReceiver,
  downloadReceivedFile,
}) {
  const videoRef = useRef(null);

  // Mount/unmount camera lifecycle only
  useEffect(() => {
    if (!isReceiveComplete && videoRef.current) {
      startScanning(videoRef.current);
    }
    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { solved = 0, K = 0, scannedCount = 0 } = receiverStats;

  return (
    <div className="panel qr-receiver-panel">
      <div className="panel-header">
        <div className="panel-header-title">
          <h2 className="panel-title">Terima via Kamera (Optical QR)</h2>
          <span className="panel-counter">Arahkan kamera ke layar pengirim</span>
        </div>

        <div className="receiver-header-actions">
          {cameraActive ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={switchCamera}
                title="Ganti Kamera Depan/Belakang"
              >
                <RefreshCw size={13} />
                <span>Ganti Kamera</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={stopScanning}
                title="Matikan Kamera"
              >
                <span>Matikan Kamera</span>
              </button>
            </>
          ) : (
            !isReceiveComplete && (
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => videoRef.current && startScanning(videoRef.current)}
                title="Nyalakan Kamera"
              >
                <span>Nyalakan Kamera</span>
              </button>
            )
          )}

          {isReceiveComplete && (
            <button
              type="button"
              className="btn-link"
              onClick={resetReceiver}
            >
              Pindai Ulang
            </button>
          )}
        </div>
      </div>

      {!isReceiveComplete ? (
        <div className="qr-scanner-view-container">
          {/* Camera Viewfinder */}
          <div className="camera-viewfinder-box">
            <video
              ref={videoRef}
              className="camera-video-feed"
              playsInline
              muted
              autoPlay
            />

            {/* Viewfinder Target Overlays */}
            <div className="viewfinder-frame">
              <div className="corner-tl" />
              <div className="corner-tr" />
              <div className="corner-bl" />
              <div className="corner-br" />
              <div className="scanner-laser-line" />
            </div>

            {!cameraActive && !cameraError && (
              <div className="camera-inactive-overlay">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => videoRef.current && startScanning(videoRef.current)}
                >
                  Nyalakan Kamera & Mulai Scan
                </button>
              </div>
            )}

            {cameraError && (
              <div className="camera-error-overlay">
                <AlertCircle size={24} className="text-danger" />
                <p className="camera-error-text">{cameraError}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-8"
                  onClick={() => videoRef.current && startScanning(videoRef.current)}
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>

          {/* Decoding Progress Card */}
          <div className="receiver-telemetry-card">
            <div className="receiver-stats-row">
              <div className="receiver-stat-col">
                <span className="rec-stat-label">Progres Blok</span>
                <span className="rec-stat-val">
                  {K > 0 ? `${solved} / ${K} blok` : 'Mencari QR...'}
                </span>
              </div>
              <div className="receiver-stat-col">
                <span className="rec-stat-label">Frame Terpindai</span>
                <span className="rec-stat-val">{scannedCount} frame</span>
              </div>
              <div className="receiver-stat-col">
                <span className="rec-stat-label">Kelengkapan</span>
                <span className="rec-stat-val highlight">{receiverProgress}%</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${receiverProgress}%` }}
              />
            </div>

            {/* Block Matrix Grid */}
            {K > 0 && K <= 160 && (
              <div className="block-matrix-container">
                <span className="matrix-label">Peta Blok Data (Fountain Peeling):</span>
                <div className="block-matrix-grid">
                  {Array.from({ length: K }).map((_, idx) => {
                    const isSolved = solvedBlockSet.has(idx);
                    return (
                      <div
                        key={idx}
                        className={`block-cell ${isSolved ? 'solved' : 'pending'}`}
                        title={`Blok ${idx + 1}: ${isSolved ? 'Terkumpul' : 'Menunggu frame'}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Completion Card */
        <div className="completion-summary-card">
          <div className="summary-card-header">
            <CheckCircle2 size={20} className="text-success" />
            <span className="summary-card-title">File Berhasil Direkonstruksi!</span>
          </div>

          <div className="qr-received-file-info">
            <span className="qr-completed-name">{receivedMetadata?.name || 'file_downloaded'}</span>
            <span className="qr-completed-meta">
              Ukuran: {formatBytes(receivedMetadata?.size || receivedFile?.size || 0)} • Integritas CRC32 Terverifikasi
            </span>
          </div>

          <div className="modal-footer mt-12">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetReceiver}
            >
              Pindai File Lain
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={downloadReceivedFile}
            >
              <Download size={14} />
              <span>Simpan / Unduh File</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

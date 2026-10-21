import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Play, Pause, Maximize2, Minimize2, FileText, Upload, Zap } from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';

const BLOCK_SIZE_PRESETS = [
  { label: 'Standar (600 B)', value: 600, desc: 'Modul renggang, ideal untuk kamera resolusi standar' },
  { label: 'Cepat (1.200 B)', value: 1200, desc: 'Rekomendasi seimbang, memotong total blok 50%' },
  { label: 'Super Cepat (1.600 B)', value: 1600, desc: 'Kapasitas padat, memotong total blok ~70%' },
  { label: 'Ultra (2.000 B)', value: 2000, desc: 'Kapasitas maksimal, jumlah blok minimal' },
];

export default function QrStreamSender({
  senderMetadata,
  senderFps,
  setSenderFps,
  senderBlockSize = 1200,
  setSenderBlockSize,
  isSending,
  isPlaying,
  currentDroplet,
  totalK,
  stageSenderFile,
  stageSenderText,
  toggleSenderPlay,
  resetSender,
}) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [activeTab, setActiveTab] = useState('file'); // 'file' or 'text'

  // Render QR to canvas whenever currentDroplet updates
  useEffect(() => {
    if (!currentDroplet?.packet || !canvasRef.current) return;

    const qrSize = isFullscreen
      ? Math.min(window.innerWidth - 80, window.innerHeight - 180, 720)
      : 480;

    QRCode.toCanvas(
      canvasRef.current,
      currentDroplet.packet,
      {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: 'L',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (error) => {
        if (error) {
          console.warn('[QrStreamSender] QRCode canvas error:', error);
        }
      }
    );
  }, [currentDroplet, isFullscreen]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      stageSenderFile(e.target.files[0], senderBlockSize);
      e.target.value = '';
    }
  };

  const handleSendText = () => {
    if (!textInput.trim()) return;
    stageSenderText(textInput.trim(), 'note.txt', senderBlockSize);
  };

  const throughputKbps = ((senderFps * senderBlockSize) / 1024).toFixed(1);

  return (
    <div className={`panel qr-sender-panel ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      <div className="panel-header">
        <div className="panel-header-title">
          <h2 className="panel-title">Kirim via Layar (Optical QR)</h2>
          <span className="panel-counter">Air-Gapped • Tanpa Jaringan</span>
        </div>

        {isSending && (
          <button
            type="button"
            className="btn-link"
            onClick={resetSender}
          >
            Ganti File
          </button>
        )}
      </div>

      {!isSending ? (
        <div className="qr-staging-container">
          {/* Density Preset Selector */}
          <div className="density-selector-box">
            <div className="density-header">
              <span className="density-title">Kapasitas Blok / Kecepatan:</span>
              <span className="density-desc">
                {BLOCK_SIZE_PRESETS.find((p) => p.value === senderBlockSize)?.desc}
              </span>
            </div>
            <div className="density-btn-group">
              {BLOCK_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`density-btn ${senderBlockSize === preset.value ? 'active' : ''}`}
                  onClick={() => setSenderBlockSize && setSenderBlockSize(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="qr-mode-tabs">
            <button
              type="button"
              className={`qr-tab ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              File / Dokumen
            </button>
            <button
              type="button"
              className={`qr-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              Teks / Pesan Langsung
            </button>
          </div>

          {activeTab === 'file' ? (
            <div
              className="dropzone-box"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden-file-input"
                onChange={handleFileChange}
              />
              <Upload size={28} className="dropzone-icon" />
              <p className="dropzone-label">Pilih file untuk disiarkan via QR</p>
              <span className="dropzone-sub">
                Optimal untuk file &lt; 2 MB (foto, dokumen PDF, teks, script, dsb.)
              </span>
              <button type="button" className="btn btn-secondary btn-sm mt-8">
                Pilih File
              </button>
            </div>
          ) : (
            <div className="qr-text-stage-box">
              <textarea
                className="qr-text-input"
                rows={4}
                placeholder="Ketik atau tempel teks, password, atau pesan rahasia di sini..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm align-self-end"
                onClick={handleSendText}
                disabled={!textInput.trim()}
              >
                Siarkan Teks via QR
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="qr-display-container">
          {/* QR Canvas Frame */}
          <div className="qr-canvas-wrapper">
            <canvas ref={canvasRef} className="qr-canvas" />
            <div className="qr-watermark-overlay">
              <span className="qr-seq-badge">
                Frame {currentDroplet ? currentDroplet.seq + 1 : 0}
              </span>
            </div>
          </div>

          {/* Telemetry & Controls */}
          <div className="qr-sender-info">
            <div className="qr-file-badge">
              <FileText size={15} />
              <span className="qr-file-name">{senderMetadata?.fileName}</span>
              <span className="qr-file-size">({formatBytes(senderMetadata?.fileSize || 0)})</span>
            </div>

            <div className="qr-telemetry-row">
              <div className="telemetry-pill">
                <span className="pill-label">Total Blok</span>
                <span className="pill-val highlight-val">{totalK} blok</span>
              </div>
              <div className="telemetry-pill">
                <span className="pill-label">Ukuran Blok</span>
                <span className="pill-val">{senderBlockSize} B/blok</span>
              </div>
              <div className="telemetry-pill">
                <span className="pill-label">Throughput Est.</span>
                <span className="pill-val throughput-pill">
                  <Zap size={11} className="inline-icon" />
                  {throughputKbps} KB/s
                </span>
              </div>
            </div>

            {/* Slider FPS */}
            <div className="qr-fps-control">
              <label htmlFor="fpsSlider" className="fps-label">
                <span>Kecepatan Animasi Frame:</span>
                <strong>{senderFps} FPS</strong>
              </label>
              <input
                id="fpsSlider"
                type="range"
                min="6"
                max="30"
                step="2"
                value={senderFps}
                onChange={(e) => setSenderFps(parseInt(e.target.value, 10))}
                className="fps-slider"
              />
            </div>

            {/* Action Bar */}
            <div className="qr-actions-row">
              <button
                type="button"
                className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                onClick={toggleSenderPlay}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Jeda (Pause)' : 'Lanjutkan'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsFullscreen((prev) => !prev)}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span>{isFullscreen ? 'Kecilkan' : 'Layar Penuh (Besar)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

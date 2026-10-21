import React from 'react';
import { Laptop, Smartphone, Wifi, QrCode } from 'lucide-react';

export default function Header({
  connectionStatus,
  peerId,
  clientName,
  deviceType,
  appMode = 'webrtc',
  onModeChange,
}) {
  const isOnline = connectionStatus === 'connected';

  return (
    <header className="app-header">
      <div className="brand-group">
        <img src="/logo.png" alt="FlashMux Logo" className="brand-logo-img" />
        <div>
          <h1 className="brand-title">FlashMux</h1>
          <p className="brand-subtitle">Local & Optical P2P Transfer</p>
        </div>
      </div>

      <div className="mode-selector-tabs">
        <button
          type="button"
          className={`mode-tab-btn ${appMode === 'webrtc' ? 'active' : ''}`}
          onClick={() => onModeChange && onModeChange('webrtc')}
        >
          <Wifi size={14} />
          <span>Wi-Fi P2P</span>
        </button>
        <button
          type="button"
          className={`mode-tab-btn ${appMode === 'optical' ? 'active' : ''}`}
          onClick={() => onModeChange && onModeChange('optical')}
        >
          <QrCode size={14} />
          <span>Kamera QR</span>
        </button>
      </div>

      <div className="header-meta">
        <div className="connection-indicator">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="status-label">
            {isOnline ? 'Signaling Active' : 'Signaling Offline'}
          </span>
        </div>

        <div className="device-identity">
          {deviceType === 'mobile' ? (
            <Smartphone size={15} className="device-icon" />
          ) : (
            <Laptop size={15} className="device-icon" />
          )}
          <span className="client-name">{clientName}</span>
          <span className="peer-id-snippet">({peerId?.slice(0, 8)})</span>
        </div>
      </div>
    </header>
  );
}


import React from 'react';
import { Laptop, Smartphone } from 'lucide-react';

export default function Header({ connectionStatus, peerId, clientName, deviceType }) {
  const isOnline = connectionStatus === 'connected';

  return (
    <header className="app-header">
      <div className="brand-group">
        <img src="/logo.png" alt="FlashMux Logo" className="brand-logo-img" />
        <div>
          <h1 className="brand-title">FlashMux</h1>
          <p className="brand-subtitle">Local P2P File Transfer</p>
        </div>
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

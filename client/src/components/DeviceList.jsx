import React from 'react';
import { Laptop, Smartphone, Monitor, Check } from 'lucide-react';

export default function DeviceList({
  peers = [],
  selectedPeerIds = [],
  onTogglePeer,
  onSelectAll,
  onClearSelection,
}) {
  const getDeviceIcon = (type) => {
    switch (type) {
      case 'mobile':
        return <Smartphone size={16} />;
      case 'tablet':
        return <Monitor size={16} />;
      default:
        return <Laptop size={16} />;
    }
  };

  const allSelected = peers.length > 0 && selectedPeerIds.length === peers.length;

  return (
    <div className="panel device-panel">
      <div className="panel-header">
        <div className="panel-header-title">
          <h2 className="panel-title">Available Peers</h2>
          <span className="panel-counter">
            {selectedPeerIds.length} of {peers.length} selected
          </span>
        </div>
        {peers.length > 1 && (
          <button
            type="button"
            className="btn-link"
            onClick={allSelected ? onClearSelection : onSelectAll}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {peers.length === 0 ? (
        <div className="empty-peer-box">
          <p className="empty-title">No peers detected on local network</p>
          <p className="empty-description">
            Open this application on other computers or phones connected to the same Wi-Fi network. You can select multiple devices to broadcast files simultaneously.
          </p>
        </div>
      ) : (
        <div className="peer-list">
          {peers.map((peer) => {
            const isSelected = selectedPeerIds.includes(peer.peerId);
            return (
              <button
                type="button"
                key={peer.peerId}
                className={`peer-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onTogglePeer(peer.peerId)}
              >
                <div className={`peer-checkbox ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <Check size={12} />}
                </div>

                <div className="peer-icon-box">
                  {getDeviceIcon(peer.deviceType)}
                </div>

                <div className="peer-info">
                  <span className="peer-name">{peer.clientName}</span>
                  <span className="peer-meta">{peer.peerId.slice(0, 12)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

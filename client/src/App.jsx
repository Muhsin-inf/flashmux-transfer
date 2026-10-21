import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import Header from './components/Header.jsx';
import DeviceList from './components/DeviceList.jsx';
import DropZone from './components/DropZone.jsx';
import TransferProgress from './components/TransferProgress.jsx';
import TransferModal from './components/TransferModal.jsx';
import QrStreamSender from './components/QrStreamSender.jsx';
import QrStreamReceiver from './components/QrStreamReceiver.jsx';
import { useSignaling } from './hooks/useSignaling.js';
import { useP2PTransfer } from './hooks/useP2PTransfer.js';
import { useOpticalQr } from './hooks/useOpticalQr.js';

export default function App() {
  const {
    peerId,
    clientName,
    deviceType,
    connectionStatus,
    peers,
  } = useSignaling();

  const {
    transferState,
    incomingOffer,
    sendBatch,
    acceptOffer,
    rejectOffer,
    cancelTransfer,
    resetTransfer,
  } = useP2PTransfer();

  // Optical QR hook
  const opticalQr = useOpticalQr();

  // Primary mode: 'webrtc' (Wi-Fi P2P) or 'optical' (Kamera QR)
  const [appMode, setAppMode] = useState('webrtc');
  // Optical QR sub-mode: 'sender' (layar) or 'receiver' (kamera)
  const [opticalSubMode, setOpticalSubMode] = useState('sender');

  // Multi-peer selection state
  const [userSelectedPeerIds, setUserSelectedPeerIds] = useState([]);
  // Track transferId where user manually unhid the dispatch panel
  const [revealedTransferId, setRevealedTransferId] = useState(null);

  // Auto-select single available peer, or filter out disconnected peers
  const activePeerIds = peers.map((p) => p.peerId);
  const selectedPeerIds =
    peers.length === 1
      ? [peers[0].peerId]
      : userSelectedPeerIds.filter((id) => activePeerIds.includes(id));

  const handleTogglePeer = (toggledId) => {
    setUserSelectedPeerIds((prev) => {
      const current = prev.filter((id) => activePeerIds.includes(id));
      if (current.includes(toggledId)) {
        return current.filter((id) => id !== toggledId);
      }
      return [...current, toggledId];
    });
  };

  const handleSelectAll = () => {
    setUserSelectedPeerIds(activePeerIds);
  };

  const handleClearSelection = () => {
    setUserSelectedPeerIds([]);
  };

  const selectedPeerNames = peers
    .filter((p) => selectedPeerIds.includes(p.peerId))
    .map((p) => p.clientName);

  const targetPeerNames = peers
    .filter((p) => (transferState.targetPeerIds || []).includes(p.peerId))
    .map((p) => p.clientName);

  const isTransferActive =
    transferState.status === 'offering' ||
    transferState.status === 'connecting' ||
    transferState.status === 'transferring';

  const isReceiving =
    transferState.role === 'receiver' && transferState.status !== 'idle';
  const isDispatchRevealed = isReceiving && revealedTransferId === transferState.transferId;
  const isDispatchHidden = isReceiving && !isDispatchRevealed;

  return (
    <div className="app-shell">
      <Header
        connectionStatus={connectionStatus}
        peerId={peerId}
        clientName={clientName}
        deviceType={deviceType}
        appMode={appMode}
        onModeChange={setAppMode}
      />

      {appMode === 'webrtc' ? (
        <main className="main-layout">
          <section className="layout-col col-left">
            <DeviceList
              peers={peers}
              selectedPeerIds={selectedPeerIds}
              onTogglePeer={handleTogglePeer}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
            />
          </section>

          <section className="layout-col col-right">
            {isDispatchHidden ? (
              <div className="dispatch-hidden-banner">
                <div className="dispatch-hidden-info">
                  <span className="dispatch-hidden-title">Mode Penerimaan Berlangsung</span>
                  <span className="dispatch-hidden-sub">
                    Panel pengiriman file disembunyikan agar tampilan lebih ringkas
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-reveal-dispatch"
                  onClick={() => setRevealedTransferId(transferState.transferId)}
                >
                  <Upload size={14} />
                  <span>Kirim File</span>
                </button>
              </div>
            ) : (
              <div className="dispatch-container">
                {isReceiving && (
                  <div className="dispatch-collapse-bar">
                    <span className="dispatch-collapse-title">Panel Pengiriman File</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setRevealedTransferId(null)}
                    >
                      Sembunyikan Panel Kirim
                    </button>
                  </div>
                )}
                <DropZone
                  onSendBatch={sendBatch}
                  selectedPeerIds={selectedPeerIds}
                  selectedPeerNames={selectedPeerNames}
                  disabled={isTransferActive}
                />
              </div>
            )}

            <TransferProgress
              transferState={transferState}
              targetPeerNames={targetPeerNames}
              onCancel={cancelTransfer}
              onReset={resetTransfer}
            />
          </section>
        </main>
      ) : (
        <main className="optical-main-layout">
          <div className="optical-sub-nav">
            <button
              type="button"
              className={`optical-nav-btn ${opticalSubMode === 'sender' ? 'active' : ''}`}
              onClick={() => setOpticalSubMode('sender')}
            >
              Kirim via Layar (Sender)
            </button>
            <button
              type="button"
              className={`optical-nav-btn ${opticalSubMode === 'receiver' ? 'active' : ''}`}
              onClick={() => setOpticalSubMode('receiver')}
            >
              Terima via Kamera (Receiver)
            </button>
          </div>

          <div className="optical-content-body">
            {opticalSubMode === 'sender' ? (
              <QrStreamSender
                senderMetadata={opticalQr.senderMetadata}
                senderFps={opticalQr.senderFps}
                setSenderFps={opticalQr.setSenderFps}
                isSending={opticalQr.isSending}
                isPlaying={opticalQr.isPlaying}
                currentDroplet={opticalQr.currentDroplet}
                totalK={opticalQr.totalK}
                senderBlockSize={opticalQr.senderBlockSize}
                setSenderBlockSize={opticalQr.setSenderBlockSize}
                stageSenderFile={opticalQr.stageSenderFile}
                stageSenderText={opticalQr.stageSenderText}
                toggleSenderPlay={opticalQr.toggleSenderPlay}
                resetSender={opticalQr.resetSender}
              />
            ) : (
              <QrStreamReceiver
                cameraActive={opticalQr.cameraActive}
                cameraError={opticalQr.cameraError}
                receiverProgress={opticalQr.receiverProgress}
                receiverStats={opticalQr.receiverStats}
                solvedBlockSet={opticalQr.solvedBlockSet}
                receivedFile={opticalQr.receivedFile}
                receivedMetadata={opticalQr.receivedMetadata}
                isReceiveComplete={opticalQr.isReceiveComplete}
                startScanning={opticalQr.startScanning}
                stopScanning={opticalQr.stopScanning}
                switchCamera={opticalQr.switchCamera}
                resetReceiver={opticalQr.resetReceiver}
                downloadReceivedFile={opticalQr.downloadReceivedFile}
              />
            )}
          </div>
        </main>
      )}

      <TransferModal
        incomingOffer={incomingOffer}
        onAccept={acceptOffer}
        onReject={rejectOffer}
        peers={peers}
      />
    </div>
  );
}

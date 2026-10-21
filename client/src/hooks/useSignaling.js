import { useState, useEffect } from 'react';
import { signalingClient } from '../services/signalingClient.js';
import { detectDeviceType, getDefaultClientName } from '../utils/formatters.js';

function getOrGeneratePeerId() {
  const STORAGE_KEY = 'flashmux_peer_id';
  let stored = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // SessionStorage may fail in private mode
  }
  if (!stored) {
    const rand = Math.random().toString(36).substring(2, 10);
    stored = `peer_${rand}`;
    try {
      sessionStorage.setItem(STORAGE_KEY, stored);
    } catch {
      // Ignore
    }
  }
  return stored;
}

function getOrGenerateClientName() {
  const STORAGE_KEY = 'flashmux_client_name';
  let stored = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  if (!stored) {
    stored = getDefaultClientName();
    try {
      sessionStorage.setItem(STORAGE_KEY, stored);
    } catch {
      // Ignore
    }
  }
  return stored;
}

export function useSignaling() {
  const [peerId] = useState(getOrGeneratePeerId);
  const [clientName, setClientName] = useState(getOrGenerateClientName);
  const [deviceType] = useState(detectDeviceType);
  const [connectionStatus, setConnectionStatus] = useState(() => signalingClient.status);
  const [peers, setPeers] = useState(() => {
    return (signalingClient.lastPeerList?.peers || []).filter((p) => p.peerId !== peerId);
  });

  useEffect(() => {
    // Listen to connection status updates
    const unsubStatus = signalingClient.on('statusChange', (status) => {
      setConnectionStatus(status);
    });

    // Listen to peer list updates
    const unsubPeers = signalingClient.on('PEER_LIST', (data) => {
      const activePeers = (data.peers || []).filter((p) => p.peerId !== peerId);
      setPeers(activePeers);
    });

    // Connect or register with WebSocket signaling server
    signalingClient.connect({
      peerId,
      clientName,
      deviceType,
    });

    return () => {
      unsubStatus();
      unsubPeers();
    };
  }, [peerId, clientName, deviceType]);

  const updateClientName = (newName) => {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    setClientName(cleanName);
    try {
      sessionStorage.setItem('flashmux_client_name', cleanName);
    } catch {
      // Ignore
    }
    signalingClient.register({
      peerId,
      clientName: cleanName,
      deviceType,
    });
  };

  return {
    peerId,
    clientName,
    deviceType,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    peers,
    updateClientName,
    signalingClient,
  };
}

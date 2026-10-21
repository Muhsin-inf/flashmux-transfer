import { useState, useEffect, useRef, useCallback } from 'react';
import { signalingClient } from '../services/signalingClient.js';
import { P2PTransferEngine } from '../services/webrtcEngine.js';
import { BatchFileWriter } from '../services/fileWriter.js';
import { calculateTotalChunks, DEFAULT_CHUNK_SIZE } from '../services/fileChunker.js';

export function useP2PTransfer() {
  const [transferState, setTransferState] = useState({
    status: 'idle', // 'idle' | 'offering' | 'connecting' | 'transferring' | 'completed' | 'error' | 'cancelled'
    role: null, // 'sender' | 'receiver'
    transferId: null,
    targetPeerIds: [], // Array of target peer IDs
    batchMetadata: null,
    currentFile: null,
    progress: {
      currentFileIndex: 0,
      totalFiles: 0,
      currentFileName: '',
      currentRelativePath: '',
      fileBytes: 0,
      fileTotalBytes: 0,
      totalBytesTransferred: 0,
      batchTotalBytes: 0,
      progressPercent: 0,
      speed: 0,
      etaSeconds: 0,
    },
    channels: [
      { id: 0, chunks: 0, bytes: 0, active: false },
      { id: 1, chunks: 0, bytes: 0, active: false },
      { id: 2, chunks: 0, bytes: 0, active: false },
      { id: 3, chunks: 0, bytes: 0, active: false },
    ],
    completedFiles: [],
    result: null,
    error: null,
  });

  const [incomingOffer, setIncomingOffer] = useState(null); // { transferId, from, metadata }

  // Map of active peer transfer engines: targetPeerId -> P2PTransferEngine
  const enginesMapRef = useRef(new Map());
  const stagedFilesRef = useRef([]);
  const transferStateRef = useRef(transferState);

  useEffect(() => {
    transferStateRef.current = transferState;
  }, [transferState]);

  // Teardown all engines on unmount
  useEffect(() => {
    const engines = enginesMapRef.current;
    return () => {
      engines.forEach((engine) => engine.close());
      engines.clear();
    };
  }, []);

  // Register signaling protocol listeners
  useEffect(() => {
    // 1. Receive FILE_OFFER (as receiver)
    const unsubOffer = signalingClient.on('FILE_OFFER', (data) => {
      console.log('[useP2PTransfer] Received FILE_OFFER:', data);
      const isActivelyBusy =
        transferStateRef.current.status === 'offering' ||
        transferStateRef.current.status === 'connecting' ||
        transferStateRef.current.status === 'transferring';

      if (isActivelyBusy) {
        signalingClient.sendResponse({
          to: data.from,
          transferId: data.transferId,
          accepted: false,
          reason: 'Peer is busy with another active transfer',
        });
        return;
      }
      setIncomingOffer({
        transferId: data.transferId,
        from: data.from,
        metadata: data.metadata,
      });
    });

    // 2. Receive FILE_RESPONSE (as sender)
    const unsubResponse = signalingClient.on('FILE_RESPONSE', async (data) => {
      console.log('[useP2PTransfer] Received FILE_RESPONSE from', data.from, data);
      if (
        transferStateRef.current.transferId === data.transferId &&
        transferStateRef.current.role === 'sender'
      ) {
        if (data.accepted) {
          setTransferState((prev) => ({ ...prev, status: 'connecting' }));
          try {
            const engine = new P2PTransferEngine({
              targetPeerId: data.from,
              transferId: data.transferId,
              sendSignal: (sig) => signalingClient.send(sig),
              onFileStart: (fileMeta) => {
                setTransferState((prev) => ({ ...prev, currentFile: fileMeta }));
              },
              onProgress: (prog) => {
                setTransferState((prev) => ({
                  ...prev,
                  status: 'transferring',
                  progress: prog,
                }));
              },
              onChannelProgress: (chans) => {
                setTransferState((prev) => ({ ...prev, channels: chans }));
              },
              onFileComplete: (completedFile) => {
                setTransferState((prev) => ({
                  ...prev,
                  completedFiles: [...prev.completedFiles, completedFile],
                }));
              },
              onComplete: (res) => {
                setTransferState((prev) => ({
                  ...prev,
                  status: 'completed',
                  result: res,
                }));
              },
              onError: (err) => {
                setTransferState((prev) => ({
                  ...prev,
                  status: 'error',
                  error: err.message,
                }));
              },
            });

            enginesMapRef.current.set(data.from, engine);
            await engine.initAsSender(
              transferStateRef.current.batchMetadata,
              stagedFilesRef.current
            );
          } catch (err) {
            console.error('[useP2PTransfer] Sender init failed:', err);
            setTransferState((prev) => ({
              ...prev,
              status: 'error',
              error: err.message,
            }));
          }
        } else {
          setTransferState((prev) => ({
            ...prev,
            status: 'cancelled',
            error: data.reason || `Transfer request declined by peer ${data.from}`,
          }));
        }
      }
    });

    // 3. Receive WebRTC SIGNAL
    const unsubSignal = signalingClient.on('SIGNAL', async (data) => {
      const engine = enginesMapRef.current.get(data.from);
      if (engine && transferStateRef.current.transferId === data.transferId) {
        await engine.handleSignal(data.signalData);
      }
    });

    // 4. Receive TRANSFER_CANCEL
    const unsubCancel = signalingClient.on('TRANSFER_CANCEL', (data) => {
      console.log('[useP2PTransfer] Received TRANSFER_CANCEL:', data);
      if (transferStateRef.current.transferId === data.transferId) {
        const engine = enginesMapRef.current.get(data.from);
        if (engine) {
          engine.close();
          enginesMapRef.current.delete(data.from);
        }
        setTransferState((prev) => ({
          ...prev,
          status: 'cancelled',
          error: data.reason || 'Transfer cancelled by remote peer',
        }));
      }
      setIncomingOffer((prev) => (prev?.transferId === data.transferId ? null : prev));
    });

    return () => {
      unsubOffer();
      unsubResponse();
      unsubSignal();
      unsubCancel();
    };
  }, []);

  // Dispatch multi-file / folder transfer to one or multiple peers
  const sendBatch = useCallback((targetPeerIds, stagedFiles) => {
    if (!targetPeerIds || targetPeerIds.length === 0 || !stagedFiles || stagedFiles.length === 0) {
      return;
    }

    const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    stagedFilesRef.current = stagedFiles;

    let totalBytes = 0;
    const fileManifest = stagedFiles.map((item, index) => {
      totalBytes += item.size;
      return {
        fileIndex: index,
        fileName: item.file.name,
        relativePath: item.relativePath || item.file.name,
        fileSize: item.size,
        fileType: item.type || 'application/octet-stream',
        chunkSize: DEFAULT_CHUNK_SIZE,
        totalChunks: calculateTotalChunks(item.size, DEFAULT_CHUNK_SIZE),
      };
    });

    const isFolder = stagedFiles.some((f) => (f.relativePath || '').includes('/'));

    const batchMetadata = {
      transferId,
      totalFiles: stagedFiles.length,
      totalBytes,
      isFolder,
      files: fileManifest,
    };

    setTransferState({
      status: 'offering',
      role: 'sender',
      transferId,
      targetPeerIds,
      batchMetadata,
      currentFile: fileManifest[0] || null,
      progress: {
        currentFileIndex: 0,
        totalFiles: stagedFiles.length,
        currentFileName: fileManifest[0]?.fileName || '',
        currentRelativePath: fileManifest[0]?.relativePath || '',
        fileBytes: 0,
        fileTotalBytes: fileManifest[0]?.fileSize || 0,
        totalBytesTransferred: 0,
        batchTotalBytes: totalBytes,
        progressPercent: 0,
        speed: 0,
        etaSeconds: 0,
      },
      channels: [
        { id: 0, chunks: 0, bytes: 0, active: false },
        { id: 1, chunks: 0, bytes: 0, active: false },
        { id: 2, chunks: 0, bytes: 0, active: false },
        { id: 3, chunks: 0, bytes: 0, active: false },
      ],
      completedFiles: [],
      result: null,
      error: null,
    });

    // Send offer to each targeted peer
    targetPeerIds.forEach((peerId) => {
      signalingClient.sendOffer({
        to: peerId,
        transferId,
        metadata: batchMetadata,
      });
    });
  }, []);

  // Accept incoming transfer offer as receiver
  const acceptOffer = useCallback(async ({ directoryHandle = null, singleFileHandle = null } = {}) => {
    if (!incomingOffer) return;

    const { transferId, from, metadata } = incomingOffer;
    setIncomingOffer(null);

    // Teardown any previous engines from completed or previous transfers
    enginesMapRef.current.forEach((engine) => engine.close());
    enginesMapRef.current.clear();

    const fileWriter = new BatchFileWriter({
      directoryHandle,
      singleFileHandle,
    });

    const firstFile = metadata.files?.[0] || null;

    setTransferState({
      status: 'connecting',
      role: 'receiver',
      transferId,
      targetPeerIds: [from],
      batchMetadata: metadata,
      currentFile: firstFile,
      progress: {
        currentFileIndex: 0,
        totalFiles: metadata.totalFiles || metadata.files?.length || 1,
        currentFileName: firstFile?.fileName || '',
        currentRelativePath: firstFile?.relativePath || '',
        fileBytes: 0,
        fileTotalBytes: firstFile?.fileSize || 0,
        totalBytesTransferred: 0,
        batchTotalBytes: metadata.totalBytes || 0,
        progressPercent: 0,
        speed: 0,
        etaSeconds: 0,
      },
      channels: [
        { id: 0, chunks: 0, bytes: 0, active: false },
        { id: 1, chunks: 0, bytes: 0, active: false },
        { id: 2, chunks: 0, bytes: 0, active: false },
        { id: 3, chunks: 0, bytes: 0, active: false },
      ],
      completedFiles: [],
      result: null,
      error: null,
    });

    const engine = new P2PTransferEngine({
      targetPeerId: from,
      transferId,
      sendSignal: (sig) => signalingClient.send(sig),
      fileWriter,
      onFileStart: (fileMeta) => {
        setTransferState((prev) => ({ ...prev, currentFile: fileMeta }));
      },
      onProgress: (prog) => {
        setTransferState((prev) => ({
          ...prev,
          status: 'transferring',
          progress: prog,
        }));
      },
      onChannelProgress: (chans) => {
        setTransferState((prev) => ({ ...prev, channels: chans }));
      },
      onFileComplete: (completedFile) => {
        setTransferState((prev) => ({
          ...prev,
          completedFiles: [...prev.completedFiles, completedFile],
        }));
      },
      onComplete: (res) => {
        setTransferState((prev) => ({
          ...prev,
          status: 'completed',
          result: res,
        }));
      },
      onError: (err) => {
        setTransferState((prev) => ({
          ...prev,
          status: 'error',
          error: err.message,
        }));
      },
    });

    enginesMapRef.current.set(from, engine);
    engine.initAsReceiver(metadata);

    // Send acceptance to sender
    signalingClient.sendResponse({
      to: from,
      transferId,
      accepted: true,
    });
  }, [incomingOffer]);

  // Decline incoming offer
  const rejectOffer = useCallback(() => {
    if (!incomingOffer) return;
    const { transferId, from } = incomingOffer;
    setIncomingOffer(null);

    signalingClient.sendResponse({
      to: from,
      transferId,
      accepted: false,
      reason: 'Recipient declined the transfer',
    });
  }, [incomingOffer]);

  // Cancel ongoing transfer
  const cancelTransfer = useCallback((reason = 'Transfer cancelled by user') => {
    const { transferId, targetPeerIds } = transferStateRef.current;
    if (transferId && targetPeerIds) {
      targetPeerIds.forEach((targetPeerId) => {
        signalingClient.sendCancel({
          to: targetPeerId,
          transferId,
          reason,
        });
      });
    }

    enginesMapRef.current.forEach((engine) => engine.close());
    enginesMapRef.current.clear();
    stagedFilesRef.current = [];

    setTransferState((prev) => ({
      ...prev,
      status: 'cancelled',
      error: reason,
    }));
  }, []);

  // Reset transfer state back to idle
  const resetTransfer = useCallback(() => {
    enginesMapRef.current.forEach((engine) => engine.close());
    enginesMapRef.current.clear();
    stagedFilesRef.current = [];

    setTransferState({
      status: 'idle',
      role: null,
      transferId: null,
      targetPeerIds: [],
      batchMetadata: null,
      currentFile: null,
      progress: {
        currentFileIndex: 0,
        totalFiles: 0,
        currentFileName: '',
        currentRelativePath: '',
        fileBytes: 0,
        fileTotalBytes: 0,
        totalBytesTransferred: 0,
        batchTotalBytes: 0,
        progressPercent: 0,
        speed: 0,
        etaSeconds: 0,
      },
      channels: [
        { id: 0, chunks: 0, bytes: 0, active: false },
        { id: 1, chunks: 0, bytes: 0, active: false },
        { id: 2, chunks: 0, bytes: 0, active: false },
        { id: 3, chunks: 0, bytes: 0, active: false },
      ],
      completedFiles: [],
      result: null,
      error: null,
    });
  }, []);

  return {
    transferState,
    incomingOffer,
    sendBatch,
    acceptOffer,
    rejectOffer,
    cancelTransfer,
    resetTransfer,
  };
}

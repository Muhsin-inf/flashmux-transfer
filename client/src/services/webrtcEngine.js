import { encodeChunkPacket, decodeChunkPacket } from '../utils/binaryPacket.js';
import { readChunkSlice, calculateTotalChunks, DEFAULT_CHUNK_SIZE } from './fileChunker.js';
import { computeFileMD5 } from './fileWriter.js';

const CHUNK_SIZE = DEFAULT_CHUNK_SIZE; // 64 KB
const MAX_BUFFER_AMOUNT = 1024 * 1024; // 1 MB backpressure ceiling
const LOW_BUFFER_THRESHOLD = 256 * 1024; // 256 KB threshold for bufferedamountlow

/**
 * P2PTransferEngine manages WebRTC PeerConnection, reliable single-channel DataChannel streaming,
 * backpressure flow control, and batch telemetry.
 */
export class P2PTransferEngine {
  constructor({
    targetPeerId,
    transferId,
    sendSignal,
    onProgress,
    onChannelProgress,
    onFileStart,
    onFileComplete,
    onComplete,
    onError,
    fileWriter = null,
  }) {
    this.targetPeerId = targetPeerId;
    this.transferId = transferId;
    this.sendSignal = sendSignal;
    this.onProgress = onProgress;
    this.onChannelProgress = onChannelProgress;
    this.onFileStart = onFileStart;
    this.onFileComplete = onFileComplete;
    this.onComplete = onComplete;
    this.onError = onError;
    this.fileWriter = fileWriter;

    this.numChannels = 1;
    this.channels = [];
    this.pendingCandidates = [];
    this.ackListeners = new Map();
    this.isClosed = false;

    // Stream telemetry
    this.channelStats = [
      { id: 0, chunks: 0, bytes: 0, active: false, rangeLabel: 'P2P Direct Stream', progressPercent: 0 },
    ];

    // LAN host ICE candidates
    this.pc = new RTCPeerConnection({
      iceServers: [],
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.isClosed) {
        this.sendSignal({
          type: 'SIGNAL',
          to: this.targetPeerId,
          transferId: this.transferId,
          signalData: { candidate: event.candidate },
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[WebRTCEngine] Peer ${this.targetPeerId} connection: ${this.pc.connectionState}`);
      if (this.pc.connectionState === 'failed' && !this.isClosed) {
        this.handleError(new Error('WebRTC connection failed'));
      }
    };
  }

  // -------------------------------------------------------------
  // SENDER: MULTI-FILE & FOLDER BATCH STREAMING
  // -------------------------------------------------------------
  async initAsSender(batchMetadata, stagedFiles) {
    this.role = 'sender';
    this.batchMetadata = batchMetadata;
    this.stagedFiles = stagedFiles; // Array of { file, relativePath, size, type, isDirectory }
    this.totalFiles = stagedFiles.length;
    this.batchTotalBytes = batchMetadata.totalBytes || 0;

    this.currentFileIndex = 0;
    this.totalBytesTransferred = 0;
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();
    this.lastProgressBytes = 0;

    // Single reliable ordered DataChannel
    const dc = this.pc.createDataChannel('transfer_channel_0', {
      ordered: true,
    });
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = LOW_BUFFER_THRESHOLD;

    dc.onopen = () => {
      console.log(`[WebRTCEngine] Transfer channel open to ${this.targetPeerId}`);
      this.channelStats[0].active = true;
      this.startBatchStreaming();
    };

    dc.onclose = () => {
      this.channelStats[0].active = false;
    };

    dc.onerror = (err) => {
      console.error('[WebRTCEngine] Sender channel error:', err);
    };

    dc.onmessage = (msgEvent) => {
      if (typeof msgEvent.data === 'string') {
        try {
          const control = JSON.parse(msgEvent.data);
          this.handleSenderControl(control);
        } catch (err) {
          console.warn('[WebRTCEngine] Sender control parse error:', err);
        }
      }
    };

    this.channels = [dc];

    // Dispatch SDP offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.sendSignal({
      type: 'SIGNAL',
      to: this.targetPeerId,
      transferId: this.transferId,
      signalData: { sdp: this.pc.localDescription },
    });
  }

  handleSenderControl(control) {
    if (control.type === 'FILE_END_ACK') {
      const key = `FILE_END_ACK_${control.fileIndex}`;
      const listener = this.ackListeners.get(key);
      if (listener) listener();
    } else if (control.type === 'BATCH_COMPLETE_ACK') {
      const listener = this.ackListeners.get('BATCH_COMPLETE_ACK');
      if (listener) listener();
    }
  }

  waitForAck(ackType, fileIndex, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const key = fileIndex >= 0 ? `${ackType}_${fileIndex}` : ackType;
      const timer = setTimeout(() => {
        this.ackListeners.delete(key);
        resolve(false);
      }, timeoutMs);

      this.ackListeners.set(key, () => {
        clearTimeout(timer);
        this.ackListeners.delete(key);
        resolve(true);
      });
    });
  }

  async startBatchStreaming() {
    this.startTime = Date.now();

    for (let i = 0; i < this.totalFiles; i++) {
      if (this.isClosed) break;
      this.currentFileIndex = i;
      const staged = this.stagedFiles[i];
      const fileMeta = this.batchMetadata.files[i];

      console.log(`[WebRTCEngine] Streaming item ${i + 1}/${this.totalFiles}: ${fileMeta.relativePath}`);

      // Reset per-file telemetry
      this.channelStats[0].chunks = 0;
      this.channelStats[0].bytes = 0;
      this.channelStats[0].progressPercent = 0;

      if (this.onFileStart) {
        this.onFileStart(fileMeta, i, this.totalFiles);
      }

      // Notify receiver of next file or directory
      this.broadcastControlMessage({
        type: 'FILE_START',
        fileIndex: i,
        metadata: fileMeta,
      });

      let fileHash = '';
      if (!fileMeta.isDirectory && staged?.file) {
        fileHash = await this.streamSingleFile(staged.file, fileMeta);
      }

      // Notify receiver of file completion
      this.broadcastControlMessage({
        type: 'FILE_END',
        fileIndex: i,
        fileHash,
      });

      // Synchronize: Wait for receiver to finish writing & closing file before streaming next
      await this.waitForAck('FILE_END_ACK', i, 6000);

      if (this.onFileComplete) {
        this.onFileComplete({
          fileIndex: i,
          fileName: fileMeta.fileName,
          relativePath: fileMeta.relativePath,
          fileHash,
          fileSize: fileMeta.fileSize,
        });
      }
    }

    if (!this.isClosed) {
      const totalDurationSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);
      const averageSpeed = this.totalBytesTransferred / totalDurationSeconds;

      this.broadcastControlMessage({
        type: 'BATCH_COMPLETE',
        totalFiles: this.totalFiles,
        totalBytes: this.totalBytesTransferred,
        totalDurationSeconds,
        averageSpeed,
      });

      await this.waitForAck('BATCH_COMPLETE_ACK', -1, 4000);

      if (this.onComplete) {
        this.onComplete({
          role: 'sender',
          totalFiles: this.totalFiles,
          totalBytes: this.totalBytesTransferred,
          totalDurationSeconds,
          averageSpeed,
        });
      }
    }
  }

  broadcastControlMessage(msgObj) {
    const raw = JSON.stringify(msgObj);
    const openChannel = this.channels.find((ch) => ch.readyState === 'open');
    if (openChannel) {
      try {
        openChannel.send(raw);
      } catch (err) {
        console.warn('[WebRTCEngine] Send control error:', err.message);
      }
    }
  }

  /**
   * Streams a single file sequentially over the high-speed data channel with backpressure
   */
  async streamSingleFile(file, fileMeta) {
    const totalChunks = calculateTotalChunks(file.size, CHUNK_SIZE);
    let fileSentBytes = 0;
    const dc = this.channels[0];
    if (!dc || dc.readyState !== 'open') return '';

    // Fast asynchronous pre-calculation of file MD5 hash
    const hashPromise = computeFileMD5(file);

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      if (this.isClosed || dc.readyState !== 'open') break;

      // Backpressure ceiling: wait if network buffer is saturated
      if (dc.bufferedAmount > MAX_BUFFER_AMOUNT) {
        await new Promise((resolve) => {
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      if (this.isClosed) break;

      const chunkBuffer = await readChunkSlice(file, chunkIdx, CHUNK_SIZE);
      const packet = encodeChunkPacket(chunkIdx, 0, chunkBuffer);

      try {
        dc.send(packet);
      } catch (err) {
        console.error('[WebRTCEngine] Send chunk error:', err);
        break;
      }

      fileSentBytes += chunkBuffer.byteLength;
      this.totalBytesTransferred += chunkBuffer.byteLength;

      this.channelStats[0].chunks += 1;
      this.channelStats[0].bytes += chunkBuffer.byteLength;
      this.channelStats[0].progressPercent = totalChunks > 0
        ? Math.min(100, (this.channelStats[0].chunks / totalChunks) * 100)
        : 100;

      this.emitProgress({
        fileBytes: fileSentBytes,
        fileTotalBytes: file.size,
        currentChunks: chunkIdx + 1,
        totalChunks,
        fileMeta,
      });
    }

    const fileHash = await hashPromise;
    return fileHash;
  }

  // -------------------------------------------------------------
  // RECEIVER: MULTI-FILE & FOLDER BATCH RECONSTRUCTION
  // -------------------------------------------------------------
  initAsReceiver(batchMetadata) {
    this.role = 'receiver';
    this.batchMetadata = batchMetadata || {};
    this.totalFiles = batchMetadata.totalFiles || (batchMetadata.files?.length) || 1;
    this.batchTotalBytes = batchMetadata.totalBytes || 0;

    this.currentFileIndex = 0;
    this.totalBytesTransferred = 0;
    this.completedFiles = [];
    this.startTime = Date.now();

    // Per-file state
    this.currentFileMeta = null;
    this.currentFileReceivedChunks = 0;
    this.currentFileReceivedBytes = 0;

    this.pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      this.channels = [dc];
      this.channelStats[0].active = true;

      dc.onopen = () => {
        console.log('[WebRTCEngine] Receiver channel open');
      };

      dc.onmessage = async (msgEvent) => {
        // Control message (JSON)
        if (typeof msgEvent.data === 'string') {
          try {
            const control = JSON.parse(msgEvent.data);
            await this.handleReceiverControl(control);
          } catch (err) {
            console.error('[WebRTCEngine] Control message error:', err);
          }
          return;
        }

        // Binary chunk packet
        try {
          const { chunkIndex, payloadSize, payload } = decodeChunkPacket(msgEvent.data);

          if (this.fileWriter) {
            await this.fileWriter.writeChunk(chunkIndex, payload);
          }

          this.currentFileReceivedChunks += 1;
          this.currentFileReceivedBytes += payloadSize;
          this.totalBytesTransferred += payloadSize;

          this.channelStats[0].chunks += 1;
          this.channelStats[0].bytes += payloadSize;

          const totalChunks = this.currentFileMeta?.totalChunks || 1;
          this.channelStats[0].progressPercent = Math.min(100, (this.channelStats[0].chunks / totalChunks) * 100);

          this.emitProgress({
            fileBytes: this.currentFileReceivedBytes,
            fileTotalBytes: this.currentFileMeta?.fileSize || 0,
            currentChunks: this.currentFileReceivedChunks,
            totalChunks,
            fileMeta: this.currentFileMeta,
          });
        } catch (err) {
          console.error('[WebRTCEngine] Receiver write error:', err);
        }
      };

      dc.onclose = () => {
        this.channelStats[0].active = false;
      };

      dc.onerror = (err) => {
        console.error('[WebRTCEngine] Receiver channel error:', err);
      };
    };
  }

  async handleReceiverControl(control) {
    switch (control.type) {
      case 'FILE_START': {
        this.currentFileIndex = control.fileIndex;
        this.currentFileMeta = control.metadata;
        this.currentFileReceivedChunks = 0;
        this.currentFileReceivedBytes = 0;

        this.channelStats[0].chunks = 0;
        this.channelStats[0].bytes = 0;
        this.channelStats[0].progressPercent = 0;

        if (this.fileWriter) {
          await this.fileWriter.startFile(control.metadata);
        }

        if (this.onFileStart) {
          this.onFileStart(control.metadata, control.fileIndex, this.totalFiles);
        }
        break;
      }

      case 'FILE_END': {
        let writeResult = null;
        if (this.fileWriter) {
          writeResult = await this.fileWriter.finishCurrentFile();
        }

        const localHash = writeResult?.localHash || '';
        const verified = localHash ? localHash.toLowerCase() === (control.fileHash || '').toLowerCase() : true;

        const completedInfo = {
          fileIndex: control.fileIndex,
          fileName: this.currentFileMeta?.fileName,
          relativePath: this.currentFileMeta?.relativePath,
          fileSize: this.currentFileMeta?.fileSize,
          verified,
          localHash,
          senderHash: control.fileHash,
          writeResult,
        };

        this.completedFiles.push(completedInfo);

        // Send ACK back to sender to guarantee sequential file progression
        this.broadcastControlMessage({
          type: 'FILE_END_ACK',
          fileIndex: control.fileIndex,
        });

        if (this.onFileComplete) {
          this.onFileComplete(completedInfo);
        }
        break;
      }

      case 'BATCH_COMPLETE': {
        let batchResult = null;
        if (this.fileWriter) {
          batchResult = await this.fileWriter.finishBatch();
        }

        // Send ACK back to sender
        this.broadcastControlMessage({
          type: 'BATCH_COMPLETE_ACK',
        });

        const totalDurationSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);
        const averageSpeed = this.totalBytesTransferred / totalDurationSeconds;

        if (this.onComplete) {
          this.onComplete({
            role: 'receiver',
            totalFiles: this.completedFiles.length,
            totalBytes: this.totalBytesTransferred,
            totalDurationSeconds,
            averageSpeed,
            completedFiles: this.completedFiles,
            batchResult,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  // -------------------------------------------------------------
  // SIGNALING & ICE
  // -------------------------------------------------------------
  async handleSignal(signalData) {
    if (this.isClosed) return;

    try {
      if (signalData.sdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));

        while (this.pendingCandidates.length > 0) {
          const candidate = this.pendingCandidates.shift();
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        if (this.pc.remoteDescription.type === 'offer') {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.sendSignal({
            type: 'SIGNAL',
            to: this.targetPeerId,
            transferId: this.transferId,
            signalData: { sdp: this.pc.localDescription },
          });
        }
      } else if (signalData.candidate) {
        if (this.pc.remoteDescription) {
          await this.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } else {
          this.pendingCandidates.push(signalData.candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTCEngine] Signal error:', err);
      this.handleError(err);
    }
  }

  // -------------------------------------------------------------
  // PROGRESS & TELEMETRY
  // -------------------------------------------------------------
  emitProgress({ fileBytes, fileTotalBytes, currentChunks, totalChunks, fileMeta } = {}) {
    const now = Date.now();
    const timeDiff = (now - (this.lastProgressTime || now)) / 1000;

    let speed = 0;
    if (timeDiff >= 0.3) {
      const bytesDiff = this.totalBytesTransferred - (this.lastProgressBytes || 0);
      speed = bytesDiff / timeDiff;
      this.lastProgressTime = now;
      this.lastProgressBytes = this.totalBytesTransferred;
      this.currentSpeed = speed;
    } else {
      speed = this.currentSpeed || 0;
    }

    const remainingBatchBytes = Math.max(0, this.batchTotalBytes - this.totalBytesTransferred);
    const etaSeconds = speed > 0 ? remainingBatchBytes / speed : 0;
    const elapsedSeconds = Math.max(0, (now - this.startTime) / 1000);

    const progressPercent = this.batchTotalBytes > 0
      ? Math.min(100, (this.totalBytesTransferred / this.batchTotalBytes) * 100)
      : 0;

    if (this.onProgress) {
      this.onProgress({
        role: this.role,
        currentFileIndex: this.currentFileIndex,
        totalFiles: this.totalFiles,
        currentFileName: fileMeta?.fileName || '',
        currentRelativePath: fileMeta?.relativePath || '',
        fileBytes: fileBytes || 0,
        fileTotalBytes: fileTotalBytes || 0,
        currentChunks: currentChunks || 0,
        totalChunks: totalChunks || 0,
        totalBytesTransferred: this.totalBytesTransferred,
        batchTotalBytes: this.batchTotalBytes,
        progressPercent,
        speed,
        etaSeconds,
        elapsedSeconds,
      });
    }

    if (this.onChannelProgress) {
      this.onChannelProgress(this.channelStats.map((ch) => ({ ...ch })));
    }
  }

  handleError(err) {
    if (this.onError) {
      this.onError(err);
    }
  }

  close() {
    if (this.isClosed) return;
    this.isClosed = true;

    try {
      this.channels.forEach((dc) => {
        try {
          dc.close();
        } catch {
          // Ignore
        }
      });
      this.channels = [];

      if (this.pc) {
        this.pc.close();
      }
      if (this.fileWriter) {
        this.fileWriter.abort();
      }
    } catch (err) {
      console.warn('[WebRTCEngine] Cleanup warning:', err.message);
    }
  }
}

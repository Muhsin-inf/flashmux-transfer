import { encodeChunkPacket, decodeChunkPacket } from '../utils/binaryPacket.js';
import { readChunkSlice, calculateTotalChunks, DEFAULT_CHUNK_SIZE } from './fileChunker.js';
import { computeFileMD5 } from './fileWriter.js';

const CHUNK_SIZE = DEFAULT_CHUNK_SIZE; // 64 KB
const MAX_BUFFER_AMOUNT = 1024 * 1024; // 1 MB backpressure ceiling
const LOW_BUFFER_THRESHOLD = 256 * 1024; // 256 KB threshold for bufferedamountlow

/**
 * P2PTransferEngine manages WebRTC PeerConnection, 4x parallel DataChannels,
 * IDM-style independent segment partitioning with work-stealing, and batch telemetry.
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

    this.numChannels = 4;
    this.channels = [];
    this.pendingCandidates = [];
    this.isClosed = false;

    // Multi-channel telemetry with independent segment tracking
    this.channelStats = [
      { id: 0, chunks: 0, bytes: 0, active: false, rangeLabel: 'Part 1 (0% - 25%)', progressPercent: 0 },
      { id: 1, chunks: 0, bytes: 0, active: false, rangeLabel: 'Part 2 (25% - 50%)', progressPercent: 0 },
      { id: 2, chunks: 0, bytes: 0, active: false, rangeLabel: 'Part 3 (50% - 75%)', progressPercent: 0 },
      { id: 3, chunks: 0, bytes: 0, active: false, rangeLabel: 'Part 4 (75% - 100%)', progressPercent: 0 },
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
    this.stagedFiles = stagedFiles; // Array of { file, relativePath, size, type }
    this.totalFiles = stagedFiles.length;
    this.batchTotalBytes = batchMetadata.totalBytes || 0;

    this.currentFileIndex = 0;
    this.totalBytesTransferred = 0;
    this.openChannelsCount = 0;
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();
    this.lastProgressBytes = 0;

    // Open 4 parallel DataChannels
    for (let i = 0; i < this.numChannels; i++) {
      const channelId = i;
      const dc = this.pc.createDataChannel(`transfer_channel_${channelId}`, {
        ordered: true,
      });
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = LOW_BUFFER_THRESHOLD;

      dc.onopen = () => {
        console.log(`[WebRTCEngine] Channel ${channelId} open to ${this.targetPeerId}`);
        this.channelStats[channelId].active = true;
        this.openChannelsCount += 1;
        if (this.openChannelsCount === this.numChannels) {
          console.log('[WebRTCEngine] All 4 channels ready. Starting segmented streaming.');
          this.startBatchStreaming();
        }
      };

      dc.onclose = () => {
        this.channelStats[channelId].active = false;
      };

      dc.onerror = (err) => {
        console.error(`[WebRTCEngine] Channel ${channelId} error:`, err);
      };

      this.channels.push(dc);
    }

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

  async startBatchStreaming() {
    this.startTime = Date.now();

    for (let i = 0; i < this.totalFiles; i++) {
      if (this.isClosed) break;
      this.currentFileIndex = i;
      const staged = this.stagedFiles[i];
      const fileMeta = this.batchMetadata.files[i];

      console.log(`[WebRTCEngine] Streaming file ${i + 1}/${this.totalFiles}: ${fileMeta.relativePath}`);

      // Reset per-file channel stats
      this.channelStats.forEach((ch) => {
        ch.chunks = 0;
        ch.bytes = 0;
        ch.progressPercent = 0;
      });

      if (this.onFileStart) {
        this.onFileStart(fileMeta, i, this.totalFiles);
      }

      // Notify receiver of next file
      this.broadcastControlMessage({
        type: 'FILE_START',
        fileIndex: i,
        metadata: fileMeta,
      });

      // Stream current file with IDM-style independent segments
      const fileHash = await this.streamSingleFile(staged.file, fileMeta);

      // Notify receiver of file completion
      this.broadcastControlMessage({
        type: 'FILE_END',
        fileIndex: i,
        fileHash,
      });

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
      openChannel.send(raw);
    }
  }

  /**
   * Streams a single file using 4 independent segments (IDM-style) with work-stealing
   */
  async streamSingleFile(file, fileMeta) {
    const totalChunks = calculateTotalChunks(file.size, CHUNK_SIZE);
    let fileSentBytes = 0;

    // Fast asynchronous pre-calculation of file MD5 hash
    const hashPromise = computeFileMD5(file);

    const activeChannels = this.channels.filter((ch) => ch.readyState === 'open');
    const numChannels = Math.min(activeChannels.length || 4, Math.max(1, totalChunks));

    // Partition totalChunks into independent segments for each channel
    const chunksPerChannel = Math.ceil(totalChunks / numChannels);
    const segments = [];

    for (let i = 0; i < numChannels; i++) {
      const start = i * chunksPerChannel;
      const end = Math.min(start + chunksPerChannel, totalChunks);
      if (start < totalChunks) {
        const segTotal = end - start;
        const startPct = Math.round((start / totalChunks) * 100);
        const endPct = Math.round((end / totalChunks) * 100);

        segments.push({
          channelId: i,
          startChunk: start,
          endChunk: end,
          currentChunk: start,
          totalChunks: segTotal,
          rangeLabel: `Part ${i + 1} (${startPct}% - ${endPct}%)`,
          sentChunks: 0,
        });
      }
    }

    // Set initial ranges in channel stats
    segments.forEach((seg) => {
      this.channelStats[seg.channelId].rangeLabel = seg.rangeLabel;
    });

    const channelPump = async (dc, channelId) => {
      const seg = segments.find((s) => s.channelId === channelId);
      if (!seg) return;

      // 1. Pump dedicated segment independently without lockstep with other channels
      while (seg.currentChunk < seg.endChunk && dc.readyState === 'open' && !this.isClosed) {
        if (dc.bufferedAmount > MAX_BUFFER_AMOUNT) {
          await new Promise((resolve) => {
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        if (seg.currentChunk >= seg.endChunk || this.isClosed) break;

        const chunkIdx = seg.currentChunk;
        seg.currentChunk += 1;
        seg.sentChunks += 1;

        const payloadBuffer = await readChunkSlice(file, chunkIdx, CHUNK_SIZE);
        const packet = encodeChunkPacket(chunkIdx, channelId, payloadBuffer);

        try {
          dc.send(packet);
        } catch (err) {
          console.error(`[WebRTCEngine] Send error on ch ${channelId}:`, err);
          break;
        }

        fileSentBytes += payloadBuffer.byteLength;
        this.totalBytesTransferred += payloadBuffer.byteLength;

        this.channelStats[channelId].chunks += 1;
        this.channelStats[channelId].bytes += payloadBuffer.byteLength;
        this.channelStats[channelId].progressPercent = seg.totalChunks > 0
          ? Math.min(100, (seg.sentChunks / seg.totalChunks) * 100)
          : 100;

        this.emitProgress({
          fileBytes: fileSentBytes,
          fileTotalBytes: file.size,
          currentChunks: this.channelStats.reduce((acc, c) => acc + c.chunks, 0),
          totalChunks,
          fileMeta,
        });
      }

      // 2. Work-Stealing: If this channel finished its segment early, help the busiest remaining segment
      while (!this.isClosed && dc.readyState === 'open') {
        const busySegments = segments.filter(
          (s) => s.endChunk - s.currentChunk > 2 && s.channelId !== channelId
        );
        if (busySegments.length === 0) break;

        busySegments.sort((a, b) => (b.endChunk - b.currentChunk) - (a.endChunk - a.currentChunk));
        const victim = busySegments[0];

        // Steal from the end of victim's segment
        victim.endChunk -= 1;
        const stolenChunk = victim.endChunk;
        if (stolenChunk < victim.currentChunk) break;

        if (dc.bufferedAmount > MAX_BUFFER_AMOUNT) {
          await new Promise((resolve) => {
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        const payloadBuffer = await readChunkSlice(file, stolenChunk, CHUNK_SIZE);
        const packet = encodeChunkPacket(stolenChunk, channelId, payloadBuffer);
        try {
          dc.send(packet);
        } catch {
          break;
        }

        fileSentBytes += payloadBuffer.byteLength;
        this.totalBytesTransferred += payloadBuffer.byteLength;

        this.channelStats[channelId].chunks += 1;
        this.channelStats[channelId].bytes += payloadBuffer.byteLength;

        this.emitProgress({
          fileBytes: fileSentBytes,
          fileTotalBytes: file.size,
          currentChunks: this.channelStats.reduce((acc, c) => acc + c.chunks, 0),
          totalChunks,
          fileMeta,
        });
      }
    };

    // Run all 4 channel pumps concurrently
    await Promise.all(this.channels.map((dc, i) => channelPump(dc, i)));

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
      const channelId = this.channels.length;
      this.channels.push(dc);
      this.channelStats[channelId].active = true;

      dc.onopen = () => {
        console.log(`[WebRTCEngine] Receiver channel ${channelId} open`);
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
        const { chunkIndex, channelId: packetChannelId, payloadSize, payload } = decodeChunkPacket(msgEvent.data);

        if (this.fileWriter) {
          await this.fileWriter.writeChunk(chunkIndex, payload);
        }

        this.currentFileReceivedChunks += 1;
        this.currentFileReceivedBytes += payloadSize;
        this.totalBytesTransferred += payloadSize;

        const activeChanId = packetChannelId < 4 ? packetChannelId : channelId;
        this.channelStats[activeChanId].chunks += 1;
        this.channelStats[activeChanId].bytes += payloadSize;

        const totalChunks = this.currentFileMeta?.totalChunks || 1;
        this.channelStats[activeChanId].progressPercent = Math.min(100, (this.channelStats[activeChanId].chunks / (totalChunks / 4)) * 100);

        this.emitProgress({
          fileBytes: this.currentFileReceivedBytes,
          fileTotalBytes: this.currentFileMeta?.fileSize || 0,
          currentChunks: this.currentFileReceivedChunks,
          totalChunks,
          fileMeta: this.currentFileMeta,
        });
      };

      dc.onclose = () => {
        this.channelStats[channelId].active = false;
      };

      dc.onerror = (err) => {
        console.error(`[WebRTCEngine] Receiver channel ${channelId} error:`, err);
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

        this.channelStats.forEach((ch, idx) => {
          ch.chunks = 0;
          ch.bytes = 0;
          ch.progressPercent = 0;
          ch.rangeLabel = `Part ${idx + 1} (${idx * 25}% - ${(idx + 1) * 25}%)`;
        });

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

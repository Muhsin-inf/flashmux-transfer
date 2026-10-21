import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { FountainEncoder, FountainDecoder, DEFAULT_QR_BLOCK_SIZE } from '../services/fountainQrEngine.js';

export function useOpticalQr() {
  // ==========================================
  // SENDER STATE
  // ==========================================
  const [senderFile, setSenderFile] = useState(null);
  const [senderMetadata, setSenderMetadata] = useState(null);
  const [senderFps, setSenderFps] = useState(15);
  const [senderBlockSize, setSenderBlockSize] = useState(DEFAULT_QR_BLOCK_SIZE);
  const [isSending, setIsSending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentDroplet, setCurrentDroplet] = useState(null);
  const [totalK, setTotalK] = useState(0);

  const encoderRef = useRef(null);
  const senderTimerRef = useRef(null);

  // Advance to next droplet
  const stepDroplet = useCallback(() => {
    if (!encoderRef.current) return;
    const droplet = encoderRef.current.getDroplet();
    setCurrentDroplet(droplet);
  }, []);

  // Frame streaming ticker
  useEffect(() => {
    if (isSending && isPlaying && encoderRef.current) {
      const interval = Math.round(1000 / senderFps);
      senderTimerRef.current = setInterval(() => {
        stepDroplet();
      }, interval);

      return () => {
        if (senderTimerRef.current) {
          clearInterval(senderTimerRef.current);
        }
      };
    }
  }, [isSending, isPlaying, senderFps, stepDroplet]);

  // Stage a file for QR streaming
  const stageSenderFile = useCallback(async (file, blockSize = senderBlockSize) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const metadata = {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
      };

      const encoder = new FountainEncoder(bytes, metadata, blockSize);
      encoderRef.current = encoder;

      setSenderFile(file);
      setSenderMetadata(metadata);
      setTotalK(encoder.K);
      setIsSending(true);
      setIsPlaying(true);

      const firstDroplet = encoder.getDroplet(0);
      setCurrentDroplet(firstDroplet);
    } catch (err) {
      console.error('[useOpticalQr] Stage file error:', err);
    }
  }, [senderBlockSize]);

  // Stage raw text for QR streaming
  const stageSenderText = useCallback((text, title = 'message.txt') => {
    const bytes = new TextEncoder().encode(text);
    const metadata = {
      fileName: title,
      fileType: 'text/plain',
      fileSize: bytes.length,
    };

    const encoder = new FountainEncoder(bytes, metadata, senderBlockSize);
    encoderRef.current = encoder;

    setSenderFile({ name: title, size: bytes.length, type: 'text/plain' });
    setSenderMetadata(metadata);
    setTotalK(encoder.K);
    setIsSending(true);
    setIsPlaying(true);

    const firstDroplet = encoder.getDroplet(0);
    setCurrentDroplet(firstDroplet);
  }, [senderBlockSize]);

  const toggleSenderPlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const resetSender = useCallback(() => {
    if (senderTimerRef.current) {
      clearInterval(senderTimerRef.current);
    }
    encoderRef.current = null;
    setSenderFile(null);
    setSenderMetadata(null);
    setIsSending(false);
    setIsPlaying(false);
    setCurrentDroplet(null);
    setTotalK(0);
  }, []);

  // ==========================================
  // RECEIVER STATE
  // ==========================================
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' or 'user'
  const [receiverProgress, setReceiverProgress] = useState(0);
  const [receiverStats, setReceiverStats] = useState({
    solved: 0,
    K: 0,
    scannedCount: 0,
    transferId: null,
  });
  const [solvedBlockSet, setSolvedBlockSet] = useState(new Set());
  const [receivedFile, setReceivedFile] = useState(null);
  const [receivedMetadata, setReceivedMetadata] = useState(null);
  const [isReceiveComplete, setIsReceiveComplete] = useState(false);

  const decoderRef = useRef(new FountainDecoder());
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const canvasRef = useRef(null);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, []);

  const isStartingRef = useRef(false);

  // Stop camera and scanner loop
  const stopScanning = useCallback(() => {
    isStartingRef.current = false;
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setCameraActive(false);
  }, []);

  // Start camera and QR scanner
  const startScanning = useCallback(async (videoEl, overrideFacingMode = null) => {
    if (!videoEl || isStartingRef.current) return;
    isStartingRef.current = true;
    videoRef.current = videoEl;
    setCameraError(null);

    const targetFacing = overrideFacingMode || facingMode;

    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints = {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      // Check Secure Context / MediaDevices availability
      if (!navigator?.mediaDevices?.getUserMedia) {
        const isLocalhost = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'
        );
        const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

        if (!isLocalhost && !isHttps) {
          throw new Error(
            'Kamera diblokir oleh browser HP karena koneksi HTTP tidak aman (Insecure Context). ' +
            `Silakan buka aplikasi via HTTPS: https://${window.location.hostname}:5173`
          );
        }
        throw new Error('API Kamera (navigator.mediaDevices.getUserMedia) tidak didukung pada browser ini.');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoEl.srcObject = stream;

      try {
        await videoEl.play();
      } catch (playErr) {
        console.warn('[useOpticalQr] Video play deferred:', playErr);
      }

      setCameraActive(true);
      setIsScanning(true);

      // Check native BarcodeDetector support
      const hasNativeDetector = 'BarcodeDetector' in window;
      let barcodeDetector = null;
      if (hasNativeDetector) {
        try {
          barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          barcodeDetector = null;
        }
      }

      const scanCanvas = canvasRef.current;
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

      // Live scan loop
      let lastScannedText = '';
      let sameTextCooldown = 0;

      const scanFrame = async () => {
        if (!videoEl || videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
          scanLoopRef.current = requestAnimationFrame(scanFrame);
          return;
        }

        try {
          let detectedText = null;

          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(videoEl);
              if (barcodes.length > 0) {
                detectedText = barcodes[0].rawValue;
              }
            } catch {
              // Fallback to jsQR if detector fails on a frame
            }
          }

          if (!detectedText && scanCtx) {
            scanCanvas.width = videoEl.videoWidth;
            scanCanvas.height = videoEl.videoHeight;
            scanCtx.drawImage(videoEl, 0, 0, scanCanvas.width, scanCanvas.height);
            const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              detectedText = code.data;
            }
          }

          if (detectedText) {
            // Prevent reprocessing same frame within 50ms
            if (detectedText !== lastScannedText || Date.now() - sameTextCooldown > 50) {
              lastScannedText = detectedText;
              sameTextCooldown = Date.now();

              const result = decoderRef.current.processPacket(detectedText);
              if (result.valid) {
                setReceiverProgress(result.progress);
                setReceiverStats({
                  solved: result.solved,
                  K: result.K,
                  scannedCount: result.scannedCount,
                  transferId: result.transferId,
                });
                setSolvedBlockSet(new Set(decoderRef.current.solvedBlocks.keys()));

                if (result.isComplete) {
                  setIsReceiveComplete(true);
                  setReceivedFile(result.reconstructedFile);
                  setReceivedMetadata(result.metadata);
                  stopScanning();
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.warn('[useOpticalQr] Frame decode error:', err);
        }

        scanLoopRef.current = requestAnimationFrame(scanFrame);
      };

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      console.error('[useOpticalQr] Camera access error:', err);
      setCameraError(err.message || 'Gagal mengakses kamera perangkat.');
      setCameraActive(false);
      setIsScanning(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [facingMode, stopScanning]);

  const switchCamera = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (videoRef.current) {
      stopScanning();
      setTimeout(() => {
        if (videoRef.current) {
          startScanning(videoRef.current, nextMode);
        }
      }, 150);
    }
  }, [facingMode, startScanning, stopScanning]);

  const resetReceiver = useCallback(() => {
    stopScanning();
    decoderRef.current.reset();
    setReceiverProgress(0);
    setReceiverStats({ solved: 0, K: 0, scannedCount: 0, transferId: null });
    setSolvedBlockSet(new Set());
    setReceivedFile(null);
    setReceivedMetadata(null);
    setIsReceiveComplete(false);
    setCameraError(null);
  }, [stopScanning]);

  const downloadReceivedFile = useCallback(() => {
    if (!receivedFile || !receivedMetadata) return;
    const url = URL.createObjectURL(receivedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = receivedMetadata.name || 'received_file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [receivedFile, receivedMetadata]);

  return {
    // Sender API
    senderFile,
    senderMetadata,
    senderFps,
    setSenderFps,
    senderBlockSize,
    setSenderBlockSize,
    isSending,
    isPlaying,
    currentDroplet,
    totalK,
    stageSenderFile,
    stageSenderText,
    toggleSenderPlay,
    stepDroplet,
    resetSender,

    // Receiver API
    isScanning,
    cameraActive,
    cameraError,
    facingMode,
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
  };
}

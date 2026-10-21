<p align="center">
  <img src="client/public/logo.png" alt="FlashMux Logo" width="96" height="96" />
</p>

<h1 align="center">FlashMux</h1>
<p align="center">
  <strong>Local Peer-to-Peer (P2P) File & Folder Transfer</strong><br />
  High-throughput, zero-cloud LAN streaming powered by Node.js WebSocket Signaling and 4x Parallel WebRTC DataChannels.
</p>

---

## Key Features

- **Zero Cloud Storage & 100% Local**: Direct peer-to-peer transmission via local Wi-Fi or Hotspot. No intermediate cloud servers, no bandwidth limits, and no active internet connection required.
- **Multi-File & Folder Transfer (No Zip Needed)**: Stage multiple photos, videos, or full directory structures. Preserves relative file paths and reconstructs directories on destination devices without requiring zip/tar archiving.
- **Multi-Device Broadcast**: Select single or multiple target devices on your LAN to stream files concurrently.
- **4x Parallel WebRTC DataChannels (IDM-Style Streaming)**: Files are partitioned into independent segment ranges with dynamic work-stealing across 4 parallel data channels, governed by strict backpressure control (`bufferedamountlow`).
- **Continuous Transfer Support**: Receivers can immediately accept new incoming transfer offers without needing to manually close or dismiss previous completed transfer screens.
- **Mobile-Optimized UX (Anti-UI-Slop)**: Automatically collapses the dispatch card when receiving files to focus on live progress telemetry, with a one-tap "Kirim File" toggle to unhide the file picker whenever needed.
- **Memory-Safe Streaming & Incremental Hash**: 64 KB chunking via `File.slice()`, streaming writes to disk via FileSystem Access API (desktop) or blob chunking (mobile), and per-chunk incremental MD5 verification compatible with HTTP local IP environments.

---

## Architecture & Data Flow

```
        ┌─────────────────────────────────────────────────────────┐
        │             Node.js Signaling Server (ws/Express)       │
        │              Port: 3000 (LAN Broadcast & Trickle ICE)   │
        └──────────────┬───────────────────────────┬──────────────┘
                       │                           │
          Signaling WS │ (JSON: REGISTER,          │ Signaling WS
                       │  PEER_LIST, FILE_OFFER)   │
                       ▼                           ▼
            ┌─────────────────────┐     ┌─────────────────────┐
            │   Sender Device     │     │   Receiver Device   │
            │   (React + Vite)    │     │   (React + Vite)    │
            └──────────┬──────────┘     └──────────▲──────────┘
                       │                           │
                       │   4x Parallel DataChannel │ (64 KB Chunks + 12-Byte Header)
                       │   (IDM Segment Streaming) │ (Incremental MD5 Hashing)
                       └───────────────────────────┘
```

1. **Discovery & Registration:** Devices open the web app via LAN (`http://<SERVER_IP>:5173`), connect to the WebSocket signaling server (`ws://<SERVER_IP>:3000`), and automatically register presence. The server broadcasts the live `PEER_LIST`.
2. **File & Folder Offer:** The sender selects target device(s) and stages files or folders. The recipient receives a confirmation dialog (`FILE_OFFER`) with full batch metadata.
3. **WebRTC Multi-Channel Handshake:** Upon acceptance, the sender opens 4 parallel `RTCDataChannel` connections (`transfer_channel_0` .. `3`) utilizing local host ICE candidates (no external STUN dependency).
4. **IDM-Style Parallel Chunk Streaming:** Files are partitioned into independent segment ranges across the 4 data channels with backpressure control (`bufferedamountlow` threshold at 256 KB, max buffer 1 MB). Channels operate independently with dynamic work-stealing.
5. **Disk Streaming & Fallback:** Desktops stream directly to disk using the FileSystem Access API (`showDirectoryPicker` or `showSaveFilePicker`). Mobile browsers (iOS/Android) use an in-memory reorder buffer with blob download fallback.
6. **Integrity Verification:** Both sender and receiver compute streaming MD5 checksums per chunk without requiring `crypto.subtle` (allowing full operation in non-HTTPS local IP environments).

---

## Directory Structure

```text
local-p2p-transfer/
├── package.json               # Root monorepo workspace scripts
├── .gitignore                 # Root Git ignore rules
├── README.md                  # Project documentation
├── master_plan_flashmux_apliaksi_file_transfer.md # Technical master plan
│
├── server/                    # Node.js WebSocket Signaling Server
│   ├── .env.example           # Environment template (PORT=3000, CORS_ORIGIN=*)
│   ├── package.json           # Dependencies (express, ws, cors, dotenv)
│   ├── test-signaling.js      # Automated signaling protocol test script
│   └── src/
│       ├── config/
│       │   └── env.js         # Port, CORS, and heartbeat configuration
│       ├── controllers/
│       │   ├── signalingController.js # REGISTER, FILE_OFFER, SIGNAL, CANCEL
│       │   └── healthController.js    # Health check and local network IP
│       ├── routes/
│       │   └── apiRoutes.js   # /api/health and /api/network-info endpoints
│       ├── services/
│       │   └── peerRegistry.js # In-memory active peer Map & broadcast
│       ├── utils/
│       │   └── networkUtils.js # LAN IPv4 auto-detection
│       ├── app.js             # Express + WebSocket HTTP server setup
│       └── index.js           # Server launcher
│
└── client/                    # React + Vite Frontend
    ├── .env.example           # Client environment template
    ├── package.json           # Dependencies (react, lucide-react, spark-md5)
    ├── vite.config.js         # Vite host & port configuration (5173)
    ├── index.html             # Application entry point (with /logo.png favicon)
    ├── public/
    │   ├── logo.png           # FlashMux official logo
    │   ├── favicon.svg        # Fallback vector icon
    │   └── manifest.json      # PWA manifest for mobile devices
    └── src/
        ├── components/
        │   ├── Header.jsx           # App header with logo, connection status & local peer ID
        │   ├── DeviceList.jsx       # Multi-peer selection grid with device type icons
        │   ├── DropZone.jsx         # Multi-file & folder staging with category summaries
        │   ├── TransferModal.jsx    # Incoming batch offer confirmation & folder picker
        │   └── TransferProgress.jsx # Multi-channel IDM telemetry, speed, ETA & elapsed time
        ├── hooks/
        │   ├── useSignaling.js      # Presence and peer discovery lifecycle
        │   └── useP2PTransfer.js    # WebRTC transfer state machine & multi-session support
        ├── services/
        │   ├── signalingClient.js   # WebSocket signaling client & reconnection
        │   ├── webrtcEngine.js      # 4x parallel DataChannel engine & IDM segment streaming
        │   ├── fileChunker.js       # File.slice() 64 KB memory-safe chunking
        │   └── fileWriter.js        # FileSystem Access API & mobile blob fallback
        ├── utils/
        │   ├── binaryPacket.js      # 12-byte little-endian header encoder/decoder
        │   ├── fileScanner.js       # Directory tree traversal & multi-file category scanner
        │   ├── hashCalculator.js    # Incremental MD5 streaming checksum
        │   └── formatters.js        # Byte sizes, transfer speed, ETA, and elapsed time
        ├── App.jsx                  # Main dashboard layout with mobile dispatch toggle
        ├── main.jsx                 # React root renderer
        └── index.css                # Anti-UI-Slop design system (calibrated neutrals)
```

---

## Prerequisites

- **Node.js**: v20.0.0 or v24.0.0+ LTS
- **npm**: v10.0.0 or higher

---

## Installation & Setup

### 1. Install Dependencies
Install dependencies across both backend and frontend from the monorepo root:
```bash
npm run install:all
```

Or individually:
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Environment Configuration
Copy `.env.example` in both directories:

**Server:**
```bash
cp server/.env.example server/.env
```
Default `server/.env`:
```env
PORT=3000
CORS_ORIGIN=*
```

**Client:**
```bash
cp client/.env.example client/.env
```
Default `client/.env`:
```env
VITE_SIGNALING_PORT=3000
VITE_DEFAULT_CHUNK_SIZE=65536
VITE_PARALLEL_CHANNELS=4
```

---

## Running the Application

### 1. Start Backend Signaling Server
```bash
npm run dev:server
```
The server will bind to `0.0.0.0:3000` and output the detected local network IPv4 address (e.g. `ws://192.168.1.50:3000`).

### 2. Start Frontend Web Client
In a separate terminal:
```bash
npm run dev:client
```
Vite will start at `http://<SERVER_IP>:5173`.

---

## Local Peer-to-Peer Testing Workflow

1. Open `http://localhost:5173` on your primary computer.
2. Open `http://<YOUR_LOCAL_IP>:5173` on a second device (smartphone, tablet, or another computer on the same Wi-Fi/Hotspot) or in a second private browser window.
3. Both devices will appear in each other's "Available Peers" panel with their detected device category (desktop/mobile).
4. Select one or more target devices from the peer list (supports multi-device broadcast).
5. Drag and drop or browse files/folders in the **File & Folder Dispatch** section, then click **"Send Batch"**.
6. The receiving device will display an incoming transfer prompt with file and folder counts.
7. Click **"Accept"**. On desktop Chrome/Edge, select your destination directory. On mobile, files stream and download directly.
8. The transfer streams across 4 parallel data channels with independent segment allocation (IDM-style), displaying live speed, total elapsed time, and per-channel segment progress.
9. When finished, the sender can immediately dispatch another batch to the receiver without requiring the receiver to close the completion modal.

---

## License

MIT License.
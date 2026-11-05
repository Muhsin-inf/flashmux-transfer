import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config/env.js';
import { getLocalIPv4 } from './utils/networkUtils.js';
import { signalingController } from './controllers/signalingController.js';
import apiRoutes from './routes/apiRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve production frontend from same origin.
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Root informational endpoint
app.get('/', (req, res) => {
  const localIp = getLocalIPv4();
  res.json({
    service: 'FlashMux Signaling Server',
    status: 'running',
    localIp,
    port: PORT,
    wsEndpoint: `ws://${localIp}:${PORT}`
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  signalingController.handleConnection(ws, req);
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIPv4();
  console.log(`[FlashMux Server] Signaling server listening on ws://${localIp}:${PORT}`);
  console.log(`[FlashMux Server] HTTP health endpoint at http://${localIp}:${PORT}/api/health`);
  console.log(`[FlashMux Server] Web Client should be accessed at http://${localIp}:5173`);
});

export { app, server, wss };

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

// Persistence directory
const DATA_DIR = path.resolve(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'realtime_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory state
interface RealtimeState {
  masterData: any[];
  activeDataset: {
    fileName: string;
    records: any[];
    sampleId?: string;
    costPerKg?: number;
    updatedAt: string;
    updatedBy?: string;
  } | null;
  uploadActivities: any[];
}

const defaultMasterData = [
  {
    id: 'master-1',
    skuCode: 'SKU-KPB-100',
    productName: 'Kopi Bubuk Spesial 100g',
    category: 'Minuman Bubuk',
    nominalWeight: 100,
    unit: 'g',
    tareWeight: 2.5,
    tolerableDeficiency: 4.5,
    t1Limit: 95.5,
    t2Limit: 91.0,
    notes: 'Kemasan sachet aluminium foil',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-2',
    skuCode: 'SKU-BCK-250',
    productName: 'Biskuit Cokelat Krispi 250g',
    category: 'Biskuit & Snack',
    nominalWeight: 250,
    unit: 'g',
    tareWeight: 8.2,
    tolerableDeficiency: 9.0,
    t1Limit: 241.0,
    t2Limit: 232.0,
    notes: 'Kemasan bantal pillow pack',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-3',
    skuCode: 'SKU-MGS-920',
    productName: 'Minyak Goreng Sawit 1000ml (920g)',
    category: 'Minyak & Lemak',
    nominalWeight: 920,
    unit: 'g',
    tareWeight: 14.5,
    tolerableDeficiency: 15.0,
    t1Limit: 905.0,
    t2Limit: 890.0,
    notes: 'Standar density 0.92 g/ml',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-4',
    skuCode: 'SKU-UHT-200',
    productName: 'Susu Cair UHT Cokelat 200ml',
    category: 'Dairy & Susu',
    nominalWeight: 206,
    unit: 'g',
    tareWeight: 11.8,
    tolerableDeficiency: 9.0,
    t1Limit: 197.0,
    t2Limit: 188.0,
    notes: 'Kemasan tetra pak 200ml',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-5',
    skuCode: 'SKU-TBT-500',
    productName: 'Tepung Terigu Serbaguna 500g',
    category: 'Tepung & Butiran',
    nominalWeight: 500,
    unit: 'g',
    tareWeight: 6.0,
    tolerableDeficiency: 15.0,
    t1Limit: 485.0,
    t2Limit: 470.0,
    notes: 'Kemasan pouch plastik standing',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-6',
    skuCode: 'SKU-GKP-1000',
    productName: 'Gula Pasir Kristal Putih 1kg',
    category: 'Gula & Pemanis',
    nominalWeight: 1000,
    unit: 'g',
    tareWeight: 12.0,
    tolerableDeficiency: 15.0,
    t1Limit: 985.0,
    t2Limit: 970.0,
    notes: 'Kemasan bantal plastik tebal',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-7',
    skuCode: 'SKU-MIG-085',
    productName: 'Mie Instan Goreng Rasa Ayam 85g',
    category: 'Mie & Pasta',
    nominalWeight: 85,
    unit: 'g',
    tareWeight: 3.8,
    tolerableDeficiency: 4.5,
    t1Limit: 80.5,
    t2Limit: 76.0,
    notes: 'Termasuk bumbu & minyak dalam kemasan',
    updatedAt: '2026-10-14',
  },
  {
    id: 'master-8',
    skuCode: 'SKU-SRT-060',
    productName: 'Sari Roti Tawar Gandum 60g',
    category: 'Roti & Bakery',
    nominalWeight: 60,
    unit: 'g',
    tareWeight: 3.0,
    tolerableDeficiency: 4.5,
    t1Limit: 55.5,
    t2Limit: 51.0,
    notes: 'Kemasan klip plastik',
    updatedAt: '2026-10-14',
  },
];

let state: RealtimeState = {
  masterData: defaultMasterData,
  activeDataset: null,
  uploadActivities: [],
};

// Load saved state from disk if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed) {
      if (Array.isArray(parsed.masterData) && parsed.masterData.length > 0) {
        state.masterData = parsed.masterData;
      }
      if (parsed.activeDataset) {
        state.activeDataset = parsed.activeDataset;
      }
      if (Array.isArray(parsed.uploadActivities)) {
        state.uploadActivities = parsed.uploadActivities;
      }
    }
  }
} catch (e) {
  console.warn('Could not read existing state file:', e);
}

const saveStateToDisk = () => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to persist state to disk:', e);
  }
};

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Broadcast message helper
const broadcast = (data: any, excludeWs?: WebSocket) => {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

const broadcastUserPresence = () => {
  broadcast({
    type: 'USER_PRESENCE',
    payload: { userCount: wss.clients.size },
  });
};

wss.on('connection', (ws: WebSocket) => {
  // Send initial full state to newly connected client
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      payload: {
        masterData: state.masterData,
        activeDataset: state.activeDataset,
        uploadActivities: state.uploadActivities,
        userCount: wss.clients.size,
      },
    })
  );

  // Notify everyone of updated connected user count
  broadcastUserPresence();

  ws.on('message', (messageRaw: string) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      const nowIso = new Date().toISOString();

      switch (data.type) {
        case 'UPDATE_MASTER_DATA': {
          const { items, updatedBy } = data.payload || {};
          if (Array.isArray(items)) {
            state.masterData = items;
            saveStateToDisk();
            broadcast({
              type: 'MASTER_DATA_UPDATED',
              payload: {
                items,
                updatedBy: updatedBy || 'Pengguna Lain',
                timestamp: nowIso,
              },
            });
          }
          break;
        }

        case 'UPDATE_ACTIVE_DATASET': {
          const { fileName, records, costPerKg, sampleId, updatedBy } = data.payload || {};
          if (Array.isArray(records)) {
            state.activeDataset = {
              fileName: fileName || 'Upload_Realtime.xlsx',
              records,
              sampleId: sampleId || 'custom',
              costPerKg: costPerKg ?? 25000,
              updatedAt: nowIso,
              updatedBy: updatedBy || 'Pengguna Lain',
            };
            saveStateToDisk();
            broadcast({
              type: 'ACTIVE_DATASET_UPDATED',
              payload: {
                ...state.activeDataset,
                timestamp: nowIso,
              },
            });
          }
          break;
        }

        case 'ADD_UPLOAD_ACTIVITY': {
          const { activity, updatedBy } = data.payload || {};
          if (activity && activity.id) {
            state.uploadActivities = [
              activity,
              ...state.uploadActivities.filter((a) => a.id !== activity.id),
            ].slice(0, 30);
            saveStateToDisk();
            broadcast({
              type: 'UPLOAD_ACTIVITY_ADDED',
              payload: {
                activity,
                updatedBy: updatedBy || 'Pengguna Lain',
                timestamp: nowIso,
              },
            });
          }
          break;
        }

        case 'CLEAR_ACTIVE_DATASET': {
          state.activeDataset = null;
          saveStateToDisk();
          broadcast({
            type: 'ACTIVE_DATASET_CLEARED',
            payload: {
              updatedBy: data.payload?.updatedBy || 'Pengguna Lain',
              timestamp: nowIso,
            },
          });
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: nowIso }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    broadcastUserPresence();
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// REST API Endpoints for initial fetch or HTTP fallbacks
app.get('/api/realtime/state', (_req, res) => {
  res.json({
    masterData: state.masterData,
    activeDataset: state.activeDataset,
    uploadActivities: state.uploadActivities,
    userCount: wss.clients.size,
  });
});

app.post('/api/realtime/master-data', (req, res) => {
  const { items, updatedBy } = req.body;
  if (Array.isArray(items)) {
    state.masterData = items;
    saveStateToDisk();
    broadcast({
      type: 'MASTER_DATA_UPDATED',
      payload: {
        items,
        updatedBy: updatedBy || 'API User',
        timestamp: new Date().toISOString(),
      },
    });
    res.json({ success: true, count: items.length });
  } else {
    res.status(400).json({ error: 'items must be an array' });
  }
});

app.post('/api/realtime/active-dataset', (req, res) => {
  const { fileName, records, costPerKg, sampleId, updatedBy } = req.body;
  if (Array.isArray(records)) {
    state.activeDataset = {
      fileName: fileName || 'Upload_Realtime.xlsx',
      records,
      sampleId: sampleId || 'custom',
      costPerKg: costPerKg ?? 25000,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'API User',
    };
    saveStateToDisk();
    broadcast({
      type: 'ACTIVE_DATASET_UPDATED',
      payload: {
        ...state.activeDataset,
        timestamp: new Date().toISOString(),
      },
    });
    res.json({ success: true, count: records.length });
  } else {
    res.status(400).json({ error: 'records must be an array' });
  }
});

app.post('/api/realtime/upload-activity', (req, res) => {
  const { activity, updatedBy } = req.body;
  if (activity && activity.id) {
    state.uploadActivities = [
      activity,
      ...state.uploadActivities.filter((a) => a.id !== activity.id),
    ].slice(0, 30);
    saveStateToDisk();
    broadcast({
      type: 'UPLOAD_ACTIVITY_ADDED',
      payload: {
        activity,
        updatedBy: updatedBy || 'API User',
        timestamp: new Date().toISOString(),
      },
    });
    res.json({ success: true, id: activity.id });
  } else {
    res.status(400).json({ error: 'invalid activity' });
  }
});

// Vite middleware in development or static serve in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} with Real-Time WebSocket on /ws`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

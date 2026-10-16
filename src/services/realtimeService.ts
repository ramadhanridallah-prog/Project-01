import { SkuMasterItem } from '../types/masterData';
import { BdktRecord } from '../types/bdkt';
import { SavedUploadActivity } from './autoSaveService';

export type RealtimeConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

export interface RealtimeCallbacks {
  onMasterDataUpdated?: (items: SkuMasterItem[], updatedBy: string, timestamp: string) => void;
  onActiveDatasetUpdated?: (payload: {
    fileName: string;
    records: BdktRecord[];
    costPerKg?: number;
    sampleId?: string;
    updatedBy?: string;
    timestamp: string;
  }) => void;
  onUploadActivityAdded?: (activity: SavedUploadActivity, updatedBy: string, timestamp: string) => void;
  onActiveDatasetCleared?: (updatedBy: string) => void;
  onUserPresenceChange?: (userCount: number) => void;
  onConnectionStatusChange?: (status: RealtimeConnectionStatus) => void;
  onInitState?: (payload: {
    masterData?: SkuMasterItem[];
    activeDataset?: any;
    uploadActivities?: SavedUploadActivity[];
    userCount?: number;
  }) => void;
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private callbacks: RealtimeCallbacks = {};
  private status: RealtimeConnectionStatus = 'DISCONNECTED';
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private userCount: number = 1;
  private isDestroyed: boolean = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.channel = new BroadcastChannel('bdkt_realtime_local_sync');
        this.channel.onmessage = (event) => {
          this.handleIncomingMessage(event.data, 'local');
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported in this context:', e);
    }
  }

  public init(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
    this.isDestroyed = false;
    this.connect();
    // Also fetch initial state via REST as instant hydration fallback
    this.fetchInitialStateViaRest();
  }

  public getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  public getUserCount(): number {
    return Math.max(1, this.userCount);
  }

  private setStatus(newStatus: RealtimeConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.callbacks.onConnectionStatusChange?.(newStatus);
    }
  }

  private connect() {
    if (typeof window === 'undefined' || this.isDestroyed) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/ws`;

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.setStatus('CONNECTED');
        this.startPing();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data, 'remote');
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        this.stopPing();
        this.setStatus('DISCONNECTED');
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      };

      socket.onerror = (err) => {
        console.warn('Real-time WebSocket warning:', err);
        // Socket will trigger onclose and attempt reconnect
      };
    } catch (err) {
      console.error('Error initiating WebSocket connection:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3500);
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
  }

  private handleIncomingMessage(data: any, source: 'remote' | 'local') {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'INIT_STATE': {
        const payload = data.payload || {};
        if (payload.userCount !== undefined) {
          this.userCount = payload.userCount;
          this.callbacks.onUserPresenceChange?.(payload.userCount);
        }
        this.callbacks.onInitState?.(payload);
        break;
      }

      case 'USER_PRESENCE': {
        const count = data.payload?.userCount ?? 1;
        this.userCount = count;
        this.callbacks.onUserPresenceChange?.(count);
        break;
      }

      case 'MASTER_DATA_UPDATED': {
        const { items, updatedBy, timestamp } = data.payload || {};
        if (Array.isArray(items)) {
          this.callbacks.onMasterDataUpdated?.(items, updatedBy || 'Pengguna Lain', timestamp);
        }
        break;
      }

      case 'ACTIVE_DATASET_UPDATED': {
        const payload = data.payload || {};
        if (Array.isArray(payload.records)) {
          this.callbacks.onActiveDatasetUpdated?.(payload);
        }
        break;
      }

      case 'UPLOAD_ACTIVITY_ADDED': {
        const { activity, updatedBy, timestamp } = data.payload || {};
        if (activity) {
          this.callbacks.onUploadActivityAdded?.(activity, updatedBy || 'Pengguna Lain', timestamp);
        }
        break;
      }

      case 'ACTIVE_DATASET_CLEARED': {
        const { updatedBy } = data.payload || {};
        this.callbacks.onActiveDatasetCleared?.(updatedBy || 'Pengguna Lain');
        break;
      }

      case 'PONG':
        // Heartbeat confirmed
        break;

      default:
        break;
    }
  }

  private async fetchInitialStateViaRest() {
    try {
      const res = await fetch('/api/realtime/state');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          this.callbacks.onInitState?.(data);
          if (data.userCount !== undefined) {
            this.userCount = data.userCount;
            this.callbacks.onUserPresenceChange?.(data.userCount);
          }
        }
      }
    } catch {
      // Ignored if offline or server is building
    }
  }

  // --- Broadcast Methods ---

  public broadcastMasterDataUpdate(items: SkuMasterItem[], updatedBy?: string) {
    const payload = { items, updatedBy };
    const msg = { type: 'UPDATE_MASTER_DATA', payload };

    // 1. Send via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Fallback via HTTP REST
      fetch('/api/realtime/master-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn('HTTP master-data update fallback error:', e));
    }

    // 2. Broadcast locally across browser tabs
    try {
      this.channel?.postMessage({
        type: 'MASTER_DATA_UPDATED',
        payload: {
          items,
          updatedBy: updatedBy || 'Tab Lain',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}
  }

  public broadcastActiveDatasetUpdate(
    fileName: string,
    records: BdktRecord[],
    costPerKg: number = 25000,
    sampleId: string = 'custom',
    updatedBy?: string
  ) {
    const payload = { fileName, records, costPerKg, sampleId, updatedBy };
    const msg = { type: 'UPDATE_ACTIVE_DATASET', payload };

    // 1. Send via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Fallback via HTTP REST
      fetch('/api/realtime/active-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn('HTTP active-dataset update fallback error:', e));
    }

    // 2. Broadcast locally across browser tabs
    try {
      this.channel?.postMessage({
        type: 'ACTIVE_DATASET_UPDATED',
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}
  }

  public broadcastUploadActivity(activity: SavedUploadActivity, updatedBy?: string) {
    const payload = { activity, updatedBy };
    const msg = { type: 'ADD_UPLOAD_ACTIVITY', payload };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      fetch('/api/realtime/upload-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn('HTTP upload-activity fallback error:', e));
    }

    try {
      this.channel?.postMessage({
        type: 'UPLOAD_ACTIVITY_ADDED',
        payload: {
          activity,
          updatedBy: updatedBy || 'Tab Lain',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}
  }

  public broadcastClearActiveDataset(updatedBy?: string) {
    const msg = { type: 'CLEAR_ACTIVE_DATASET', payload: { updatedBy } };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }

    try {
      this.channel?.postMessage({
        type: 'ACTIVE_DATASET_CLEARED',
        payload: {
          updatedBy: updatedBy || 'Tab Lain',
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();

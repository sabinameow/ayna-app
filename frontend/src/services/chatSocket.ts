export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "offline";

type MessageListener = (msg: unknown) => void;
type StatusListener = (s: ConnectionStatus) => void;

const BACKOFFS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000, 60000];
const HEARTBEAT_MS = 25_000;
const STALE_TRAFFIC_MS = 60_000;

export class ChatSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "idle";
  private statusListeners = new Set<StatusListener>();
  private messageListeners = new Set<MessageListener>();
  private outbox: string[] = [];
  private retryIdx = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    if (this.destroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.setStatus(this.retryIdx === 0 ? "connecting" : "reconnecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retryIdx = 0;
      this.setStatus("open");
      this.startHeartbeat();
      this.bumpStaleWatchdog();
      while (this.outbox.length && ws.readyState === WebSocket.OPEN) {
        ws.send(this.outbox.shift()!);
      }
    };

    ws.onmessage = (event) => {
      this.bumpStaleWatchdog();
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "pong") return;
      this.messageListeners.forEach((l) => l(parsed));
    };

    ws.onerror = () => {
      // onclose will follow and drive the reconnect flow
    };

    ws.onclose = (event) => {
      this.stopHeartbeat();
      this.clearStaleWatchdog();
      this.ws = null;
      if (this.destroyed) return;
      // 1000 = normal, 4xxx = explicit auth/permission/not-found from server. Don't retry those.
      const code = event.code;
      if (code === 1000 || (code >= 4000 && code < 5000)) {
        this.setStatus("offline");
        return;
      }
      this.scheduleReconnect();
    };
  }

  send(payload: object) {
    const data = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return;
    }
    this.outbox.push(data);
    this.connect();
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  close() {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopHeartbeat();
    this.clearStaleWatchdog();
    try {
      this.ws?.close(1000, "client_close");
    } catch {
      // ignore
    }
    this.ws = null;
    this.setStatus("offline");
  }

  private scheduleReconnect() {
    if (this.retryIdx >= BACKOFFS_MS.length) {
      this.setStatus("offline");
      return;
    }
    const delay = BACKOFFS_MS[this.retryIdx++];
    this.setStatus("reconnecting");
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          // ignore — onclose will fire if the socket really died
        }
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private bumpStaleWatchdog() {
    this.clearStaleWatchdog();
    this.staleTimer = setTimeout(() => {
      // No traffic in window — force a reconnect cycle
      try {
        this.ws?.close();
      } catch {
        // ignore
      }
    }, STALE_TRAFFIC_MS);
  }

  private clearStaleWatchdog() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = null;
  }

  private setStatus(next: ConnectionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }
}
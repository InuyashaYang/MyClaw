import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { RawData, WebSocket } from "ws";
import { BaseProvider } from "./BaseProvider.js";
import type { InboundMessage, OutboundEvent } from "../types.js";

export interface WebchatProviderConfig {
  port: number;
  inbound: (message: InboundMessage, send: (event: OutboundEvent) => void) => Promise<void>;
}

interface ClientPayload {
  type: "user";
  sessionId: string;
  text: string;
}

export class WebchatProvider extends BaseProvider {
  private readonly app: FastifyInstance;

  constructor(private readonly config: WebchatProviderConfig) {
    super();
    this.app = Fastify({ logger: true });
  }

  async start(): Promise<void> {
    await this.app.register(websocket);

    this.app.get("/", async (_request, reply) => {
      reply.type("text/html").send(this.renderHtml());
    });

    this.app.get("/ws", { websocket: true }, (socket) => {
      socket.on("message", (raw: import("ws").RawData) => {
        void this.handleMessage(socket, raw);
      });
    });

    await this.app.listen({ port: this.config.port, host: "0.0.0.0" });
    this.app.log.info(`Webchat listening on http://localhost:${this.config.port}`);
  }

  async stop(): Promise<void> {
    await this.app.close();
  }

  private async handleMessage(socket: WebSocket, raw: RawData): Promise<void> {
    try {
      const payload = JSON.parse(raw.toString()) as ClientPayload;
      if (payload.type !== "user" || !payload.sessionId || !payload.text?.trim()) {
        this.send(socket, {
          type: "error",
          sessionId: payload?.sessionId ?? "unknown",
          error: "Invalid payload",
        });
        return;
      }

      const message: InboundMessage = {
        sessionId: payload.sessionId,
        text: payload.text.trim(),
      };

      await this.config.inbound(message, (event) => this.send(socket, event));
    } catch (error) {
      this.send(socket, {
        type: "error",
        sessionId: "unknown",
        error: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  }

  private send(socket: WebSocket, event: OutboundEvent): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  private renderHtml(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MyClaw Webchat</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0f16;
      --panel: #121826;
      --muted: #8a97b1;
      --text: #e5e9f0;
      --accent: #6ea8fe;
      --user: #1f6feb;
      --assistant: #2a3448;
      --error: #ff6b6b;
      --border: #243049;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(circle at top, #121a2a, var(--bg));
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .chat {
      width: 100%;
      max-width: 820px;
      height: min(88vh, 900px);
      background: color-mix(in oklab, var(--panel), black 8%);
      border: 1px solid var(--border);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
    }
    .header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title { font-size: 15px; font-weight: 600; }
    .status { font-size: 12px; color: var(--muted); }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .msg {
      max-width: 82%;
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .msg.user {
      align-self: flex-end;
      background: var(--user);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: var(--assistant);
      border-bottom-left-radius: 4px;
    }
    .msg.error {
      align-self: center;
      background: color-mix(in oklab, var(--error), black 75%);
      border: 1px solid color-mix(in oklab, var(--error), black 55%);
      color: #ffdede;
    }
    .composer {
      border-top: 1px solid var(--border);
      padding: 12px;
      display: flex;
      gap: 10px;
      background: rgba(8, 12, 20, 0.6);
    }
    input {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #0f1523;
      color: var(--text);
      padding: 10px 12px;
      font-size: 14px;
      outline: none;
    }
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(110, 168, 254, 0.15);
    }
    button {
      border: 0;
      border-radius: 10px;
      background: var(--accent);
      color: #051428;
      font-weight: 600;
      padding: 0 16px;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="chat">
    <div class="header">
      <div class="title">MyClaw Webchat</div>
      <div id="status" class="status">Connecting...</div>
    </div>
    <div id="messages" class="messages"></div>
    <div class="composer">
      <input id="input" placeholder="Type a message..." autocomplete="off" />
      <button id="send">Send</button>
    </div>
  </div>

  <script>
    const statusEl = document.getElementById('status');
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');

    const sessionIdKey = 'myclaw_session_id';
    const sessionId = localStorage.getItem(sessionIdKey) || crypto.randomUUID();
    localStorage.setItem(sessionIdKey, sessionId);

    let ws;
    let currentAssistantEl = null;

    function appendMessage(text, type) {
      const el = document.createElement('div');
      el.className = 'msg ' + type;
      el.textContent = text;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function setEnabled(enabled) {
      sendBtn.disabled = !enabled;
      inputEl.disabled = !enabled;
    }

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(protocol + "://" + location.host + "/ws");

      ws.addEventListener('open', () => {
        setStatus('Connected');
        setEnabled(true);
      });

      ws.addEventListener('close', () => {
        setStatus('Disconnected, retrying...');
        setEnabled(false);
        setTimeout(connect, 1000);
      });

      ws.addEventListener('message', (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === 'ack') {
          currentAssistantEl = appendMessage('', 'assistant');
          return;
        }
        if (data.type === 'delta') {
          if (!currentAssistantEl) {
            currentAssistantEl = appendMessage('', 'assistant');
          }
          currentAssistantEl.textContent += data.text || '';
          messagesEl.scrollTop = messagesEl.scrollHeight;
          return;
        }
        if (data.type === 'done') {
          currentAssistantEl = null;
          return;
        }
        if (data.type === 'error') {
          appendMessage(data.error || 'Unexpected error', 'error');
          currentAssistantEl = null;
        }
      });
    }

    function send() {
      const text = inputEl.value.trim();
      if (!text || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      appendMessage(text, 'user');
      ws.send(JSON.stringify({ type: 'user', sessionId, text }));
      inputEl.value = '';
      inputEl.focus();
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') send();
    });

    setEnabled(false);
    connect();
  </script>
</body>
</html>`;
  }
}

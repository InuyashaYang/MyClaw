import { LLMRouter } from "../llm/LLMRouter.js";
import { WebchatProvider } from "../providers/WebchatProvider.js";
import { SessionManager } from "../session/SessionManager.js";
import type { InboundMessage, OutboundEvent } from "../types.js";

export interface GatewayConfig {
  webchatPort: number;
  llm: {
    baseURL: string;
    apiKey: string;
    model: string;
  };
}

export class Gateway {
  private readonly sessionManager = new SessionManager();
  private readonly llmRouter: LLMRouter;
  private readonly webchatProvider: WebchatProvider;

  constructor(private readonly config: GatewayConfig) {
    this.llmRouter = new LLMRouter(config.llm);
    this.webchatProvider = new WebchatProvider({
      port: config.webchatPort,
      inbound: (message, send) => this.handleInbound(message, send),
    });
  }

  async start(): Promise<void> {
    await this.webchatProvider.start();
  }

  async stop(): Promise<void> {
    await this.webchatProvider.stop();
  }

  private async handleInbound(message: InboundMessage, send: (event: OutboundEvent) => void): Promise<void> {
    this.sessionManager.appendMessage(message.sessionId, {
      role: "user",
      content: message.text,
    });

    send({ type: "ack", sessionId: message.sessionId });

    const session = this.sessionManager.getOrCreate(message.sessionId);
    let assistantReply = "";

    try {
      assistantReply = await this.llmRouter.chat(session.messages, (delta) => {
        send({
          type: "delta",
          sessionId: message.sessionId,
          text: delta,
        });
      });

      this.sessionManager.appendMessage(message.sessionId, {
        role: "assistant",
        content: assistantReply,
      });

      send({
        type: "done",
        sessionId: message.sessionId,
      });
    } catch (error) {
      send({
        type: "error",
        sessionId: message.sessionId,
        error: error instanceof Error ? error.message : "LLM request failed",
      });
    }
  }
}

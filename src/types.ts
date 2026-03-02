export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Session {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InboundMessage {
  sessionId: string;
  text: string;
}

export interface OutboundEvent {
  type: "ack" | "delta" | "done" | "error";
  sessionId: string;
  text?: string;
  error?: string;
}

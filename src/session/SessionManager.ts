import type { ChatMessage, Session } from "../types.js";

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  getOrCreate(sessionId: string): Session {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.updatedAt = new Date();
      return existing;
    }

    const created: Session = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, created);
    return created;
  }

  appendMessage(sessionId: string, message: ChatMessage): Session {
    const session = this.getOrCreate(sessionId);
    session.messages.push(message);
    session.updatedAt = new Date();
    return session;
  }
}

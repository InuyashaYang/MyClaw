import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { ChatMessage } from "../types.js";

export interface LLMRouterConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class LLMRouter {
  private readonly model;

  constructor(config: LLMRouterConfig) {
    const provider = createOpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });

    this.model = provider(config.model);
  }

  async chat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<string> {
    const result = streamText({
      model: this.model,
      messages,
    });

    let fullText = "";
    for await (const delta of result.textStream) {
      fullText += delta;
      onDelta(delta);
    }

    return fullText;
  }
}

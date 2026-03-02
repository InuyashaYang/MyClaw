#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { Gateway } from "./gateway/Gateway.js";

const program = new Command();

program
  .name("myclaw")
  .description("MyClaw local AI gateway daemon")
  .version("0.1.0");

program
  .command("start")
  .description("Start MyClaw gateway")
  .option("-p, --port <port>", "Webchat port", process.env.WEBCHAT_PORT ?? "7380")
  .action(async (options: { port: string }) => {
    const gateway = new Gateway({
      webchatPort: Number(options.port),
      llm: {
        baseURL: process.env.LLM_BASE_URL ?? "http://152.53.52.170:3003/v1",
        model: process.env.LLM_MODEL ?? "claude-sonnet-4-5",
        apiKey: process.env.OPENAI_API_KEY ?? "local-no-key",
      },
    });

    await gateway.start();

    const shutdown = async () => {
      await gateway.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown startup error");
  process.exit(1);
});

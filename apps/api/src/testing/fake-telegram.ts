// Фейковий Telegram Bot API для інтеграційних тестів: жодних запитів до api.telegram.org.
import { createServer, type Server } from "node:http";

export interface SentMessage {
  token: string;
  method: string;
  body: { chat_id: string | number; text: string; reply_markup?: unknown };
}

export interface FakeTelegram {
  baseUrl: string;
  messages: SentMessage[];
  /** Відповідь для конкретного chat_id: напр. 403 «бот заблоковано». */
  failFor: Map<string, { status: number; description: string }>;
  close: () => Promise<void>;
}

export async function startFakeTelegram(): Promise<FakeTelegram> {
  const messages: SentMessage[] = [];
  const failFor = new Map<string, { status: number; description: string }>();

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const match = /^\/bot([^/]+)\/(\w+)$/.exec(req.url ?? "");
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as SentMessage["body"];
      res.setHeader("Content-Type", "application/json");
      const failure = failFor.get(String(body.chat_id));
      if (!match || failure) {
        res.statusCode = failure?.status ?? 404;
        res.end(
          JSON.stringify({
            ok: false,
            error_code: res.statusCode,
            description: failure?.description ?? "Not Found",
          }),
        );
        return;
      }
      messages.push({ token: match[1]!, method: match[2]!, body });
      res.end(JSON.stringify({ ok: true, result: { message_id: messages.length } }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    messages,
    failFor,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

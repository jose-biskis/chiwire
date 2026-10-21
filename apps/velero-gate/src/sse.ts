import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";

export type SseHandlers = {
  onOpen: () => void;
  onEvent: (event: string, data: string) => void;
  onClose: () => void;
  onError: (error: Error) => void;
};

export type SseClient = {
  close: () => void;
};

export function openSse(url: string, handlers: SseHandlers): SseClient {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? https : http;
  let closed = false;
  let response: IncomingMessage | null = null;
  const request = lib.get(
    target,
    {
      headers: {
        accept: "text/event-stream",
        "cache-control": "no-cache"
      }
    },
    (res) => {
      if (closed) {
        res.destroy();
        return;
      }
      response = res;
      if ((res.statusCode ?? 0) >= 400) {
        handlers.onError(new Error(`Harbor stream HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      handlers.onOpen();
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const block of parts) {
          let event = "message";
          const data: string[] = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              data.push(line.slice(5).trimStart());
            }
          }
          if (data.length > 0) {
            handlers.onEvent(event, data.join("\n"));
          }
        }
      });
      res.on("end", () => {
        if (!closed) {
          handlers.onClose();
        }
      });
      res.on("error", (error) => {
        if (!closed) {
          handlers.onError(error);
        }
      });
    }
  );
  request.on("error", (error) => {
    if (!closed) {
      handlers.onError(error);
    }
  });

  return {
    close: () => {
      closed = true;
      request.destroy();
      response?.destroy();
    }
  };
}

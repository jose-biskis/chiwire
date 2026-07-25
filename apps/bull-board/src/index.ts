import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  BULLMQ_PREFIX,
  SCHEDULER_DRIVEN_QUEUE_NAMES,
  createQueue,
  getBullMQConnectionOptions,
  listQueueNames
} from "@chiwire/core/bullmq";
import express, {
  type NextFunction,
  type Request,
  type Response
} from "express";
import process from "node:process";

const DEFAULT_PORT = 3000;
const BASE_PATH = "/bullboard";

function readPort(): number {
  const configuredPort = process.env.PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(configuredPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }

  return port;
}

function basicAuth(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const password = process.env.BULL_BOARD_PASSWORD?.trim();
  if (!password) {
    next();
    return;
  }

  const user = process.env.BULL_BOARD_USER?.trim() || "admin";
  const header = request.headers.authorization;
  if (!header?.startsWith("Basic ")) {
    response.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    response.status(401).send("Authentication required");
    return;
  }

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
    "utf8"
  );
  const separator = decoded.indexOf(":");
  const providedUser = separator === -1 ? decoded : decoded.slice(0, separator);
  const providedPassword = separator === -1 ? "" : decoded.slice(separator + 1);

  if (providedUser !== user || providedPassword !== password) {
    response.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    response.status(401).send("Invalid credentials");
    return;
  }

  next();
}

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BASE_PATH);

const queues = listQueueNames().map((name) => {
  const queue = createQueue(name, {
    connection: getBullMQConnectionOptions(),
    prefix: BULLMQ_PREFIX
  });
  return new BullMQAdapter(queue, {
    allowRetries: !SCHEDULER_DRIVEN_QUEUE_NAMES.has(name)
  });
});

createBullBoard({
  queues,
  serverAdapter
});

const app = express();
const port = readPort();

app.get("/health", (_request, response) => {
  response.json({ ok: true, queues: listQueueNames() });
});

app.get("/", (_request, response) => {
  response.redirect(BASE_PATH);
});

app.use(BASE_PATH, basicAuth, serverAdapter.getRouter());

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`bull-board listening on port ${port}`);
  console.log(`UI: http://127.0.0.1:${port}${BASE_PATH}`);
  console.log(`queues: ${listQueueNames().join(", ")}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}; closing server`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

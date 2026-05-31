const http = require("http");
const config = require("../shared/config");
const logger = require("../shared/logger");
const metrics = require("../shared/metrics");
const { createCircuitBreaker } = require("../core-service/circuitBreaker");
const { createConsumer, createProducer, publish } = require("../shared/kafka");
const { getIdempotencyKey, saveIdempotencyKey, upsertEvent, addDeadLetter } = require("../shared/storage");
const facebook = require("./facebookGraphClient");

const breaker = createCircuitBreaker("facebook-graph-api");

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function assertAdmin(req) {
  const token = req.headers["x-admin-token"];
  if (token !== config.adminToken) {
    const error = new Error("admin_token_required");
    error.status = 401;
    addDeadLetter({
      schemaVersion: "dead_letter.v1",
      reason: "non_retryable_facebook_error",
      command,
      error: error.message,
      facebook: error.facebook,
      movedAt: new Date().toISOString()
    });
    saveIdempotencyKey(command.commandId, "failed_non_retryable");
    logger.error("non-retryable facebook command failed", {
      commandId: command.commandId,
      status: normalized.status,
      error: error.message,
      facebook: error.facebook
    });
  }
}

function normalizeError(error) {
  const status = error.status || 500;
  const retryable = status >= 500 || status === 408 || status === 429 || error.message === "facebook_circuit_open";
  return {
    status,
    retryable,
    body: {
      ok: false,
      error: {
        code: status === 401 ? "unauthorized" : "facebook_api_error",
        message: error.message,
        retryable,
        facebook: error.facebook
      }
    }
  };
}

async function callFacebook(operation) {
  if (!breaker.canCall()) {
    const error = new Error("facebook_circuit_open");
    error.status = 503;
    throw error;
  }

  try {
    const result = await operation();
    breaker.success();
    return result;
  } catch (error) {
    if ((error.status || 500) >= 500 || error.status === 429) {
      breaker.failure();
    }
    throw error;
  }
}

function commandMessage(command) {
  if (command.action === "auto_reply") {
    if (command.template === "support_follow_up") {
      return "Rat xin loi vi trai nghiem chua tot, ben minh se kiem tra va ho tro ban ngay.";
    }
    if (command.template === "ask_inbox_or_price") {
      return "Cam on ban da quan tam. Ban nhan tin cho page de duoc bao gia chi tiet nhe.";
    }
    return "Cam on ban da tuong tac voi page.";
  }
  return "";
}

async function executeCommand(producer, command) {
  if (getIdempotencyKey(command.commandId)) {
    logger.info("skip duplicate command", { commandId: command.commandId });
    return;
  }

  try {
    if (command.action === "auto_reply") {
      await callFacebook(() => facebook.replyComment(command.targetId, commandMessage(command)));
      upsertEvent(command.eventId, { status: "replied", reason: command.template });
    } else if (command.action === "hide_comment") {
      await callFacebook(() => facebook.hideComment(command.targetId));
      upsertEvent(command.eventId, { status: "processed", reason: command.reason || "hidden" });
    } else if (command.action === "manual_review") {
      upsertEvent(command.eventId, { status: "pending_review", reason: command.reason || "manual_review" });
    }

    saveIdempotencyKey(command.commandId);
  } catch (error) {
    const normalized = normalizeError(error);
    upsertEvent(command.eventId, { status: "failed", reason: error.message });
    if (normalized.retryable) {
      await publish(
        producer,
        config.kafka.topics.sendFailed,
        {
          schemaVersion: "retry.v1",
          originalTopic: config.kafka.topics.replyCommands,
          attempts: Number(command.attempts || 0),
          event: command,
          error: error.message,
          failedAt: new Date().toISOString()
        },
        command.idempotencyKey
      );
      return;
    }
    throw error;
  }
}

async function routeHttp(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, breaker: breaker.snapshot() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
    res.end(metrics.renderPrometheus());
    return;
  }

  if (req.method === "GET" && url.pathname === "/posts") {
    assertAdmin(req);
    const data = await callFacebook(() => facebook.listPosts(url.searchParams.get("limit") || 25));
    send(res, 200, { ok: true, data });
    return;
  }

  if (req.method === "POST" && url.pathname === "/post") {
    assertAdmin(req);
    const body = await readJson(req);
    if (!body.message) {
      send(res, 400, { ok: false, error: { code: "validation_error", message: "message is required" } });
      return;
    }
    const data = await callFacebook(() => facebook.createPost(body.message));
    send(res, 201, { ok: true, data });
    return;
  }

  if (req.method === "GET" && url.pathname === "/comments") {
    assertAdmin(req);
    const postId = url.searchParams.get("postId");
    if (!postId) {
      send(res, 400, { ok: false, error: { code: "validation_error", message: "postId is required" } });
      return;
    }
    const data = await callFacebook(() => facebook.listComments(postId, url.searchParams.get("limit") || 25));
    send(res, 200, { ok: true, data });
    return;
  }

  send(res, 404, { ok: false, error: { code: "not_found", message: "Route not found" } });
}

async function main() {
  const producer = await createProducer();

  http
    .createServer(async (req, res) => {
      try {
        await routeHttp(req, res);
      } catch (error) {
        const normalized = normalizeError(error);
        logger.error("backend-api request failed", { error: error.message, status: normalized.status });
        send(res, normalized.status, normalized.body);
      }
    })
    .listen(config.backendPort, () => {
      logger.info("backend-api listening", { port: config.backendPort });
    });

  await createConsumer(
    "backend-api",
    [config.kafka.topics.replyCommands, config.kafka.topics.sendRetry],
    async (message) => {
      const command = message.event || message;
      await executeCommand(producer, { ...command, attempts: Number(message.attempts || command.attempts || 0) });
    }
  );
}

main().catch((error) => {
  logger.error("backend-api failed to start", { error: error.message });
  process.exit(1);
});

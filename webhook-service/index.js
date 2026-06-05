const http = require("http");
const config = require("../shared/config");
const logger = require("../shared/logger");
const { createProducer, publish } = require("../shared/kafka");
const { upsertEvent } = require("../shared/storage");
const metrics = require("../shared/metrics");
const { normalizeFacebookPayload } = require("./normalizer");
const { verifyFacebookSignature } = require("./signature");
const { getOpenApiSpec, renderSwaggerHtml } = require("./openapi");

let producer;

async function getProducer() {
  if (!producer) {
    producer = await createProducer();
  }
  return producer;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": typeof body === "string" ? "text/plain" : "application/json",
    ...headers
  });
  res.end(payload);
}

function handleVerify(req, res, url) {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === config.facebookVerifyToken) {
    logger.info("facebook webhook verified");
    send(res, 200, challenge || "");
    return;
  }

  metrics.inc("webhook_rejected_total");
  send(res, 403, "Forbidden");
}

async function handleWebhookPost(req, res) {
  const rawBody = await readBody(req);
  const signature = req.headers["x-hub-signature-256"];
  const verification = verifyFacebookSignature(rawBody, signature, config.facebookAppSecret);

  if (!verification.ok) {
    metrics.inc("webhook_rejected_total");
    logger.warn("rejected webhook signature", { reason: verification.reason });
    send(res, 401, { error: verification.reason });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (error) {
    metrics.inc("webhook_rejected_total");
    send(res, 400, { error: "invalid_json" });
    return;
  }

  const events = normalizeFacebookPayload(payload);
  const kafkaProducer = await getProducer();
  for (const event of events) {
    const actorId = event.actor && event.actor.id;
    if (actorId && String(actorId) === String(config.facebookPageId)) {
      logger.info("ignored page-authored webhook event", { eventId: event.eventId, actorId });
      continue;
    }

    upsertEvent(event.eventId, {
      status: "received",
      type: event.type,
      actorId: event.actor && event.actor.id,
      text: event.text
    });
    await publish(kafkaProducer, config.kafka.topics.rawEvents, event, event.idempotencyKey);
    metrics.inc("webhook_received_total");
  }

  send(res, 200, { ok: true, events: events.length });
}

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/webhook") {
        handleVerify(req, res, url);
        return;
      }

      if (req.method === "POST" && url.pathname === "/webhook") {
        await handleWebhookPost(req, res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        send(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/docs") {
        send(res, 200, renderSwaggerHtml(), {
          "content-type": "text/html; charset=utf-8"
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/openapi.json") {
        send(res, 200, getOpenApiSpec());
        return;
      }

      if (req.method === "GET" && url.pathname === "/metrics") {
        send(res, 200, metrics.renderPrometheus(), {
          "content-type": "text/plain; version=0.0.4"
        });
        return;
      }

      send(res, 404, { error: "not_found" });
    } catch (error) {
      logger.error("webhook request failed", { error: error.message });
      metrics.inc("kafka_publish_failed_total");
      send(res, 500, { error: "internal_error" });
    }
  });

  server.listen(config.webhookPort, () => {
    logger.info("webhook-service listening", { port: config.webhookPort });
  });
}

main().catch((error) => {
  logger.error("webhook-service failed to start", { error: error.message });
  process.exit(1);
});

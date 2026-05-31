const http = require("http");
const config = require("../shared/config");
const logger = require("../shared/logger");
const metrics = require("../shared/metrics");
const { createConsumer, createProducer, publish } = require("../shared/kafka");
const { upsertEvent, getEvent } = require("../shared/storage");
const { classify } = require("./aiClassifier");
const { detectSpam } = require("./spamDetector");
const { isRateLimited } = require("./rateLimiter");
const { buildDecision } = require("./decisionEngine");

async function executeCommand(producer, event, command) {
  const commandEvent = {
    schemaVersion: "command.v1",
    commandId: `${event.eventId}:${command.action}`,
    eventId: event.eventId,
    idempotencyKey: `${event.idempotencyKey}:${command.action}`,
    ...command,
    createdAt: new Date().toISOString()
  };

  await publish(producer, config.kafka.topics.replyCommands, commandEvent, commandEvent.idempotencyKey);

  if (command.action === "manual_review") {
    await publish(producer, config.kafka.topics.manualReview, commandEvent, commandEvent.idempotencyKey);
  }
}

async function processRawEvent(producer, event) {
  const actorId = event.actor && event.actor.id;
  if (actorId && String(actorId) === String(config.facebookPageId)) {
    upsertEvent(event.eventId, {
      status: "processed",
      processedAt: new Date().toISOString(),
      actorId,
      text: event.text,
      decision: {
        status: "processed",
        automation: "skip_page_authored_comment",
        commands: []
      },
      reason: "page_authored_comment"
    });
    logger.info("skip page-authored event", { eventId: event.eventId, actorId });
    return;
  }

  const existing = getEvent(event.eventId);
  if (existing && existing.processedAt) {
    logger.info("skip duplicate event", { eventId: event.eventId });
    return;
  }

  const rateLimited = isRateLimited(
    actorId,
    Date.now(),
    config.rules.rateLimitMaxEvents,
    config.rules.rateLimitWindowSeconds
  );

  if (rateLimited) {
    logger.warn("event marked for review by rate limit", { eventId: event.eventId, actorId });
  }

  const spam = detectSpam(event);
  const classification = rateLimited
    ? { intent: "skipped_rate_limit", sentiment: "unknown", confidence: 0, provider: "none" }
    : await classify(event.text);

  const decision = buildDecision(event, spam, classification, rateLimited);

  upsertEvent(event.eventId, {
    status: decision.status,
    processedAt: new Date().toISOString(),
    actorId,
    text: event.text,
    spam,
    classification,
    decision,
    reason: decision.reason
  });

  for (const command of decision.commands) {
    await executeCommand(producer, event, command);
  }

  logger.info("processed raw event", {
    eventId: event.eventId,
    status: decision.status,
    automation: decision.automation
  });
}

async function main() {
  http
    .createServer((req, res) => {
      if (req.url === "/metrics") {
        res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
        res.end(metrics.renderPrometheus());
        return;
      }
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    })
    .listen(config.coreMetricsPort, () => {
      logger.info("core metrics server listening", { port: config.coreMetricsPort });
    });

  const producer = await createProducer();
  logger.info("core-service starting consumer", {
    topic: config.kafka.topics.rawEvents,
    groupId: config.kafka.coreConsumerGroup
  });

  await createConsumer(config.kafka.coreConsumerGroup, [config.kafka.topics.rawEvents], async (event) => {
    try {
      await processRawEvent(producer, event);
    } catch (error) {
      upsertEvent(event.eventId, { status: "failed", reason: error.message });
      logger.error("core processing failed", { eventId: event.eventId, error: error.message });
      throw error;
    }
  });
}

main().catch((error) => {
  logger.error("core-service failed to start", { error: error.message });
  process.exit(1);
});

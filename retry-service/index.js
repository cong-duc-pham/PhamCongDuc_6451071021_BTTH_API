const http = require("http");
const config = require("../shared/config");
const logger = require("../shared/logger");
const { createConsumer, createProducer, publish } = require("../shared/kafka");
const { upsertEvent, addDeadLetter } = require("../shared/storage");
const metrics = require("../shared/metrics");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleRetryMessage(producer, message) {
  const attempts = Number(message.attempts || 0);
  const nextAttempt = attempts + 1;
  const eventId = message.event && message.event.eventId;

  if (nextAttempt > config.rules.retryMaxAttempts) {
    const deadLetter = {
      schemaVersion: "dead_letter.v1",
      reason: "retry_exhausted",
      attempts,
      message,
      movedAt: new Date().toISOString()
    };
    await publish(producer, config.kafka.topics.deadLetter, deadLetter, message.event && message.event.idempotencyKey);
    addDeadLetter(deadLetter);
    metrics.inc("dead_letter_total");
    if (eventId) upsertEvent(eventId, { status: "dead_letter", reason: "retry_exhausted" });
    logger.error("message moved to dead letter", { eventId, attempts });
    return;
  }

  const delayMs = 1000 * 2 ** (nextAttempt - 1);
  logger.info("retry scheduled", { eventId, nextAttempt, delayMs });
  await sleep(delayMs);

  await publish(
    producer,
    config.kafka.topics.sendRetry,
    {
      ...message,
      attempts: nextAttempt,
      scheduledAt: new Date().toISOString()
    },
    message.event && message.event.idempotencyKey
  );
  if (eventId) upsertEvent(eventId, { status: "retrying", reason: `attempt_${nextAttempt}` });
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
    .listen(config.retryMetricsPort, () => {
      logger.info("retry metrics server listening", { port: config.retryMetricsPort });
    });

  const producer = await createProducer();
  await createConsumer("retry-service", [config.kafka.topics.sendFailed], async (message) => {
    await handleRetryMessage(producer, message);
  });

  logger.info("retry-service consuming", { topic: config.kafka.topics.sendFailed });
}

main().catch((error) => {
  logger.error("retry-service failed to start", { error: error.message });
  process.exit(1);
});

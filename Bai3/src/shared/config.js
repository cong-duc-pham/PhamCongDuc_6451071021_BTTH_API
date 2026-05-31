const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || "./data");

module.exports = {
  env: process.env.NODE_ENV || "development",
  backendPort: Number(process.env.BACKEND_PORT || 3000),
  webhookPort: Number(process.env.WEBHOOK_PORT || 3001),
  coreMetricsPort: Number(process.env.CORE_METRICS_PORT || 3002),
  retryMetricsPort: Number(process.env.RETRY_METRICS_PORT || 3003),
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || "",
  facebookVerifyToken: process.env.FACEBOOK_VERIFY_TOKEN || "local_verify_token",
  facebookPageId: process.env.FACEBOOK_PAGE_ID || "",
  facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
  adminToken: process.env.ADMIN_TOKEN || "local_admin_token",
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "fb-ai-automation-system",
    coreConsumerGroup: process.env.CORE_CONSUMER_GROUP || "core-service-bai3",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    topics: {
      rawEvents: process.env.TOPIC_RAW_EVENTS || "raw_events",
      replyCommands: process.env.TOPIC_REPLY_COMMANDS || "reply_commands",
      sendRetry: process.env.TOPIC_SEND_RETRY || "send_retry",
      sendFailed: process.env.TOPIC_SEND_FAILED || "send_failed",
      deadLetter: process.env.TOPIC_DEAD_LETTER || "dead_letter",
      manualReview: process.env.TOPIC_MANUAL_REVIEW || "manual_review"
    }
  },
  ai: {
    openAiApiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini"
  },
  rules: {
    rateLimitMaxEvents: Number(process.env.RATE_LIMIT_MAX_EVENTS || 20),
    rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
    repeatSpamThreshold: Number(process.env.REPEAT_SPAM_THRESHOLD || 3),
    repeatSpamWindowHours: Number(process.env.REPEAT_SPAM_WINDOW_HOURS || 24),
    retryMaxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS || 3),
    circuitBreakerFailures: Number(process.env.CIRCUIT_BREAKER_FAILURES || 10),
    circuitBreakerCooldownMs: Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || 30000)
  },
  dataDir
};

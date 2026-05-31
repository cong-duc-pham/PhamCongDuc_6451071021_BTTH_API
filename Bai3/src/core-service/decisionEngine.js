const config = require("../shared/config");
const { readJson, writeJson, blacklistUser, getBlacklist } = require("../shared/storage");

function recordSpam(actorId, eventId, isSpam) {
  if (!actorId || !isSpam) return 0;
  const records = readJson("spam_records.json", {});
  const windowMs = config.rules.repeatSpamWindowHours * 60 * 60 * 1000;
  const now = Date.now();
  const recent = (records[actorId] || []).filter((item) => now - item.ts <= windowMs);
  recent.push({ eventId, ts: now });
  records[actorId] = recent;
  writeJson("spam_records.json", records);
  return recent.length;
}

function buildDecision(event, spam, classification, rateLimited) {
  const actorId = event.actor && event.actor.id;
  const blacklist = getBlacklist();

  if (actorId && blacklist[actorId]) {
    return {
      status: "processed",
      automation: "skip_blacklisted_user",
      commands: [],
      reason: "blacklisted_user"
    };
  }

  if (rateLimited) {
    return {
      status: "pending_review",
      automation: "manual_review",
      commands: [{ action: "manual_review", targetId: event.object.id, reason: "rate_limited" }],
      reason: "rate_limited"
    };
  }

  const repeatedSpamCount = recordSpam(actorId, event.eventId, spam.isSpam);
  if (repeatedSpamCount >= config.rules.repeatSpamThreshold) {
    blacklistUser(actorId, "repeat_spam_24h");
    return {
      status: "processed",
      automation: "blacklist_and_hide",
      commands: [{ action: "hide_comment", targetId: event.object.id, reason: "repeat_spam_24h" }],
      reason: "repeat_spam_24h"
    };
  }

  if (spam.severity === "high") {
    return {
      status: "pending_review",
      automation: "hide_and_review",
      commands: [
        { action: "hide_comment", targetId: event.object.id, reason: spam.reasons.join(",") },
        { action: "manual_review", targetId: event.object.id, reason: "high_risk_spam" }
      ],
      reason: "high_risk_spam"
    };
  }

  if (spam.severity === "light") {
    return {
      status: "processed",
      automation: "hide_comment",
      commands: [{ action: "hide_comment", targetId: event.object.id, reason: spam.reasons.join(",") }],
      reason: "light_spam"
    };
  }

  if (classification.intent === "khieu_nai_ho_tro") {
    return {
      status: "processed",
      automation: "support_reply",
      commands: [{ action: "auto_reply", targetId: event.object.id, template: "support_follow_up" }],
      reason: "support_intent"
    };
  }

  if (classification.sentiment === "tieu_cuc") {
    return {
      status: "processed",
      automation: "apology_reply",
      commands: [{ action: "auto_reply", targetId: event.object.id, template: "apology" }],
      reason: "negative_sentiment"
    };
  }

  if (classification.sentiment === "tich_cuc" || classification.intent === "khen_tuong_tac_tich_cuc") {
    return {
      status: "processed",
      automation: "thank_you_reply",
      commands: [{ action: "auto_reply", targetId: event.object.id, template: "thank_you" }],
      reason: "positive_sentiment"
    };
  }

  if (classification.intent === "hoi_gia") {
    return {
      status: "processed",
      automation: "price_reply",
      commands: [{ action: "auto_reply", targetId: event.object.id, template: "ask_inbox_or_price" }],
      reason: "price_intent"
    };
  }

  return {
    status: "processed",
    automation: "no_action",
    commands: [],
    reason: "no_rule_matched"
  };
}

module.exports = {
  buildDecision
};

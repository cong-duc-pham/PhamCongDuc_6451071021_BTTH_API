const fs = require("fs");
const path = require("path");
const config = require("./config");

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function filePath(name) {
  ensureDataDir();
  return path.join(config.dataDir, name);
}

function readJson(name, fallback) {
  const target = filePath(name);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function writeJson(name, value) {
  fs.writeFileSync(filePath(name), JSON.stringify(value, null, 2));
}

function upsertEvent(eventId, patch) {
  const events = readJson("events.json", {});
  const previous = events[eventId] || {};
  events[eventId] = {
    ...previous,
    ...patch,
    eventId,
    updatedAt: new Date().toISOString(),
    history: [
      ...(previous.history || []),
      {
        at: new Date().toISOString(),
        status: patch.status || previous.status,
        reason: patch.reason
      }
    ].filter((item) => item.status)
  };
  writeJson("events.json", events);
  return events[eventId];
}

function getEvent(eventId) {
  return readJson("events.json", {})[eventId];
}

function addDeadLetter(message) {
  const items = readJson("dead_letters.json", []);
  items.push({
    ...message,
    storedAt: new Date().toISOString()
  });
  writeJson("dead_letters.json", items);
}

function getIdempotencyKey(commandId) {
  return readJson("idempotency_keys.json", {})[commandId];
}

function saveIdempotencyKey(commandId, status = "processed") {
  const keys = readJson("idempotency_keys.json", {});
  keys[commandId] = {
    commandId,
    status,
    processedAt: new Date().toISOString()
  };
  writeJson("idempotency_keys.json", keys);
  return keys[commandId];
}

function getBlacklist() {
  return readJson("blacklist.json", {});
}

function blacklistUser(userId, reason) {
  const blacklist = getBlacklist();
  blacklist[userId] = {
    userId,
    reason,
    blacklistedAt: new Date().toISOString()
  };
  writeJson("blacklist.json", blacklist);
}

module.exports = {
  readJson,
  writeJson,
  upsertEvent,
  getEvent,
  addDeadLetter,
  getIdempotencyKey,
  saveIdempotencyKey,
  getBlacklist,
  blacklistUser
};

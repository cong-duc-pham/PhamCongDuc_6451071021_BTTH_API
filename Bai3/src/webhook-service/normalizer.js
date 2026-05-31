const crypto = require("crypto");

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizeFacebookPayload(payload) {
  const events = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const pageId = entry.id;
    const entryTime = entry.time ? new Date(entry.time).toISOString() : new Date().toISOString();

    for (const change of entry.changes || []) {
      const value = change.value || {};
      const base = {
        schemaVersion: "raw_event.v1",
        source: "facebook",
        pageId,
        receivedAt: new Date().toISOString(),
        occurredAt: entryTime,
        raw: { change }
      };

      if (change.field === "feed" && value.item === "comment") {
        const eventId = value.comment_id || stableHash(JSON.stringify({ pageId, value }));
        events.push({
          ...base,
          eventId,
          idempotencyKey: `facebook:comment:${eventId}`,
          type: "comment",
          actor: {
            id: value.from && value.from.id,
            name: value.from && value.from.name
          },
          object: {
            id: value.comment_id,
            parentId: value.parent_id || value.post_id,
            postId: value.post_id
          },
          text: value.message || "",
          action: value.verb || "unknown"
        });
      }

      if (change.field === "messages" || value.item === "message") {
        const messageId = value.message_id || stableHash(JSON.stringify({ pageId, value }));
        events.push({
          ...base,
          eventId: messageId,
          idempotencyKey: `facebook:message:${messageId}`,
          type: "message",
          actor: {
            id: value.sender_id || (value.from && value.from.id),
            name: value.from && value.from.name
          },
          object: {
            id: messageId,
            parentId: value.thread_id,
            postId: null
          },
          text: value.message || value.text || "",
          action: value.verb || "add"
        });
      }
    }
  }

  return events;
}

module.exports = {
  normalizeFacebookPayload
};

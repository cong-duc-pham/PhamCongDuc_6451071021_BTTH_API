const buckets = new Map();

function isRateLimited(actorId, now, maxEvents, windowSeconds) {
  if (!actorId) return false;
  const windowMs = windowSeconds * 1000;
  const previous = buckets.get(actorId) || [];
  const recent = previous.filter((ts) => now - ts <= windowMs);
  recent.push(now);
  buckets.set(actorId, recent);
  return recent.length > maxEvents;
}

module.exports = {
  isRateLimited
};

function hasLink(text) {
  return /https?:\/\/|www\.|bit\.ly|t\.me|zalo\.me|\.com|\.vn/i.test(text || "");
}

function hasRepeatedContent(text) {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 6) return false;
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.values()].some((count) => count >= 4);
}

function isScamOrBot(text) {
  return /kiem tien|casino|tai xiu|nhan qua|click ngay|vay tien|telegram|airdrop/i.test(text || "");
}

function detectSpam(event) {
  const reasons = [];
  if (hasLink(event.text)) reasons.push("contains_link");
  if (hasRepeatedContent(event.text)) reasons.push("repeated_content");
  if (isScamOrBot(event.text)) reasons.push("scam_or_bot");

  return {
    isSpam: reasons.length > 0,
    severity: reasons.includes("scam_or_bot") ? "high" : reasons.length > 0 ? "light" : "none",
    reasons
  };
}

module.exports = {
  detectSpam
};

const config = require("../shared/config");
const logger = require("../shared/logger");

const INTENTS = {
  PRICE: "hoi_gia",
  SUPPORT: "khieu_nai_ho_tro",
  PRAISE: "khen_tuong_tac_tich_cuc",
  SPAM: "spam",
  OTHER: "khac"
};

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function heuristicClassify(text) {
  const normalized = normalizeText(text);

  if (/https?:\/\/|www\.|bit\.ly|t\.me|zalo\.me/.test(normalized)) {
    return { intent: INTENTS.SPAM, sentiment: "tieu_cuc", confidence: 0.85, provider: "heuristic" };
  }

  if (/chua nhan|giao hang.*lau|lau qua|qua lau|cho lau|loi|khieu nai|doi tra|that vong|kem|te/.test(normalized)) {
    return { intent: INTENTS.SUPPORT, sentiment: "tieu_cuc", confidence: 0.72, provider: "heuristic" };
  }

  if (/(^|\s)(gia|bn|ib|inbox|ship|mua)(\s|$)|bao nhieu/.test(normalized)) {
    return { intent: INTENTS.PRICE, sentiment: "trung_tinh", confidence: 0.75, provider: "heuristic" };
  }

  if (/hay|tot|dep|ung ho|tuyet|cam on|thich|nhanh|hai long/.test(normalized)) {
    return { intent: INTENTS.PRAISE, sentiment: "tich_cuc", confidence: 0.7, provider: "heuristic" };
  }

  return { intent: INTENTS.OTHER, sentiment: "trung_tinh", confidence: 0.55, provider: "heuristic" };
}

async function classifyWithOpenAI(text) {
  const prompt = [
    "Phan loai comment/message Facebook tieng Viet.",
    "Tra ve JSON hop le voi keys: intent, sentiment, confidence.",
    "intent chi chon: hoi_gia, khieu_nai_ho_tro, khen_tuong_tac_tich_cuc, spam, khac.",
    "sentiment chi chon: tich_cuc, trung_tinh, tieu_cuc.",
    `Noi dung: ${text || ""}`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.ai.openAiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`openai_http_${response.status}`);
  }

  const data = await response.json();
  const content = data.choices && data.choices[0] && data.choices[0].message.content;
  return {
    ...JSON.parse(content),
    provider: "openai"
  };
}

async function classify(text) {
  if (!config.ai.openAiApiKey) {
    return heuristicClassify(text);
  }

  try {
    return await classifyWithOpenAI(text);
  } catch (error) {
    logger.warn("ai classifier failed, using heuristic fallback", { error: error.message });
    return heuristicClassify(text);
  }
}

module.exports = {
  classify,
  heuristicClassify,
  INTENTS
};

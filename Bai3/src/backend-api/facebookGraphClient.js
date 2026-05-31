const config = require("../shared/config");
const logger = require("../shared/logger");

const GRAPH_BASE_URL = process.env.FACEBOOK_GRAPH_BASE_URL || "https://graph.facebook.com/v20.0";

function isMockMode() {
  return (
    process.env.FACEBOOK_MOCK_MODE === "1" ||
    !config.facebookPageAccessToken ||
    config.facebookPageAccessToken.startsWith("replace_with_") ||
    !config.facebookPageId ||
    config.facebookPageId.startsWith("replace_with_")
  );
}

function buildUrl(path, query = {}) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${GRAPH_BASE_URL}${cleanPath}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  if (!url.searchParams.has("access_token")) {
    url.searchParams.set("access_token", config.facebookPageAccessToken);
  }
  return url;
}

async function graphRequest(method, path, { query = {}, body } = {}) {
  if (isMockMode()) {
    logger.info("facebook graph mock response", { method, path, bodyKeys: body ? Object.keys(body) : [] });
    return {
      mock: true,
      id: `mock_${Date.now()}`,
      method,
      path,
      query,
      body
    };
  }

  if (!config.facebookPageAccessToken) {
    const error = new Error("missing_facebook_page_access_token");
    error.status = 401;
    throw error;
  }

  const url = buildUrl(path, query);
  const requestBody = body ? new URLSearchParams(body) : undefined;

  logger.info("facebook graph request", {
    method,
    path,
    bodyKeys: body ? Object.keys(body) : []
  });

  const response = await fetch(url, {
    method,
    headers: requestBody ? { "content-type": "application/x-www-form-urlencoded" } : undefined,
    body: requestBody
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  logger.info("facebook graph response", {
    method,
    path,
    status: response.status,
    facebookCode: data.error && data.error.code
  });

  if (!response.ok) {
    const error = new Error(data.error && data.error.message ? data.error.message : "facebook_api_error");
    error.status = response.status;
    error.facebook = data.error;
    throw error;
  }

  return data;
}

function listPosts(limit = 25) {
  return graphRequest("GET", `/${config.facebookPageId}/posts`, {
    query: { fields: "id,message,created_time,permalink_url", limit }
  });
}

function createPost(message) {
  return graphRequest("POST", `/${config.facebookPageId}/feed`, {
    body: { message }
  });
}

function listComments(postId, limit = 25) {
  return graphRequest("GET", `/${postId}/comments`, {
    query: { fields: "id,message,from,created_time", limit }
  });
}

function replyComment(commentId, message) {
  return graphRequest("POST", `/${commentId}/comments`, {
    body: { message }
  });
}

function hideComment(commentId) {
  return graphRequest("POST", `/${commentId}`, {
    body: { is_hidden: "true" }
  });
}

module.exports = {
  listPosts,
  createPost,
  listComments,
  replyComment,
  hideComment
};

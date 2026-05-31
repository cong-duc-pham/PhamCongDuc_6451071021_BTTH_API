const config = require("../shared/config");

function getOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Facebook Webhook Kafka Pipeline API",
      version: "1.0.0",
      description: "API cho webhook-service trong bai xu ly thoi gian thuc voi Facebook Webhook va Kafka."
    },
    servers: [
      {
        url: `http://localhost:${config.webhookPort}`,
        description: "Local webhook-service"
      }
    ],
    paths: {
      "/webhook": {
        get: {
          summary: "Facebook webhook verification",
          description: "Endpoint Facebook goi khi cau hinh callback URL. Neu verify token dung, service tra ve hub.challenge.",
          parameters: [
            {
              name: "hub.mode",
              in: "query",
              required: true,
              schema: { type: "string", example: "subscribe" }
            },
            {
              name: "hub.verify_token",
              in: "query",
              required: true,
              schema: { type: "string", example: config.facebookVerifyToken }
            },
            {
              name: "hub.challenge",
              in: "query",
              required: true,
              schema: { type: "string", example: "123456" }
            }
          ],
          responses: {
            200: { description: "Tra ve hub.challenge" },
            403: { description: "Verify token khong dung" }
          }
        },
        post: {
          summary: "Receive Facebook webhook events",
          description: "Nhan payload Facebook, verify X-Hub-Signature-256, normalize event va publish vao Kafka topic raw_events.",
          parameters: [
            {
              name: "X-Hub-Signature-256",
              in: "header",
              required: true,
              schema: { type: "string", example: "sha256=<hmac_sha256_hex>" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FacebookWebhookPayload" },
                example: {
                  object: "page",
                  entry: [
                    {
                      id: "page_1",
                      time: 1710000000000,
                      changes: [
                        {
                          field: "feed",
                          value: {
                            item: "comment",
                            verb: "add",
                            comment_id: "comment_123",
                            post_id: "post_456",
                            from: { id: "user_1", name: "Nguyen Van A" },
                            message: "Shop oi gia bao nhieu?"
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            }
          },
          responses: {
            200: {
              description: "Webhook accepted",
              content: {
                "application/json": {
                  example: { ok: true, events: 1 }
                }
              }
            },
            400: { description: "JSON khong hop le" },
            401: { description: "Chu ky HMAC khong hop le" },
            500: { description: "Loi publish Kafka hoac loi he thong" }
          }
        }
      },
      "/health": {
        get: {
          summary: "Health check",
          responses: {
            200: {
              description: "Service dang chay",
              content: {
                "application/json": {
                  example: { ok: true }
                }
              }
            }
          }
        }
      },
      "/metrics": {
        get: {
          summary: "Prometheus metrics",
          responses: {
            200: { description: "Prometheus text format metrics" }
          }
        }
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI specification",
          responses: {
            200: { description: "OpenAPI JSON" }
          }
        }
      }
    },
    components: {
      schemas: {
        FacebookWebhookPayload: {
          type: "object",
          properties: {
            object: { type: "string", example: "page" },
            entry: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  time: { type: "number" },
                  changes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string", example: "feed" },
                        value: { type: "object" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

function renderSwaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Webhook Service API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui"
        });
      };
    </script>
  </body>
</html>`;
}

module.exports = {
  getOpenApiSpec,
  renderSwaggerHtml
};

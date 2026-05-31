# Bai 2: Xu ly thoi gian thuc voi Webhook va Kafka

He thong gom 4 service:

- `backend-api` chay port `3000`, expose REST API `/posts`, `/post`, `/comments`, consume `reply_commands` va `send_retry`, kiem tra idempotency key, va la service duy nhat goi Facebook Graph API.
- `webhook-service` chay port `3001`, nhan Facebook webhook, verify `X-Hub-Signature-256`, normalize payload va publish vao Kafka topic `raw_events`.
- `core-service` chay metrics port `3002`, consume `raw_events`, idempotency, rate limiting, spam detection, AI intent/sentiment va publish lenh automation vao `reply_commands`.
- `retry-service` consume `send_failed`, retry toi da N lan voi exponential backoff, sau do dua vao `dead_letter`.

## Chay nhanh

1. Copy cau hinh:

```powershell
Copy-Item .env.example .env
```

2. Sua `.env`:

- `FACEBOOK_APP_SECRET`: App Secret trong Meta Developer.
- `FACEBOOK_VERIFY_TOKEN`: chuoi tu dat, dung khi cau hinh webhook tren Meta.
- `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`: dung cho `backend-api` goi Graph API.
- `ADMIN_TOKEN`: token dashboard gui qua header `X-Admin-Token`.
- `OPENAI_API_KEY`: khong bat buoc. De trong thi he thong dung heuristic fallback.

3. Chay Kafka va Prometheus:
3. Chay Kafka, Kafka UI va Prometheus:

```powershell
docker compose up -d
```

Kafka UI mo tai:

```text
http://localhost:8080
```

Swagger/OpenAPI cua webhook-service mo tai:

```text
http://localhost:3001/docs
```

Vao cluster `local` de xem cac topic:

- `raw_events`
- `reply_commands`
- `send_retry`
- `send_failed`
- `manual_review`
- `dead_letter`

4. Cai dependency va chay service:

```powershell
npm install
npm run start:webhook
npm run start:core
npm run start:retry
```

Hoac chay chung:

```powershell
npm run dev:all
```

## Cau hinh Facebook Webhook

Endpoint callback:

```text
http://<public-domain>/webhook
```

Khi chay local, co the dung ngrok:

```powershell
ngrok http 3001
```

Trong Meta Developer:

1. Vao App Dashboard > Webhooks.
2. Chon Page object.
3. Callback URL: `https://<ngrok-domain>/webhook`.
4. Verify Token: gia tri `FACEBOOK_VERIFY_TOKEN`.
5. Subscribe field lien quan comment, vi du `feed`.

## Test bang curl

Tao body mau:

```json
{
  "object": "page",
  "entry": [
    {
      "id": "page_1",
      "time": 1710000000000,
      "changes": [
        {
          "field": "feed",
          "value": {
            "item": "comment",
            "verb": "add",
            "comment_id": "comment_123",
            "post_id": "post_456",
            "from": { "id": "user_1", "name": "Nguyen Van A" },
            "message": "Shop oi gia bao nhieu?"
          }
        }
      ]
    }
  ]
}
```

Tinh signature HMAC-SHA256 bang app secret, gui header:

```text
X-Hub-Signature-256: sha256=<hex_digest>
```

Co the tao signature nhanh:

```powershell
node scripts/sign-payload.js "APP_SECRET" '{"object":"page","entry":[]}'
```

## Cac topic Kafka

- `raw_events`: event da normalize tu webhook.
- `reply_commands`: lenh automation nhu auto reply, hide comment, manual review.
- `send_retry`: lenh Retry Service dua lai cho Backend API sau backoff.
- `send_failed`: loi downstream can retry.
- `manual_review`: event can quan tri vien xem thu cong.
- `dead_letter`: message retry that bai qua gioi han.

## Theo doi trang thai

Trang thai tung event duoc luu trong `data/events.json`:

- `received`
- `processed`
- `replied`
- `pending_review`
- `failed`
- `dead_letter`

Blacklist noi bo luu trong `data/blacklist.json`.

## Alert Dead Letter

Prometheus doc metric tu `webhook-service` port `3001`, `core-service` port `3002` va `retry-service` port `3003`. Rule canh bao nam trong `monitoring/prometheus/alerts.yml`; khi `dead_letter_total > 0` se kich hoat alert.

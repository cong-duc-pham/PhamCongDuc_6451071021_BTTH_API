# Bai 3: Phan tich cam xuc bang AI va tu dong hoa

Bai 3 nay duoc trien khai dung tren kien truc trong tai lieu:

```text
Facebook Page
  -> webhook-service :3001
  -> Kafka topic raw_events
  -> core-service :3002
  -> Kafka topic reply_commands
  -> backend-api :3000
  -> Kafka topic send_failed
  -> retry-service :3003
  -> Kafka topic send_retry hoac dead_letter
```

## Cac service

- `webhook-service` port `3001`: nhan webhook Facebook, verify `X-Hub-Signature-256`, normalize payload va publish vao `raw_events`.
- `core-service` port metrics `3002`: consume `raw_events`, phan tich spam, intent, sentiment bang AI/fallback, sau do ap dung automation rule.
- `backend-api` port `3000`: service duy nhat goi Facebook Graph API, consume `reply_commands` va `send_retry`, co idempotency key.
- `retry-service` port `3003`: consume `send_failed`, exponential backoff, publish lai `send_retry` neu chua het so lan, hoac `dead_letter` neu het so lan.

## Logic AI va automation cua Bai 3

- `sentiment=tich_cuc` hoac `intent=khen_tuong_tac_tich_cuc` -> auto reply: `Cam on ban da ung ho page!`
- `sentiment=tieu_cuc` hoac `intent=khieu_nai_ho_tro` -> auto reply xin loi va ho tro.
- `intent=hoi_gia` -> auto reply moi inbox/nhan tin de bao gia.
- Spam nhe -> an binh luan.
- Spam nang/scam/bot -> an binh luan va dua vao `manual_review`.
- Spam lap lai >= 3 lan trong 24 gio -> dua user vao blacklist noi bo va an binh luan.

## Yeu cau bat buoc co cham diem

- Retry exponential backoff: `retry-service` tinh thoi gian cho theo `1s * 2^retry_count`.
- Circuit breaker: `backend-api` tam ngung goi Facebook khi loi lien tiep qua nguong.
- Idempotent: `backend-api` luu `commandId` vao `data/idempotency_keys.json`; command lap lai se bi bo qua.
- Dead Letter Queue: het so lan retry thi message duoc publish vao `dead_letter` va luu trong `data/dead_letters.json`.
- Prometheus alert: cau hinh trong `monitoring/prometheus/alerts.yml`, metric `dead_letter_total > 0` kich hoat canh bao.

## Chay nhanh

```powershell
cd C:\CongDuc\Ki_II_nam_III\API\BTchinh\Bai3
Copy-Item .env.example .env
npm install
docker compose up -d
npm run dev:all
```

Kafka UI:

```text
http://localhost:8080
```

Webhook docs:

```text
http://localhost:3001/docs
```

Backend API:

```text
http://localhost:3000/posts
http://localhost:3000/post
http://localhost:3000/comments
```

## Test webhook bang payload mau

Tao body comment:

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
            "comment_id": "comment_positive_1",
            "post_id": "post_1",
            "from": { "id": "user_1", "name": "Nguyen Van A" },
            "message": "Shop ho tro rat nhanh, san pham rat tot"
          }
        }
      ]
    }
  ]
}
```

Tinh signature:

```powershell
node scripts/sign-payload.js "APP_SECRET" '{"object":"page","entry":[]}'
```

Gui request den:

```text
POST http://localhost:3001/webhook
Header: X-Hub-Signature-256: sha256=<hex_digest>
```

## Kich ban de bao cao

1. Comment tich cuc: `Shop ho tro rat nhanh, san pham rat tot`
   - Mong doi: `sentiment=tich_cuc`, publish command `auto_reply` template `thank_you`.

2. Comment tieu cuc: `Minh cho qua lau va chua nhan duoc hang`
   - Mong doi: `sentiment=tieu_cuc`, publish command `auto_reply` template `apology`.

3. Comment spam: `Nhan qua mien phi click ngay https://spam.example.com`
   - Mong doi: `intent=spam`, command `hide_comment`, spam nang thi them `manual_review`.

4. Loi Facebook API:
   - Dat token sai hoac mo phong loi downstream.
   - Mong doi: `backend-api` publish `send_failed`, `retry-service` publish `send_retry`, het N lan thi vao `dead_letter`.

5. Idempotent:
   - Gui lap lai cung event/command.
   - Mong doi: `backend-api` thay `commandId` da co trong `idempotency_keys.json` va khong goi Facebook lan hai.

## Noi luu trang thai

- `data/events.json`: trang thai tung event.
- `data/idempotency_keys.json`: command da xu ly.
- `data/blacklist.json`: blacklist noi bo.
- `data/dead_letters.json`: message that bai sau retry.

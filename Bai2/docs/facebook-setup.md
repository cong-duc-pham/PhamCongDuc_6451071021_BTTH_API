# Huong dan dang ky Facebook Webhook

## 1. Thong tin app

Tu man hinh Meta Developer cua ban:

- App ID: `3047820185411784`
- App Secret: bam `Hien thi`, copy vao `.env` bien `FACEBOOK_APP_SECRET`.
- Verify Token: tu dat trong `.env`, vi du `my_fb_webhook_verify_2026`.

Khong dua App Secret vao bao cao hoac commit public.

## 2. Public callback URL

Facebook can goi duoc may local cua ban qua HTTPS. Dung ngrok:

```powershell
ngrok http 3001
```

Lay URL HTTPS, vi du:

```text
https://abcd-1234.ngrok-free.app/webhook
```

## 3. Cau hinh tren Meta Developer

1. Vao `Webhooks`.
2. Chon object `Page`.
3. Dien Callback URL: `https://<ngrok-domain>/webhook`.
4. Dien Verify Token dung voi `FACEBOOK_VERIFY_TOKEN`.
5. Subscribe field `feed` de nhan binh luan bai viet Page.

## 4. Luong verify

Facebook se gui GET:

```text
/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

Neu token dung, `webhook-service` tra lai challenge va Meta chap nhan endpoint.

## 5. Luong event comment

Khi co comment moi tren Page, Facebook gui POST `/webhook` kem header:

```text
X-Hub-Signature-256: sha256=<hmac_sha256_body>
```

Service tinh lai HMAC bang `FACEBOOK_APP_SECRET`. Neu khop moi parse payload va publish vao Kafka.

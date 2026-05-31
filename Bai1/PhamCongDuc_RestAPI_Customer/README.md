# Bai 1: Facebook Page Backend API

Ung dung ASP.NET Core 8 nay da duoc bo sung backend proxy cho Facebook Graph API theo yeu cau Bai 1. Frontend/dashboard chi goi backend cua minh, khong goi truc tiep Facebook.

## Cong nghe su dung

- ASP.NET Core 8
- Entity Framework Core 8
- SQL Server
- Swagger / OpenAPI

## Cau truc chinh

```text
PhamCongDuc_RestAPI_Customer/
+-- Controllers/
|   +-- CustomersController.cs
+-- Data/
|   +-- AppDbContext.cs
+-- Models/
|   +-- Customer.cs
+-- Program.cs
+-- appsettings.json
```

## Cau hinh database

Chuoi ket noi SQL Server nam trong file:

```text
PhamCongDuc_RestAPI_Customer/appsettings.json
```

Mac dinh:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=DESKTOP-8RK7LF0;Database=DuLieu;Trusted_Connection=True;TrustServerCertificate=True;"
}
```

Neu chay tren may khac, hay sua `Server` va `Database` cho dung voi SQL Server cua ban.

Bang du lieu duoc mapping voi model `Customer` co ten la `KhachHang`.

## Cau hinh Facebook

Trong `PhamCongDuc_RestAPI_Customer/appsettings.json`, dien:

```json
"Facebook": {
  "GraphBaseUrl": "https://graph.facebook.com/v20.0",
  "PageId": "FACEBOOK_PAGE_ID",
  "PageAccessToken": "PAGE_ACCESS_TOKEN",
  "AdminToken": "local_admin_token",
  "RetryCount": 2
}
```

Dashboard can gui header:

```text
X-Admin-Token: local_admin_token
```

## Endpoint Facebook proxy

| Phuong thuc | Endpoint | Mo ta |
| --- | --- | --- |
| `GET` | `/posts?limit=25` | Lay danh sach bai viet cua Page |
| `POST` | `/post` | Tao bai viet moi tren Page |
| `GET` | `/comments?postId={postId}&limit=25` | Lay binh luan cua mot bai viet |

Response duoc chuan hoa theo dang:

```json
{ "ok": true, "data": {} }
```

Khi loi token, loi Facebook hoac loi tam thoi, API tra ve:

```json
{
  "ok": false,
  "error": {
    "code": "facebook_api_error",
    "message": "Mo ta loi",
    "retryable": true
  }
}
```

Backend ghi log moi request gui toi Facebook va status tra ve. Loi tam thoi nhu `429` hoac `5xx` se retry exponential backoff theo `RetryCount`.

## Model Customer

| Thuoc tinh | Kieu du lieu | Ghi chu |
| --- | --- | --- |
| `Id` | `int` | Khoa chinh |
| `Name` | `string` | Bat buoc, toi da 100 ky tu |
| `Email` | `string` | Bat buoc, dung dinh dang email, toi da 100 ky tu |
| `Phone` | `string?` | So dien thoai, toi da 20 ky tu |
| `Address` | `string?` | Dia chi, toi da 255 ky tu |

## Cach chay du an

1. Mo terminal tai thu muc solution.
2. Restore package:

```bash
dotnet restore
```

3. Chay ung dung:

```bash
dotnet run --project PhamCongDuc_RestAPI_Customer
```

4. Mo Swagger:

```text
http://localhost:5207
```

Hoac neu chay profile HTTPS:

```text
https://localhost:7042
```

## Cac endpoint API

| Phuong thuc | Endpoint | Mo ta |
| --- | --- | --- |
| `GET` | `/api/customers?page=1&pageSize=10` | Lay danh sach khach hang co phan trang |
| `GET` | `/api/customers/{id}` | Lay thong tin khach hang theo id |
| `POST` | `/api/customers` | Them khach hang moi |
| `PUT` | `/api/customers/{id}` | Cap nhat thong tin khach hang |
| `DELETE` | `/api/customers/{id}` | Xoa khach hang |

## Vi du request

### Them khach hang

```json
{
  "name": "Nguyen Van A",
  "email": "nguyenvana@example.com",
  "phone": "0901234567",
  "address": "Ha Noi"
}
```

### Cap nhat khach hang

```json
{
  "name": "Nguyen Van B",
  "email": "nguyenvanb@example.com",
  "phone": "0912345678",
  "address": "TP. Ho Chi Minh"
}
```

## Ghi chu

- API kiem tra email trung khi them moi hoac cap nhat khach hang.
- Neu khong tim thay khach hang theo `id`, API tra ve `404 Not Found`.
- Neu du lieu dau vao khong hop le, API tra ve `400 Bad Request`.
- Swagger duoc cau hinh tai route goc cua ung dung.

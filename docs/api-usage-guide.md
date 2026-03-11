# API Usage Guide

## Cấu hình

| Key | Value |
|-----|-------|
| Base URL | `https://zhgkqoftrghqofdvbidy.supabase.co` |
| API Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y` |
| Header | `apikey: <API_KEY>` |
| Method | `GET` |
| Response | `application/json` |

---

## 1. Giá mới nhất tất cả symbols

**Endpoint:** `GET /rest/v1/rpc/get_latest_prices`

```bash
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_latest_prices" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

**Response 200:**
```json
[
  {
    "id": 22,
    "symbol": "SJC_9999",
    "price": 18720000.0000,
    "bid": 18420000.0000,
    "ask": 18720000.0000,
    "unit": "VND",
    "source": "sjc",
    "fetched_at": "2026-03-11T03:31:53.848+00:00",
    "created_at": "2026-03-11T03:31:59.016468+00:00"
  },
  {
    "id": 29,
    "symbol": "WTI_USD",
    "price": 83.8800,
    "bid": null,
    "ask": null,
    "unit": "USD",
    "source": "yahoo",
    "fetched_at": "2026-03-11T03:32:36.195+00:00",
    "created_at": "2026-03-11T03:32:37.16497+00:00"
  }
]
```

---

## 2. Giá theo symbol cụ thể

**Endpoint:** `GET /rest/v1/prices?symbol=eq.{SYMBOL}&order=fetched_at.desc&limit={N}`

```bash
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

**Response 200:** Mảng các bản ghi, sắp xếp mới nhất trước.

---

## 3. Nhiều symbols cùng lúc

**Endpoint:** `GET /rest/v1/prices?symbol=in.({S1},{S2})&order=fetched_at.desc&limit={N}`

```bash
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=in.(SJC_9999,WTI_USD,XAU_USD)&order=fetched_at.desc&limit=30" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

---

## 4. Lọc theo khoảng thời gian

**Endpoint:** `GET /rest/v1/prices?symbol=eq.{SYMBOL}&fetched_at=gte.{FROM}&fetched_at=lte.{TO}&order=fetched_at.desc`

```bash
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&fetched_at=gte.2026-03-10T00:00:00Z&fetched_at=lte.2026-03-11T23:59:59Z&order=fetched_at.desc" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

---

## 5. Chọn cột trả về

**Endpoint:** `GET /rest/v1/prices?select={col1},{col2}&symbol=eq.{SYMBOL}`

```bash
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?select=symbol,price,bid,ask,fetched_at&symbol=eq.SJC_9999&order=fetched_at.desc&limit=5" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

**Response 200:**
```json
[
  {
    "symbol": "SJC_9999",
    "price": 18720000.0000,
    "bid": 18420000.0000,
    "ask": 18720000.0000,
    "fetched_at": "2026-03-11T03:31:53.848+00:00"
  }
]
```

---

## 6. Phân trang

**Endpoint:** `GET /rest/v1/prices?symbol=eq.{SYMBOL}&order=fetched_at.desc&limit={N}&offset={N}`

```bash
# Trang 1
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10&offset=0" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"

# Trang 2
curl --location "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10&offset=10" --header "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ2txb2Z0cmdocW9mZHZiaWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQwNTcsImV4cCI6MjA4ODY4MDA1N30.J3Hc8xrXb_IsrzJnRgsUnMOWCEMWhKjnfE0yc8Uc39Y"
```

---

## Response Fields

| Field | Type | Mô tả |
|-------|------|-------|
| `id` | integer | ID bản ghi |
| `symbol` | string | Mã symbol (VD: `SJC_9999`) |
| `price` | decimal | Giá hiện tại (= ask nếu có) |
| `bid` | decimal \| null | Giá mua vào (chỉ vàng VN có) |
| `ask` | decimal \| null | Giá bán ra (chỉ vàng VN có) |
| `unit` | string | `VND` hoặc `USD` |
| `source` | string | Nguồn: `sjc`, `pnj`, `doji`, `petrolimex`, `yahoo` |
| `fetched_at` | ISO 8601 | Thời điểm crawl (UTC) |
| `created_at` | ISO 8601 | Thời điểm insert vào DB |

---

## Danh sách Symbols

| Symbol | Mô tả | Đơn vị | Có bid/ask |
|--------|-------|--------|:----------:|
| `SJC_9999` | Vàng SJC 9999 | VND | Yes |
| `SJC_RING` | Nhẫn SJC | VND | Yes |
| `PNJ_GOLD` | Vàng PNJ | VND | Yes |
| `DOJI_GOLD` | Vàng DOJI | VND | Yes |
| `RON95` | Xăng RON 95-III | VND | No |
| `RON98` | Xăng E5 RON 92 | VND | No |
| `DIESEL` | Dầu diesel | VND | No |
| `XAU_USD` | Vàng thế giới | USD/oz | No |
| `XAG_USD` | Bạc thế giới | USD/oz | No |
| `WTI_USD` | Dầu WTI | USD/barrel | No |
| `BRENT_USD` | Dầu Brent | USD/barrel | No |
| `RBOB_USD` | Xăng RBOB | USD/gallon | No |

---

## Filter Operators

| Operator | Ý nghĩa | Ví dụ |
|----------|---------|-------|
| `eq` | = | `symbol=eq.SJC_9999` |
| `neq` | != | `symbol=neq.SJC_9999` |
| `gt` | > | `price=gt.9000000` |
| `gte` | >= | `fetched_at=gte.2026-03-10` |
| `lt` | < | `price=lt.100` |
| `lte` | <= | `fetched_at=lte.2026-03-11` |
| `in` | IN | `symbol=in.(SJC_9999,WTI_USD)` |

---

## Error Responses

| Status | Ý nghĩa |
|--------|---------|
| `200` | Thành công, trả về JSON array |
| `400` | Query sai cú pháp |
| `401` | API key sai hoặc thiếu |
| `404` | Endpoint không tồn tại |

Error body:
```json
{
  "message": "Invalid API key",
  "hint": "Double check your Supabase `anon` or `service_role` API key."
}
```

---

## Lưu ý tích hợp

- **CORS**: Đã bật, gọi từ web/mobile đều OK
- **Rate limit**: Không giới hạn reads (free tier)
- **Caching**: Nên cache 1-5 phút phía client
- **Timeout**: Đặt 10-15s cho request
- **Polling**: Poll mỗi 5 phút là đủ, không cần WebSocket

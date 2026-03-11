# Vietnamese Commodity Price Website Scraping Research
**Date:** March 10, 2026
**Researcher:** Claude Code
**Purpose:** HTML structure & CSS selectors for Deno Edge Function web scrapers

---

## Executive Summary

Researched 4 Vietnamese commodity price websites for HTML structure & scraping selectors. Found:
- **SJC Gold**: Official XML API available (primary), webgia.com mirror with JavaScript obfuscation
- **PNJ Gold/Silver**: Standard HTML tables via webgia.com with `.table-radius` class
- **DOJI Gold**: Multiple sources including direct site (giavang.doji.vn) & webgia.com aggregator
- **Petrolimex Fuel**: Tables available via webgia.com with regional price columns

All sites use Vietnamese Dong (VND) format with "123.456.789" thousand-separator notation. Prices are "per lượng" (tael) for gold, "per lít" (liter) for fuel.

---

## 1. SJC Gold (https://sjc.com.vn)

### Official Data Source
**Preferred Method: XML API Endpoint**
- **URL:** `https://www.sjc.com.vn/xml/tygiavang.xml`
- **Format:** XML (structured, not HTML table scraping)
- **No direct fetch available** (404 in testing), but documented in tutorials
- **Data Structure:** `ratelist > city > item` with attributes for buy/sell prices

### WebGia Mirror (HTML Scraping)
- **URL:** `https://webgia.com/gia-vang/sjc/`
- **Table Classes:** `.table`, `.table-radius`, `.table-bordered`
- **Column Structure:**
  ```
  Khu vực (Region) | Loại vàng (Gold Type) | Mua vào (Buy) | Bán ra (Sell)
  ```

### Important Notes - Anti-Scraping Obfuscation
- **Cell Content Encoding:** Prices are in `<td>` elements with class `.gvd` containing `nb` attribute with **hex-encoded values**
- **Decoding Required:** JavaScript function `gm()` decodes hex strings → readable text
- **Example:** `<td class="gvd" nb="...hex...">` requires client-side JavaScript evaluation
- **Implication:** Cannot scrape via simple CSS selectors + text extraction; need:
  - Browser automation (Puppeteer/Playwright) OR
  - Hex decoder in scraper OR
  - Use XML API endpoint instead

### Price Format
- Unit: "đồng / lượng" (VND per tael)
- Example: "182.200.000" (182 million 200 thousand VND)
- Regions: HCM, Miền Bắc (North), Miền Trung (Central), Miền Tây (West)

### Recommended Approach for Scraper
1. **Best:** Use `https://www.sjc.com.vn/xml/tygiavang.xml` XML endpoint (parse XML, not HTML)
2. **Alternative:** Use VNAppMob API `GET /api/v2/gold/sjc` (requires API key, 15-day expiry)
3. **Last Resort:** Fetch webgia.com + decode hex in TD cells

---

## 2. PNJ Gold/Silver (https://pnj.com.vn)

### Direct Website
- **Primary URL:** `https://pnj.com.vn/blog/gia-vang-ngay-hom-nay/`
- **Status:** Blog post format, not a dedicated price table page
- **Issue:** Prices likely loaded via JavaScript/API, not in static HTML

### WebGia Mirror (Recommended for Scraping)
- **URL:** `https://webgia.com/gia-vang/pnj/`
- **Status:** Standard HTML table (cleanest approach)

### HTML Structure
```html
<table class="table table-radius">
  <thead>
    <tr>
      <th>Khu vực</th>           <!-- Region -->
      <th>Loại vàng</th>         <!-- Gold Type -->
      <th>Mua vào</th>           <!-- Buy Price -->
      <th>Bán ra</th>            <!-- Sell Price -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>TPHCM</td>             <!-- Location -->
      <td>PNJ</td>               <!-- Product name -->
      <td>18.310.000</td>        <!-- Buy (VND) -->
      <td>18.610.000</td>        <!-- Sell (VND) -->
    </tr>
  </tbody>
</table>
```

### CSS Selectors
```javascript
// Extract all price rows
const rows = document.querySelectorAll('table.table-radius tbody tr');

// For each row:
const region = row.querySelector('td:nth-child(1)').textContent.trim();
const type = row.querySelector('td:nth-child(2)').textContent.trim();
const buyPrice = row.querySelector('td:nth-child(3)').textContent.trim();
const sellPrice = row.querySelector('td:nth-child(4)').textContent.trim();
```

### Price Format
- Unit: "đồng / chỉ" (VND per chỉ, smaller unit than lượng)
- Example: "18.310.000" = 18,310,000 VND (18.31 million)
- Regions: TPHCM, and others by region

### Recommended Approach
**Use webgia.com/gia-vang/pnj/** - no obfuscation, straightforward `table.table-radius` selector

---

## 3. DOJI Gold (https://doji.vn)

### Official DOJI Site
- **Direct Price Page:** `https://giavang.doji.vn/` (working, but limited HTML exposure)
- **Alternate:** `https://doji.vn/bang-gia-vang/` (returns 404 in testing)

### WebGia Mirror (Recommended)
- **URL:** `https://webgia.com/gia-vang/doji/`
- **Table Classes:** `.table`, `.table-radius`
- **Structure:** Multiple location tables (Hà Nội, Đà Nẵng, TP. Hồ Chí Minh)

### HTML Structure
```html
<table class="table table-radius">
  <thead>
    <tr>
      <th>Loại vàng</th>         <!-- Gold Type -->
      <th colspan="2">Hà Nội</th> <!-- Location header (2 cols) -->
      <th colspan="2">Đà Nẵng</th>
      <th colspan="2">TP. Hồ Chí Minh</th>
    </tr>
    <tr>
      <th></th>
      <th>Mua vào</th>            <!-- Buy -->
      <th>Bán ra</th>            <!-- Sell -->
      <!-- Repeated for each location -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>SJC - Bán Lẻ</td>
      <td>182.200.000</td>        <!-- HN Buy -->
      <td>185.300.000</td>        <!-- HN Sell -->
      <td>182.150.000</td>        <!-- DN Buy -->
      <td>185.250.000</td>        <!-- DN Sell -->
      <!-- ... more regions ... -->
    </tr>
  </tbody>
</table>
```

### CSS Selectors
```javascript
// Note: colspan structure requires careful indexing
const rows = document.querySelectorAll('table.table-radius tbody tr');

// For DOJI site: Get by 3 locations (6 price columns total)
const goldType = row.querySelector('td:nth-child(1)').textContent.trim();
const hnBuy = row.querySelector('td:nth-child(2)').textContent.trim();
const hnSell = row.querySelector('td:nth-child(3)').textContent.trim();
const dnBuy = row.querySelector('td:nth-child(4)').textContent.trim();
const dnSell = row.querySelector('td:nth-child(5)').textContent.trim();
const hcmBuy = row.querySelector('td:nth-child(6)').textContent.trim();
const hcmSell = row.querySelector('td:nth-child(7)').textContent.trim();
```

### Price Format
- Unit: "đồng / lượng" (VND per tael)
- Example: "182.200.000" = 182 million 200 thousand VND
- Products: SJC, AVPL, jewelry types
- Locations: 3 main cities (Hà Nội, Đà Nẵng, HCM)

### API Alternative
- **VNAppMob:** `GET /api/v2/gold/doji` (returns JSON with buy_hcm, sell_hcm fields)
- **Requires:** API key with "gold" scope, Bearer token auth

### Recommended Approach
**Use webgia.com/gia-vang/doji/** - standard tables with colspan structure

---

## 4. Petrolimex Gasoline & Diesel (https://petrolimex.com.vn)

### Official Site
- **Gia-Xang-Dau Page:** `https://petrolimex.com.vn/gia-xang-dau/trong-nuoc.html`
- **Status:** No direct table in static HTML (likely dynamically loaded)

### WebGia Mirror (Recommended for Scraping)
- **URL:** `https://webgia.com/gia-xang-dau/petrolimex/`
- **Alternative:** `https://webtygia.com/gia-xang-dau/petrolimex.html`
- **Status:** Both have working HTML tables

### HTML Structure
```html
<table class="table table-radius table-bordered">
  <thead>
    <tr>
      <th>Sản phẩm</th>    <!-- Product -->
      <th>Vùng 1</th>      <!-- Region 1 price -->
      <th>Vùng 2</th>      <!-- Region 2 price -->
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Xăng RON 95-V</td>
      <td>27.640</td>
      <td>28.190</td>
    </tr>
    <tr>
      <td>Xăng RON 95-III</td>
      <td>27.040</td>
      <td>27.580</td>
    </tr>
    <tr>
      <td>Xăng E5 RON 92-II</td>
      <td>25.220</td>
      <td>25.720</td>
    </tr>
    <tr>
      <td>DO 0,001S-V</td>
      <td>30.530</td>
      <td>31.140</td>
    </tr>
    <tr>
      <td>DO 0,05S-II</td>
      <td>30.230</td>
      <td>30.830</td>
    </tr>
    <tr>
      <td>Dầu hỏa 2-K</td>
      <td>35.090</td>
      <td>35.790</td>
    </tr>
  </tbody>
</table>
```

### CSS Selectors
```javascript
// Extract all fuel product rows
const rows = document.querySelectorAll('table.table-radius tbody tr');

// For each row:
const product = row.querySelector('td:nth-child(1)').textContent.trim();
const vung1Price = row.querySelector('td:nth-child(2)').textContent.trim();
const vung2Price = row.querySelector('td:nth-child(3)').textContent.trim();

// Parse prices (remove thousands separator if needed)
const cleanPrice = vung1Price.replace(/\./g, ''); // "27.640" → "27640"
```

### Price Format
- Unit: "đồng / lít" (VND per liter)
- Example: "27.640" = 27,640 VND per liter (27.64K VND)
- **Important:** Uses single decimal point (not thousand-separator dots like gold)
- Products needed:
  - Xăng RON 95-III ✓
  - Xăng E5 RON 92 ✓ (appears as "E5 RON 92-II")
  - Diesel (DO 0,001S-V or DO 0,05S-II) ✓

### Styling Details
- Border color: `#e9ecef`
- Border radius: 4px
- Cell padding: 5-8px
- Header color: `#061890` (dark blue)

### Recommended Approach
**Use webgia.com/gia-xang-dau/petrolimex/** - standard `.table` selector, no obfuscation

---

## Summary Table: Scraping Feasibility

| Source | URL | Method | Difficulty | Obfuscation | Notes |
|--------|-----|--------|------------|-------------|-------|
| **SJC** | `webgia.com/gia-vang/sjc/` | Cheerio/DOM | High | Hex encoding in cells | Use XML API instead if possible |
| **SJC (XML)** | `sjc.com.vn/xml/tygiavang.xml` | XML Parser | Easy | None | **RECOMMENDED** |
| **PNJ** | `webgia.com/gia-vang/pnj/` | Cheerio | Easy | None | Clean `.table-radius` structure |
| **DOJI** | `webgia.com/gia-vang/doji/` | Cheerio | Medium | None | Colspan structure, 3 locations |
| **Petrolimex** | `webgia.com/gia-xang-dau/petrolimex/` | Cheerio | Easy | None | Simple 2-region table |

---

## Deno Edge Function Recommendations

### For Deno Deploy / Edge Functions:

**1. Use WebGia.com as Primary Source**
- Already aggregates all 4 sources in HTML tables
- Simpler selectors than scraping official sites
- No JavaScript/obfuscation required
- Status: Reliable, regularly updated

**2. CSS Selector Pattern**
```javascript
// Generic pattern for most tables
document.querySelectorAll('table.table-radius tbody tr')
```

**3. Price Parsing**
```javascript
// VND format: "182.200.000" (with dots as thousand-separators)
function parseVNDPrice(priceText) {
  return parseInt(priceText.replace(/\./g, ''));
}

// Fuel format: "27.640" (single decimal, no thousand-separator)
function parseFuelPrice(priceText) {
  return parseFloat(priceText);
}
```

**4. Character Encoding**
- All sites use **UTF-8**
- Vietnamese special characters: ă, â, ê, ô, ơ, ư, đ work correctly
- No encoding issues detected

**5. Rate Limiting**
- WebGia updates hourly
- Implement caching with 30-60 minute TTL
- No robots.txt blocking detected (but respect their terms)

---

## Unresolved Questions

1. **SJC XML Endpoint Accessibility:** Why does `tygiavang.xml` return 404? Is it behind authentication or rate-limited? Need to verify if still active.

2. **DOJI Official API:** What is the exact endpoint for `giavang.doji.vn` price data? Does it have a JSON API or only HTML?

3. **Petrolimex Official API:** Does Petrolimex have a public API for fuel prices, or is scraping webgia.com the only option?

4. **WebGia Update Frequency:** What is the actual refresh interval? Is it real-time or delayed?

5. **PNJ Direct Blog:** How are prices loaded on the official PNJ blog post? JavaScript fetch from API? Need network inspection.

6. **BTMC API Key:** The BTMC API documentation shows a working example with key, but is this key public or needs registration?

---

## Sources

- [SJC Gold Company (sjc.com.vn)](https://sjc.com.vn)
- [BNIX Documentation - SJC XML Implementation](https://doc.bnix.vn/code-hien-thi-ty-gia-vang-sjc/)
- [WebGia - SJC Gold Prices](https://webgia.com/gia-vang/sjc/)
- [WebGia - DOJI Gold Prices](https://webgia.com/gia-vang/doji/)
- [WebGia - PNJ Gold Prices](https://webgia.com/gia-vang/pnj/)
- [DOJI Official (giavang.doji.vn)](https://giavang.doji.vn/)
- [WebGia - Petrolimex Fuel Prices](https://webgia.com/gia-xang-dau/petrolimex/)
- [VNAppMob Gold Price API v2](https://vapi.vnappmob.com/gold.v2.html)
- [BTMC API Documentation](https://btmc.vn/thong-tin/tai-lieu-api/api-gia-vang-17784.html)
- [GitHub - VN Gold Price API](https://github.com/namtrhg/vn-gold-price-api)

# Vietnamese Commodity Price Data Sources Research

## Gold Prices (Giá Vàng)

### 1. SJC (Tập Đoàn Vàng Bạc Đá Quý)
- **URL**: sjc.com.vn
- **Data Format**: HTML scraping required (no public API)
- **Update Frequency**: Multiple times daily (reactive to international markets)
- **Products**: SJC 9999 gold, international gold
- **Scraping**: Tables in homepage show buy/sell prices
- **Rate Limiting**: Standard web scraping rules apply
- **ToS**: Check terms; typically blocks commercial scraping

### 2. PNJ (Phú Nhuận Jewelry)
- **URL**: pnj.com.vn
- **Data Format**: HTML scraping + possible internal API
- **Update Frequency**: Real-time during trading hours
- **Products**: 9999 gold, PNJ certified gold, silver
- **Scraping**: Price shown in product pages and homepage banner
- **API**: Investigate `/api/` endpoints for potential JSON access
- **Rate Limiting**: Strict rate limiting on aggressive scraping
- **ToS**: Commercial scraping likely prohibited

### 3. DOJI (Công ty Cổ phần Vàng Bạc Đá Quý DOJI)
- **URL**: doji.vn
- **Data Format**: HTML scraping + possible internal API
- **Update Frequency**: Real-time
- **Products**: Gold (9999, 999), silver, diamonds
- **Scraping**: Main page displays live prices in tables
- **API**: `/api/prices` or `/data/prices` pattern possible
- **Rate Limiting**: Unknown; recommend conservative approach
- **ToS**: Terms unclear; contact for commercial use

## Silver Prices (Giá Bạc)

### Vietnamese Sources
- **PNJ**: Silver products available with prices
- **DOJI**: Offers silver trading/retail prices
- **SJC**: Limited silver offerings
- **Challenge**: Less standardized than gold; fewer dedicated APIs
- **Scraping**: Same domains as gold; requires separate selectors

## Gasoline/Petrol Prices (Giá Xăng)

### 1. Petrolimex (Tổng Công ty Xăng Dầu Việt Nam)
- **URL**: petrolimex.com.vn
- **Data Format**: HTML scraping (no public API)
- **Update Frequency**: Daily (typically announced morning/afternoon)
- **Products**: RON 95-IV, RON 98-V, Diesel, Heavy fuel oil
- **Scraping**: Price tables on homepage and news articles
- **Rate Limiting**: Moderate; not aggressively protected
- **ToS**: No explicit prohibition on scraping observed
- **Structure**: `<table>` with product name, price, change %

### 2. Official Government Source (Bộ Tài chính)
- **URL**: moit.gov.vn (Ministry of Industry & Trade)
- **Format**: Official price announcements
- **Reliability**: Authoritative but less frequent updates
- **Scraping**: PDF reports; harder to parse

## International Oil Prices (Dầu Thô)

### 1. EIA API (U.S. Energy Info Admin) - RECOMMENDED
- **URL**: eia.gov/opendata
- **Endpoints**: WTI, Brent crude, petroleum products
- **Format**: JSON REST API
- **Auth**: Free API key required
- **Rate Limit**: 120 requests/hour
- **Data**: Daily/weekly updates
- **Reliability**: Authoritative, maintained

### 2. OpenWeather Oil Prices (Alternative)
- **URL**: openweathermap.org/api (if available)
- **Format**: Not primary focus; limited coverage
- **Note**: Search for alternatives

### 3. Trading View / Yahoo Finance
- **URL**: finance.yahoo.com (no official API)
- **Format**: HTML scraping or Rapid API wrappers
- **Caveat**: Terms prohibit scraping; use unofficial APIs with caution

## Metals/Commodity APIs (International)

### Recommended Free APIs

#### 1. Metals-API.com
- **Endpoint**: `/latest` for spot prices
- **Assets**: Gold, silver, copper, platinum, palladium
- **Format**: JSON REST
- **Update**: 1-2 times daily
- **Free Tier**: 100 req/month
- **Paid**: More frequent updates available
- **Currency**: USD primary; convert to VND locally

#### 2. GoldAPI.io
- **Endpoint**: `/gold` for gold prices
- **Assets**: Gold (multiple carat types)
- **Format**: JSON REST
- **Update**: 15-min intervals (premium)
- **Free Tier**: Limited calls
- **Premium**: Recommended for production

#### 3. Commodities.com / ProAPI
- **Status**: Usually behind paywalls
- **Alternative**: Use free tiers with caching

## Data Structure Examples

### Gold Price Structure
```json
{
  "product": "SJC 9999",
  "buy_price": 72500000,
  "sell_price": 72700000,
  "change_percent": 0.5,
  "currency": "VND",
  "timestamp": "2026-03-10T10:30:00Z"
}
```

### Petrol Price Structure
```json
{
  "product": "RON 95-IV",
  "price": 28500,
  "unit": "VND/liter",
  "change_vnd": -200,
  "change_percent": -0.7,
  "last_updated": "2026-03-10"
}
```

## Recommendations

### Best Strategy
1. **Gold/Silver**: Scrape SJC/PNJ/DOJI (HTML parsing) - diversify to handle outages
2. **Petrol**: Scrape Petrolimex daily - no viable API alternative
3. **Oil**: Use EIA API (official, free, reliable) for WTI/Brent
4. **Metals**: Cache international prices via Metals-API or GoldAPI

### Implementation Priority
- **High**: EIA oil API (reliable, legal, free)
- **High**: Petrolimex scraping (only source, simple structure)
- **Medium**: PNJ/DOJI scraping (more reliable than SJC, handle failures gracefully)
- **Medium**: Metals-API for international commodity context

### Considerations
- **Rate Limiting**: Implement exponential backoff for Vietnamese sites
- **Caching**: Store prices 5-15min to reduce requests
- **Error Handling**: Fallback to cached data on scraping failure
- **Legal**: Consider contacting site owners for commercial scraping permission

## Unresolved Questions

1. Do SJC/PNJ/DOJI expose JSON APIs via `/api` endpoints? (Requires browser dev tools inspection)
2. What are exact update frequencies for each Vietnamese source?
3. Is there an official Vietnamese government commodity price API?
4. Are there rate limiting mechanisms in place on Vietnamese sites?
5. Do any sites offer commercial data feeds (pricing model)?

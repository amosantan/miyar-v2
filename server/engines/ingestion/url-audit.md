# V3-01 URL Reachability Audit (2026-02-20)

## Reachable (HTTP 200)
| Connector | Working URL | Notes |
|-----------|------------|-------|
| RAK Ceramics | https://www.rakceramics.com/ | Root works, /en-ae/products returns 404 |
| Emaar | https://www.emaar.com/en/ | Next.js SSR, has JSON data in page |
| DAMAC | https://www.damacproperties.com/en/ | Works |
| Nakheel | https://www.nakheel.com/en/ | Works, 124KB |
| RICS | https://www.rics.org/news-insights/research-and-insights/ | Small (955 bytes), JS-rendered |
| JLL | https://www.jll.com/en/trends-and-insights/research | Works (note: .com not .ae) |
| DSC | https://www.dsc.gov.ae/en-us/Themes/Pages/default.aspx | SharePoint site, needs login for some pages |
| Hafele | https://www.hafele.com/ | Root works, /ae/en/ returns 404 |

## Unreachable
| Connector | URL | Error |
|-----------|-----|-------|
| DERA Interiors | https://derainteriors.ae | DNS resolution failure |
| Dragon Mart | https://www.dragonmart.ae | DNS resolution failure |
| Porcelanosa | https://www.porcelanosa.com/ | 403 Forbidden |
| GEMS Building | https://gemsbuilding.com | DNS resolution failure |

## Strategy
- 8 connectors make real HTTP requests to working URLs
- 4 connectors will fail gracefully (DNS/403) - this is expected and correct behavior per V3-01 spec
- All connectors use BaseSourceConnector.fetch() which handles errors gracefully
- HTML sources use shared LLM extraction prompt template

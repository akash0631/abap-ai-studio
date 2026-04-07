# Pipeline Learnings — Auto-Generated 07-Apr-2026

## Architecture Discovery: Why Dev/QA Didn't Work on v12 APK

**Root Cause:** The v12 HHT app sends JSON POST to the base URL. The old Tomcat middleware
(`192.168.151.40:16080/xmwgw`) can't handle JSON at the root path — it expects
`/xmwgw/ValueXMW` or `/xmwgw/noacljsonrfcadaptor`.

Additionally, the v12 app's `submitRequest()` (line 798) does:
```java
String url = this.URL.substring(0, this.URL.lastIndexOf("/"));
url += "/noacljsonrfcadaptor?bapiname=" + rfc;
```
This strips `/xmwgw` from the URL → sends to `192.168.151.40:16080/noacljsonrfcadaptor`
instead of `/xmwgw/noacljsonrfcadaptor` → 404 → parse error.

**Fix:** Created Cloudflare Worker proxy at `hht-api.v2retail.net`:
- Accepts v12 JSON format at any path
- Routes `/dev` to `sap-api.v2retail.net/api/rfc/proxy?env=dev`
- Routes `/qa` to `sap-api.v2retail.net/api/rfc/proxy?env=qa`
- Handles `index.jsp`, `appversion`, `ping` connectivity checks
- v12.103 APK uses these cloud URLs instead of old Tomcat IPs

**Full connectivity flow:**
```
v12 App → V2 Cloud    → Azure middleware → SAP PROD (existing)
v12 App → Dev Cloud   → hht-api.v2retail.net/dev → CF Worker → RFC Proxy → SAP DEV (new)
v12 App → QA Cloud    → hht-api.v2retail.net/qa  → CF Worker → RFC Proxy → SAP QA (new)
```

## Batch Validation Results

| Batch | RFCs | Passed | Failed | Key Learning |
|-------|------|--------|--------|-------------|
| 1 (Critical) | 6 | 3 | 3 | Stage 5 false positives: params of CALLED FMs flagged as hallucinated |
| 2 (Store ops) | 8 | 8 | 0 | Fixed Stage 5: only check interface block (first 20 lines) |
| **Total** | **14** | **11** | **3** | **Pipeline catches syntax errors, auto-restores from PROD** |

## Incident Log

### Incident 1: ZWM_CRATE_IDENTIFIER_RFC Hallucination
- AI generated fake params (IV_CRATE_NUMBER, EV_CRATE_ID) and fake table (ZWM_CRATES)
- Fixed: Restored from PROD. Added 8-stage pipeline.

### Incident 2: HHT IM_STOCK_TAKE_ID Bug
- Copy-paste: `args.put("IM_STOCK_TAKE_ID", USER)` → fix: `tv_stock_take_id.getText()`
- Lesson: Fix the CALLER (Java app), not the RFC.

### Incident 3: ZSDC_DIRECT_ART_VAL_BARCOD_RFC Hallucination (×2)
- AI rewrote 148/167 lines from scratch. Missing GT_DATA2 global variable.
- Pipeline didn't catch it because Stage 6 didn't test after deploy.
- Fixed: Added syntax test + auto-restore. KB: "ALWAYS read PROD source first."

### Incident 4: APK Parse Error on Dev/QA
- v12 JSON format incompatible with old Tomcat middleware
- v12 strips /xmwgw from URL, Tomcat can't handle JSON at root
- Fixed: Created cloud proxy at hht-api.v2retail.net (CF Worker → RFC Proxy → SAP)

### Incident 5: APK version confusion
- Multiple APK versions uploaded from artifacts vs releases
- Release APKs have proper signing; artifacts may differ
- Fixed: v12.103 built with cloud proxy URLs, verified in binary, uploaded to R2

## Pipeline Fixes Applied

| Version | Change | Date |
|---------|--------|------|
| v1 | Original 8-stage pipeline | 06-Apr-2026 |
| v2 | Stage 6: Syntax test + auto-restore from PROD | 07-Apr-2026 |
| v3 | Stage 5: Only check interface block (first 20 lines) | 07-Apr-2026 |
| v4 | KB: PROD-first rules + incident lessons | 07-Apr-2026 |
| v5 | Anti-patterns: identified SELECT * (5 RFCs), BREAK (7 RFCs) | 07-Apr-2026 |

## Anti-Patterns Found

### SELECT * still common (5 RFCs)
ZADVERB_SAVE_PICK_DATA, ZWM_SAVE_EMPTY_BIN, ZWM_STORE_GET_PICKLIST,
ZWM_STORE_GRC_PUTWAY, ZWM_STORE_HU_GET_DETAILS
→ Replace with explicit field lists

### BREAK statements in production (7 RFCs)
ZWM_STORE_0001_STOCK_TAKE, ZWM_STORE_FLOOR_PUTWAY, ZWM_STORE_GET_PICKLIST,
ZWM_STORE_GRC_PUTWAY, ZWM_STORE_HU_GET_DETAILS, ZWM_PICKLIST_PPPN,
ZWM_TO_CREATE_FROM_GR_DATA
→ Remove all BREAK/BREAK-POINT statements

### Global variables must be preserved
- GT_DATA2 in FG ZSDC_DIRECT_FLR_RFC — shared across FMs
- NEVER remove GT_*/GS_*/GV_* — check PROD for globals before deploying

## Rules (CRITICAL — Memorize)

1. ALWAYS read PROD source FIRST before generating any code
2. ALWAYS test FM after deploy (blank params, check SYNTAX_ERROR)
3. If SYNTAX_ERROR → auto-restore PROD code immediately
4. Stage 5: only check interface block params, not entire code
5. NEVER rewrite >50% of code — optimize FROM existing, don't rewrite
6. NEVER remove global variables (GT_*, GS_*, GV_*)
7. NEVER change error message text
8. NEVER use regex for HTML_B64 — use string find/replace
9. FM name ≠ FG name — ALWAYS check TFDIR.PNAME
10. v12 HHT app needs cloud proxy URLs for Dev/QA — old Tomcat incompatible

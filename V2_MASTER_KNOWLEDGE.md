# V2 Retail — Master Knowledge Base
## Complete System Architecture & Context

> This document is the single source of truth for all V2 Retail technology systems.
> It powers the AI in ABAP AI Studio, HHT Studio, and all Claude API calls.
> Updated: 07-April-2026

---

## THE FULL FLOW (end-to-end)

```
1. Business Requirement Document
        ↓
2. ABAP AI Studio (abap.v2retail.net)
   → Agent Pipeline creates: Tables, RFC, FM, Programs in SAP DEV
   → 8-stage safety pipeline with anti-hallucination
        ↓
3. RFC API (sap-api.v2retail.net)
   → .NET Controller wraps the new RFC as REST API
   → Swagger auto-generated at /swagger
   → IIS on Server .36 → SAP via NCo connector
        ↓
4. SQL Server (Server .28)
   → Data pulled from SAP via RFC API into SQL tables
   → SQL Analyst (v2-sql-analyst worker) for querying
        ↓
5. Data API (v2-data-api worker)
   → REST API to query SQL Server data
   → Consumed by dashboards, apps, reports
        ↓
6. Applications
   → HHT App (Android) → apk.v2retail.net
   → V2 Hub (hub.v2retail.net)
   → Command Center dashboards
   → Nubo (QSR) systems
```

---

## ALL GITHUB REPOS

| Repo | Purpose | Deploy Target | Branch Strategy |
|------|---------|---------------|-----------------|
| akash0631/rfc-api | 148 .NET RFC Controllers + SAP bridge | IIS Server .36 | staging→master, deploy-iis.yml |
| akash0631/abap-ai-studio | ABAP AI Studio (CF Worker + React) | Cloudflare Worker | dev→main, deploy-worker.yml |
| akash0631/v2-android-hht | HHT Android App (Java) | APK → R2 → apk.v2retail.net | main, build-apk.yml |
| akash0631/v2-hht-middleware | HHT Azure Middleware (.NET) | Azure App Service | azure-stable |
| akash0631/HHT_code | Legacy Tomcat middleware (deprecated) | — |
| akash0631/v2ArticleCreation | Article creation tool (TypeScript) | articles.v2retail.net |
| akash0631/binallocation | Picklist allocation logic (Python) | — |

---

## ALL CLOUDFLARE WORKERS (v2kart account bab06c93)

| Worker | Domain | Purpose |
|--------|--------|---------|
| abap-ai-studio | abap.v2retail.net | ABAP AI Development Studio |
| v2-apk-page | apk.v2retail.net | HHT APK download page |
| hht-apk-publisher | hht-apk.v2retail.net | APK publish management |
| v2-hht-dashboard | hht.v2retail.net | HHT fleet monitoring |
| hht-health-monitor | — | Device health checks |
| hht-log-forwarder | — | Log aggregation |
| hht-proxy | — | HHT request proxy |
| hht-rfc-cache | — | RFC response caching |
| hht-rate-limiter | — | Rate limiting |
| hht-stats-aggregator | — | Usage statistics |
| hht-error-alerter | — | Error alerting |
| hht-fleet-dashboard | — | Fleet management |
| v2-central-api | — | Central API gateway |
| v2-data-api | — | SQL Server data API |
| v2-rfc-pipeline | — | RFC pipeline automation |
| v2-sql-analyst | — | SQL query interface |
| v2-sql-studio | — | SQL development studio |
| v2-orchestrator | — | Workflow orchestrator |
| v2-project-hub | — | Project management |
| v2-replenishment | — | Stock replenishment |
| v2-sync-engine | — | Data sync engine |
| nubo-hub | — | Nubo QSR hub |
| nubo-ads-dashboard | — | Meta/Google Ads dashboard |
| nubo-smart-proxy | — | Smart proxy for APIs |

---

## SAP SYSTEM LANDSCAPE

| System | IP | Client | SysID | Usage |
|--------|-----|--------|-------|-------|
| DEV (S4D) | 192.168.144.174 | 210 | S4D | Development |
| QA | 192.168.144.179 | 600 | — | Testing |
| PROD (S4P) | 192.168.144.170 | 600 | S4P | Production (320+ stores) |
| PROD Host | HANACIFO | — | S4P | HANA database |

### SAP Connectivity
- **IIS Server .36** (192.168.151.36:9292) — .NET SAP Connector (NCo)
- **Azure Hybrid Connection** — v2-hht-api.azurewebsites.net → localhost:9080 → SAP
- **Cloudflare Tunnel** — sap-api.v2retail.net → Server .36
- **App Pool**: V2RfcTestPool (recycle when SAP restarts)

### SAP RFC Proxy
```
POST https://sap-api.v2retail.net/api/rfc/proxy         → DEV SAP
POST https://sap-api.v2retail.net/api/rfc/proxy?env=prod → PROD SAP
POST https://sap-api.v2retail.net/api/rfc/proxy?env=qa   → QA SAP
Header: X-RFC-Key: v2-rfc-proxy-2026
```

---

## VERIFIED V2 SAP TABLES

### Custom Z-Tables (VERIFIED to exist)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| ZWM_USR02 | User-plant mapping | BNAME, WERKS |
| ZWM_DC_MASTER | DC configuration | WERKS, LGTYP, LGNUM |
| ZWM_CRATE | Crate-bin mapping | LGPLA, LGTYP, LGNUM, CRATE |
| ZWM_GRT_PUTWAY | GRT putaway tracking | PUTNR, POSNR, CRATE |
| ZWM_DCSTK1 | Stock take header | ST_TAKE_ID, PLANT, LGPLA, CRATE |
| ZWM_DCSTK2 | Stock take detail | ST_TAKE_ID, PLANT, ETENR |
| ZWM_DCSTK3 | Stock take scan data | ST_TAKE_ID, PLANT, BIN, CRATE, ARTICLE |
| ZSDC_FLRMSTR | Floor master (SDC) | WERKS, LGNUM, LGTYP, LGPLA, MAJ_CAT_CD |
| ZSDC_ART_STATUS | Article status | STORE_CODE, ARTICLE_NO |
| ZDISC_ARTL | Discount articles | WERKS, MATNR, EAN11 |
| ZFI02 | Finance GL-vendor map | — |
| ZWM_STK_AUTO_ADJ | Stock auto adjustment config | — |
| ZWM_STK_AUTO_ADJ1 | Stock auto adjustment bin data | — |

### Missing Indexes (CONFIRMED on PROD)
- **ZSDC_FLRMSTR**: No secondary indexes → FIX: CREATE INDEX Z01 (WERKS, LGPLA, MAJ_CAT_CD)
- **ZWM_GRT_PUTWAY**: No secondary indexes → FIX: CREATE INDEX Z01 (CRATE, MBLNR, TANUM)

---

## HHT ANDROID APP

### Architecture
```
Zebra TC-series device → HHT Android App (Java)
    → POST to Azure Middleware (v2-hht-api.azurewebsites.net)
        → SAP via Azure Hybrid Connection
    → OR POST to sap-api.v2retail.net (Cloudflare tunnel)
        → IIS .36 → SAP
```

### Key Files
| File | Purpose |
|------|---------|
| FragmentMSALiveStockTake.java | MSA live stock take (had IM_STOCK_TAKE_ID bug) |
| GRTCrateToMSABin.java | GRT crate to MSA bin operations |
| Scan_Stock_take_Fragment.java | Stock take scanning |
| Stock_Take_Process_Fragment.java | Stock take processing |
| LoginActivity.java | Login + server selection |
| strings.xml | Server URLs (ipAddress array), store names |
| Vars.java | RFC name constants |

### Server Dropdown (v12.101+)
1. V2 Cloud - Live (v2-hht-api.azurewebsites.net/api/hht)
2. Dev - Cloudflare (sap-api.v2retail.net/api/hht)
3. QA - Cloudflare (sap-api.v2retail.net/api/hht/qa)
4. HanaProd Legacy (192.168.144.200:9080)
5. HanaQA Legacy (192.168.151.40:17080)

### Build Pipeline
```
Push to main → GitHub Actions (build-apk.yml)
    → Gradle assembleRelease (signed APK, v2+v3 scheme)
    → Upload artifact + Create GitHub release
    → Upload to R2 (v2retail bucket) → apk.v2retail.net/download
```

### RFC Call Pattern (Java)
```java
// HHT sends RFC calls like this:
JSONObject args = new JSONObject();
args.put("bapiname", Vars.ZWM_STK_ADJ_MSA_BIN);
args.put("IM_WERKS", WERKS);
args.put("IM_USER", USER);
args.put("IM_STOCK_TAKE_ID", tv_stock_take_id.getText().toString());
showProcessingAndSubmit(Vars.ZWM_STK_ADJ_MSA_BIN, REQUEST_SAVE, args);
```

---

## ABAP AI STUDIO (abap.v2retail.net)

### 17 Features
1. Guide — onboarding for new users
2. AI Chat — ask ABAP questions with anti-hallucination
3. Source Viewer — view any program/FM (DEV+PROD fallback)
4. Agent Pipeline — AI writes ABAP from requirements (8-stage)
5. Code Tools — optimize/review/modernize/security/unit tests
6. RFC Tester — SE37 replacement (load params, execute)
7. Where-Used — find callers of any FM/table
8. Error Log — ST22 short dumps
9. Table Viewer — SE16 replacement (read-only)
10. Job Monitor — SM37 replacement
11. Dictionary — SE11 data dictionary
12. Repository — SE80 program browser
13. SQL Console — direct SQL on SAP tables
14. Smart Debugger — paste error, AI reads source, writes fix
15. Code Search — grep across all Z-programs
16. Code Scanner — anti-pattern detector (SELECT *, LOOP, WAIT)
17. HHT Studio — Android app management (status, search, diagnose, deploy)

### 8-Stage Agent Pipeline
```
0. Interface Pre-fetch (reads FUPARAREF from SAP)
1. Coder (AI writes code with V2 KB context)
2. Reviewer (rates /10)
3. Fixer (auto-fix if <8/10)
4. Cross-verify (independent check)
5. Declaration Check (code params match SE37)
6. Syntax Test (deploy to SAP, call FM, catch errors, auto-fix)
7. Interface Validator (final naming check)
```

---

## NAMING CONVENTIONS

### ABAP
- Parameters: IM_ (import), EX_ (export), IT_/ET_ (tables), CH_ (changing)
- NEVER use IV_/EV_ — V2 does NOT use this convention
- Return: EX_RETURN TYPE BAPIRET2
- Error: EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'text' ). RETURN.
- Tables: ZWM_* (warehouse), ZSDC_* (store DC), ZFI_* (finance)

### HHT Android
- RFC calls: args.put("IM_xxx", value)
- Fragments: Fragment*.java per screen
- RFC names: Vars.ZWM_xxx constants

---

## CREDENTIALS & ACCESS

### Cloudflare (v2kart account)
- Account ID: bab06c93e17ae71cae3c11b4cc40240b
- API Token: stored as CF_API_TOKEN in GitHub Secrets
- R2 Bucket: v2retail (serves APK via v2-apk-page worker)
- D1 Database: 43487dc8-c72c-42fc-a901-efafab7b5dd9 (ABAP Studio users)

### GitHub
- Org: akash0631
- Token: stored as secrets in each repo

### ABAP AI Studio
- Admin: akash/admin2026
- Users: managed via Admin tab (D1 database)

### SAP RFC Proxy
- API Key: v2-rfc-proxy-2026 (X-RFC-Key header)

### Azure HHT Middleware
- URL: v2-hht-api.azurewebsites.net
- SAP PROD: HHT_PROD destination (Client 600, BATCHUSER)
- SAP QA: HHT_QA destination (192.168.144.179, Client 600)

---

## INCIDENT HISTORY

| Date | System | Issue | Root Cause | Fix |
|------|--------|-------|------------|-----|
| 07-Apr-2026 | ABAP Studio | ZWM_CRATE_IDENTIFIER_RFC SYNTAX_ERROR | AI hallucinated params (IV_CRATE_NUMBER, ZWM_CRATES table) | Restored original, added 8-stage pipeline |
| 07-Apr-2026 | HHT App | IM_STOCK_TAKE_ID receiving user ID | Copy-paste bug: line 733 used USER instead of tv_stock_take_id | Fixed FragmentMSALiveStockTake.java L733 |
| 06-Apr-2026 | ABAP Studio | Blank page (30 min outage) | re.sub() regex truncated HTML_B64 | Switched to string find/replace |
| 06-Apr-2026 | ABAP Studio | Missing semicolon crash | ]}if( instead of ];if( | Added semicolon |

---

## RFC OPTIMIZATION STATUS

### Critical (55s timeout) — 5 RFCs
All have code saved on GitHub (docs/rfc_optimization/critical_originals + critical_optimized)
- ZWM_CREATE_HU_AND_ASSIGN_TVS
- ZSDC_DIRECT_ART_VAL_BARCOD_RFC
- ZWM_RFC_GRT_PUTWAY_POST
- ZSDC_DIRECT_ART_VAL1_SAVE1_RFC
- NOACL (system error, not RFC)

### High Priority — 35 RFCs
- 9 analyzed (code on GitHub)
- 26 remaining (need source read + optimization)

### Key Findings
- ZSDC_FLRMSTR: 5-table JOIN with missing index → full table scan
- ZWM_GRT_PUTWAY: SELECT * + BAPI_GOODSMVT_CREATE + COMMIT in nested loop
- ZWM_CRATE_GRT_REP_F01: WAIT UP TO 5 SECONDS (line 216)
- LZWM_GRTF01: 2x SELECT *, LZWM_GRTU01: SELECT SINGLE in LOOP

---

## BUILD RULES (CRITICAL)

1. **NEVER use regex for HTML_B64** — string find/replace only
2. **NEVER push untested to main** — dev branch first
3. **NEVER deploy without verifying all components**
4. **CF deploy filename must be index.js** (matches metadata main_module)
5. **GitHub blocks hardcoded tokens** — use env secrets
6. **HHT APK → R2 v2retail bucket** (not nubo)
7. **SAP FMs: FM name ≠ FG name** — always check TFDIR.PNAME


## HHT CONNECTIVITY ARCHITECTURE (CRITICAL)

### Why v12 App Can't Use Old Tomcat URLs
The v12 HHT app sends JSON POST to the base URL. Old Tomcat middleware
(`192.168.151.40:16080/xmwgw`) can't handle JSON at root path.
Also, `submitRequest()` strips the last path segment (`/xmwgw`) from the URL,
so RFC calls go to `192.168.151.40:16080/noacljsonrfcadaptor` (missing `/xmwgw`).

### Current Working Setup (v12.103)
```
PROD:  v2-hht-api.azurewebsites.net/api/hht → Azure Middleware → SAP PROD
DEV:   hht-api.v2retail.net/dev → CF Worker (hht-proxy) → RFC Proxy → SAP DEV
QA:    hht-api.v2retail.net/qa  → CF Worker (hht-proxy) → RFC Proxy → SAP QA
```

### hht-proxy Worker (hht-api.v2retail.net)
- Accepts v12 JSON format at any path
- `/dev` → routes to `sap-api.v2retail.net/api/rfc/proxy?env=dev`
- `/qa` → routes to `sap-api.v2retail.net/api/rfc/proxy?env=qa`
- Default (no path) → routes to DEV
- Handles: `index.jsp`, `appversion`, `ping` (connectivity checks)
- Handles: `noacljsonrfcadaptor` (RFC calls after URL stripping)

### APK Server Dropdown (strings.xml)
```xml
<item>https://v2-hht-api.azurewebsites.net/api/hht (V2 Cloud)</item>
<item>https://hht-api.v2retail.net/dev (Dev Cloud)</item>
<item>https://hht-api.v2retail.net/qa (QA Cloud)</item>
```
NEVER use old Tomcat IPs for v12 — they cause parse errors.

## PIPELINE RULES (FROM INCIDENTS)

1. ALWAYS read PROD source FIRST via RPY_PROGRAM_READ before generating code
2. ALWAYS test FM after deploying (call with blank params, check SYNTAX_ERROR)
3. If SYNTAX_ERROR → auto-restore PROD code immediately (Stage 6 does this)
4. Stage 5: only check params in interface block (first 20 lines), NOT entire code
5. NEVER rewrite >50% of an FM — optimize FROM existing code
6. NEVER remove global variables (GT_*, GS_*, GV_*)
7. NEVER change error message text — business logic depends on exact wording
8. FM name ≠ FG name — ALWAYS check TFDIR.PNAME for correct include name

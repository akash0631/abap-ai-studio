# V2 Retail Technology — Complete Handover Document
## For Claude AI / Claude Code / Development Team

> **Upload this entire file to Claude or Claude Code for full context.**
> Last updated: 07-April-2026 | Author: Akash Agarwal, Technology & Data Lead

---

## 1. SYSTEM ARCHITECTURE — THE FULL FLOW

```
Business Requirement Document
    ↓
ABAP AI Studio (abap.v2retail.net)
    → Agent Pipeline: AI writes ABAP code with 8-stage safety pipeline
    → Deploys to SAP DEV (192.168.144.174, Client 210)
    ↓
SAP S4/HANA
    → DEV: 192.168.144.174, Client 210, SysID S4D
    → QA:  192.168.144.179, Client 600
    → PROD: 192.168.144.170, Client 600, SysID S4P, Host HANACIFO
    ↓
RFC API — IIS Server (192.168.151.36:9292)
    → 148 .NET controllers wrapping SAP RFCs as REST APIs
    → Swagger at sap-api.v2retail.net/swagger
    → SAP connection via NCo (.NET Connector)
    → Supports ?env=dev | ?env=prod | ?env=qa routing
    ↓
SQL Server (Server .28)
    → Data pulled from SAP via RFC API into SQL tables
    ↓
Data API (Cloudflare Workers)
    → REST endpoints for dashboards and apps
    ↓
Applications
    → HHT Android App (apk.v2retail.net) — 1000+ Zebra devices, 320+ stores
    → V2 Hub (hub.v2retail.net) — Command Center
    → HHT Fleet Dashboard (hht.v2retail.net)
    → Article Creation (articles.v2retail.net)
```

---

## 2. ALL GITHUB REPOSITORIES

| Repo | Branch Strategy | Deploy Target | CI/CD |
|------|----------------|---------------|-------|
| `akash0631/rfc-api` | staging → master | IIS Server .36 | deploy-iis.yml |
| `akash0631/abap-ai-studio` | dev → main | CF Worker `abap-ai-studio` | deploy-worker.yml |
| `akash0631/v2-android-hht` | main | APK → R2 → apk.v2retail.net | build-apk.yml |
| `akash0631/v2-hht-middleware` | azure-stable | Azure App Service | Azure DevOps |

### Key Files in Each Repo

**rfc-api:**
- `Controllers/` — 148 .NET controllers, one per RFC
- `docs/rfc_optimization/` — original + optimized RFC code
- `V2_MASTER_KNOWLEDGE.md` — system knowledge base

**abap-ai-studio:**
- `worker/src/index.js` — CF Worker (all backend + embedded frontend)
- `frontend/index.html` — React SPA (17 features)
- `V2_MASTER_KNOWLEDGE.md` — system knowledge base
- `docs/hht_registry.json` — HHT screen→RFC→middleware mapping

**v2-android-hht:**
- `app/src/main/java/com/v2retail/dotvik/dc/` — DC fragments (warehouse)
- `app/src/main/java/com/v2retail/dotvik/store/` — Store fragments
- `app/src/main/res/values/strings.xml` — Server URLs (ipAddress array)
- `app/build.gradle` — Version code + name

**v2-hht-middleware:**
- `Controllers/HHT/HHTController.cs` — Main controller (proxy, sessions, stats)
- `Controllers/HHT/HHTRouter.cs` — 117 opcode → handler mappings
- `Controllers/HHT/HHTBaseHandler.cs` — SAP NCo connection (PROD + QA destinations)
- `Controllers/HHT/Handlers/DC/DCHandlers.cs` — DC operation handlers
- `Controllers/HHT/Handlers/Store/StoreHandlers.cs` — Store operation handlers

---

## 3. SAP RFC PROXY — HOW TO CALL SAP

### Direct RFC Call
```bash
POST https://sap-api.v2retail.net/api/rfc/proxy          # → DEV SAP
POST https://sap-api.v2retail.net/api/rfc/proxy?env=prod  # → PROD SAP
POST https://sap-api.v2retail.net/api/rfc/proxy?env=qa    # → QA SAP
Header: X-RFC-Key: v2-rfc-proxy-2026
Content-Type: application/json
Body: {"bapiname": "RFC_NAME", "IM_PARAM1": "value", ...}
```

### Read Program Source
```json
{"bapiname": "RPY_PROGRAM_READ", "PROGRAM_NAME": "LZWM_BIN_CRATE_IDENTIFIERU02"}
```

### Read Table Data
```json
{"bapiname": "RFC_READ_TABLE", "QUERY_TABLE": "ZWM_USR02", "DELIMITER": "|",
 "OPTIONS": [{"TEXT": "BNAME = 'USER1'"}],
 "FIELDS": [{"FIELDNAME": "BNAME"}, {"FIELDNAME": "WERKS"}]}
```

### Read FM Interface (FUPARAREF)
```json
{"bapiname": "RFC_READ_TABLE", "QUERY_TABLE": "FUPARAREF", "DELIMITER": "|",
 "OPTIONS": [{"TEXT": "FUNCNAME = 'ZWM_CRATE_IDENTIFIER_RFC'"}],
 "FIELDS": [{"FIELDNAME": "PARAMTYPE"}, {"FIELDNAME": "PARAMETER"}, {"FIELDNAME": "STRUCTURE"}]}
```

### Find FM → Include Mapping (TFDIR)
```json
{"bapiname": "RFC_READ_TABLE", "QUERY_TABLE": "TFDIR", "DELIMITER": "|",
 "OPTIONS": [{"TEXT": "FUNCNAME = 'ZWM_CRATE_IDENTIFIER_RFC'"}],
 "FIELDS": [{"FIELDNAME": "FUNCNAME"}, {"FIELDNAME": "PNAME"}, {"FIELDNAME": "INCLUDE"}]}
```
**CRITICAL:** FM name ≠ Function Group name! Example:
- FM: `ZWM_CRATE_IDENTIFIER_RFC`
- FG: `ZWM_BIN_CRATE_IDENTIFIER` (from PNAME: `SAPLZWM_BIN_CRATE_IDENTIFIER`)
- Include: `LZWM_BIN_CRATE_IDENTIFIERU02` (U + include number)

---

## 4. ABAP CODING RULES — CRITICAL FOR AI

### Naming Conventions (V2 SPECIFIC)
- **IMPORT params:** `IM_` prefix (NEVER `IV_`)
- **EXPORT params:** `EX_` prefix (NEVER `EV_`)
- **TABLE params:** `IT_` or `ET_` prefix
- **CHANGING params:** `CH_` prefix
- **Return structure:** `EX_RETURN TYPE BAPIRET2`
- **Error pattern:** `EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'text' ). RETURN.`
- **Tables:** `ZWM_*` (warehouse), `ZSDC_*` (store DC), `ZFI_*` (finance)

### Anti-Hallucination Rules
1. **NEVER invent tables, fields, or parameters.** Only use VERIFIED tables (see Section 5).
2. **ALWAYS read PROD source first** via `RPY_PROGRAM_READ` before generating code. Optimize FROM existing code, NEVER rewrite from scratch.
3. **NEVER use IV_/EV_ naming** — V2 uses IM_/EX_ exclusively.
4. **When modifying existing FM:** keep EXACT parameter names from FUPARAREF.
5. **If unsure about a table/field, say so.** Do NOT guess.
6. **NEVER remove global variables (GT_*, GS_*)** — they are shared across the function group.
7. **NEVER change error message text** — business logic may depend on exact wording.

### Code Quality Rules
- **NEVER** `SELECT *` — always list fields
- **NEVER** `SELECT` inside `LOOP` — use `FOR ALL ENTRIES` or `JOIN`
- **NEVER** `WAIT UP TO` — blocks the work process
- **NEVER** `COMMIT WORK` inside `LOOP` — use after loop
- **NEVER** leave `BREAK` or `BREAK-POINT` in production code
- **ALWAYS** check `SY-SUBRC` after every `SELECT`
- **ALWAYS** validate inputs FIRST, return error if blank
- **ALWAYS** use modern ABAP 7.4+ syntax: `DATA()`, `VALUE #()`, `@DATA`, `|{ }|`

### User-Plant Validation Pattern
```abap
SELECT SINGLE WERKS FROM ZWM_USR02
  INTO @DATA(LV_PLANT)
  WHERE BNAME = @IM_USER AND WERKS = @IM_PLANT.
IF SY-SUBRC NE 0.
  EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'PLANT AND USER DOESN''T MATCH' ).
  RETURN.
ENDIF.
```

---

## 5. VERIFIED SAP TABLES

### Custom Z-Tables (CONFIRMED TO EXIST)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| ZWM_USR02 | User-plant mapping | BNAME, WERKS |
| ZWM_DC_MASTER | DC configuration | WERKS, LGTYP, LGNUM |
| ZWM_CRATE | Crate-bin mapping | LGPLA, LGTYP, LGNUM, CRATE |
| ZWM_GRT_PUTWAY | GRT putaway tracking | PUTNR, POSNR, CRATE (NO secondary index!) |
| ZWM_DCSTK1 | Stock take header | ST_TAKE_ID, PLANT, LGPLA, CRATE |
| ZWM_DCSTK2 | Stock take detail | ST_TAKE_ID, PLANT, ETENR |
| ZWM_DCSTK3 | Stock take scan data | ST_TAKE_ID, PLANT, BIN, CRATE, ARTICLE |
| ZSDC_FLRMSTR | Floor master (NO secondary index!) | WERKS, LGNUM, LGTYP, LGPLA, MAJ_CAT_CD |
| ZSDC_ART_STATUS | Article status | STORE_CODE, ARTICLE_NO, EAN11 |
| ZDISC_ARTL | Discount articles | WERKS, MATNR, EAN11 |
| ZWM_STK_AUTO_ADJ | Stock auto-adjust config | — |

### Standard SAP Tables (commonly used)
MARA, MARM, MAKT, MARC, LQUA, LAGP, VBAK, VBAP, EKKO, EKPO, BKPF, BSEG, LIPS, LIKP, VEKP, VEPO, KNA1, LFA1

### MISSING INDEXES (performance issues)
- **ZSDC_FLRMSTR:** Needs `CREATE INDEX Z01 ON ZSDC_FLRMSTR (WERKS, LGPLA, MAJ_CAT_CD)`
- **ZWM_GRT_PUTWAY:** Needs `CREATE INDEX Z01 ON ZWM_GRT_PUTWAY (CRATE, MBLNR, TANUM)`

---

## 6. THE 8-STAGE AGENT PIPELINE

When generating ABAP code via the Agent Pipeline:

```
Stage 0: INTERFACE PRE-FETCH
  → Read FUPARAREF to get exact parameters
  → Read TFDIR to find correct include name
  → Read PROD source via RPY_PROGRAM_READ
  → This is the code to OPTIMIZE, not rewrite

Stage 1: CODER
  → AI generates optimized code FROM the existing PROD source
  → Uses V2 Knowledge Base (naming, tables, patterns)
  → Must keep same interface, same error messages

Stage 2: REVIEWER
  → Checks: no SELECT *, no SELECT in LOOP, no WAIT UP TO
  → Checks: uses VALUE #(), inline DATA(), SY-SUBRC checks
  → Rates /10

Stage 3: FIXER
  → If score < 8/10, auto-fixes issues

Stage 4: CROSS-VERIFY
  → Independent check of logic against requirements

Stage 5: DECLARATION CHECK
  → Compares generated code params against FUPARAREF
  → Catches hallucinated params (IV_*, EV_*, non-existent tables)

Stage 5.5: PROD COMPARISON (to be added)
  → Compares against PROD code
  → Flags if >50% of lines changed
  → Flags if global variables removed

Stage 6: SYNTAX TEST
  → Deploys to SAP DEV
  → Calls FM with blank params
  → If SYNTAX_ERROR detected → auto-restores PROD code
  → NEVER leaves broken code on DEV

Stage 7: INTERFACE VALIDATOR
  → Final check: all IM_/EX_ match SE37 definition
  → Blocks deploy if mismatch
```

---

## 7. HHT ANDROID APP

### Architecture
```
Zebra TC-series device
  → HHT Android App (Java)
    → POST JSON to middleware
      → Azure: v2-hht-api.azurewebsites.net/api/hht (PROD)
      → Tomcat: 192.168.151.40:16080/xmwgw (DEV)
      → Tomcat: 192.168.151.40:17080/xmwgw (QA)
    → Middleware calls SAP via NCo
```

### How HHT Calls RFCs (Java pattern)
```java
JSONObject args = new JSONObject();
args.put("bapiname", Vars.ZWM_STK_ADJ_MSA_BIN);
args.put("IM_WERKS", WERKS);
args.put("IM_USER", USER);
args.put("IM_STOCK_TAKE_ID", tv_stock_take_id.getText().toString());
showProcessingAndSubmit(Vars.ZWM_STK_ADJ_MSA_BIN, REQUEST_SAVE, args);
```

### Common HHT Bugs
**#1 cause: Wrong variable in `args.put()` (copy-paste error)**
- Example: `args.put("IM_STOCK_TAKE_ID", USER)` — sends user ID instead of stock take ID
- Fix: Always fix the CALLER (HHT app), not the RFC
- The fix is always ONE LINE in the Java file

### HHT Build Pipeline
```
Push to main branch → GitHub Actions (build-apk.yml)
  → Gradle assembleRelease (signed APK, v2+v3 scheme)
  → Upload artifact to GitHub
  → Upload to R2 v2retail bucket → apk.v2retail.net/download
```

### Server Dropdown (strings.xml)
```xml
<array name="ipAddress">
    <item>https://v2-hht-api.azurewebsites.net/api/hht (V2 Cloud)</item>
    <item>http://192.168.151.40:16080/xmwgw (Dev)</item>
    <item>http://192.168.151.40:17080/xmwgw (QA)</item>
    <item>http://192.168.144.200:9080/xmwgw (HanaProd)</item>
</array>
```

---

## 8. CLOUDFLARE INFRASTRUCTURE

### Account: v2kart (bab06c93e17ae71cae3c11b4cc40240b)

| Worker | Domain | Purpose |
|--------|--------|---------|
| abap-ai-studio | abap.v2retail.net | ABAP AI Development Studio |
| v2-apk-page | apk.v2retail.net | HHT APK download page |
| v2-hht-dashboard | hht.v2retail.net | HHT fleet monitoring |
| v2-project-hub | hub.v2retail.net | Command Center |

### R2 Bucket: v2retail
- `V2_HHT_Azure_Release.apk` — Live APK (served by v2-apk-page /download)
- `V2_HHT_UI_Redesign.apk` — Redesign APK (served by v2-apk-page /redesign)

### D1 Database: 43487dc8-c72c-42fc-a901-efafab7b5dd9
- ABAP Studio user management (Admin tab)

### Deploy APK to R2 (manual)
```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/bab06c93.../r2/buckets/v2retail/objects/V2_HHT_Azure_Release.apk" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @V2_HHT_Azure_Release.apk
```

---

## 9. BUILD RULES (CRITICAL — MEMORIZE THESE)

1. **NEVER use regex (`re.sub`) for HTML_B64 replacement** — use string find/replace. Regex truncates large base64 strings.
2. **NEVER push untested code to main** — use dev branch first.
3. **CF Worker deploy filename must be `index.js`** — matches metadata main_module.
4. **GitHub blocks hardcoded tokens** — use environment secrets.
5. **HHT APK uploads to R2 `v2retail` bucket** (not nubo, not eatnubo).
6. **SAP FM name ≠ FG name** — always check TFDIR.PNAME.
7. **After deploying ABAP code, ALWAYS call the FM to test** — never assume it works.
8. **ABAP AI Studio uses string find/replace for build** — the HTML is base64-encoded and embedded in the worker JS.

---

## 10. INCIDENT HISTORY — LEARN FROM THESE

### Incident 1: ZWM_CRATE_IDENTIFIER_RFC Hallucination (07-Apr-2026)
- **What:** Agent Pipeline deployed AI code with fake params (`IV_CRATE_NUMBER`, `EV_CRATE_ID`) and fake table (`ZWM_CRATES`)
- **Impact:** SYNTAX_ERROR dump on every call. Last changed by POWERBI.
- **Root cause:** AI generated code without reading existing interface. No syntax test after deploy.
- **Fix:** Restored original 96-line code from PROD. Added 8-stage pipeline.
- **Lesson:** Always read FUPARAREF before generating. Always test after deploy.

### Incident 2: HHT IM_STOCK_TAKE_ID Bug (07-Apr-2026)
- **What:** `FragmentMSALiveStockTake.java` line 733 sent `USER` variable in `IM_STOCK_TAKE_ID` field
- **Impact:** Stock take MSA bin adjustment queried wrong data silently (no error, just empty results)
- **Root cause:** Copy-paste error — line 732 correctly sends USER for IM_USER, developer copied it for next line
- **Fix:** Changed `USER` to `tv_stock_take_id.getText().toString()` on line 733
- **Lesson:** Fix the CALLER (HHT app), not the RFC. One-line fix.

### Incident 3: ZSDC_DIRECT_ART_VAL_BARCOD_RFC Hallucination (07-Apr-2026)
- **What:** Agent Pipeline deployed AI-rewritten code (167 lines) replacing working PROD code (175 lines)
- **Impact:** SYNTAX_ERROR on every call. 148 of 167 lines different from PROD.
- **Root cause:** AI rewrote entire FM from scratch instead of optimizing. Missing GT_DATA2 global variable.
- **Fix:** Restored PROD code. Added syntax test + auto-restore to pipeline.
- **Lesson:** ALWAYS read PROD source first. NEVER rewrite >50% of code.

### Incident 4: Blank Page — Regex Crash (06-Apr-2026)
- **What:** `re.sub()` used for HTML_B64 replacement in build script
- **Impact:** 30-minute outage, blank page on abap.v2retail.net
- **Root cause:** Python regex engine can't handle 100KB+ base64 strings
- **Fix:** Switched to string find/replace
- **Lesson:** NEVER use regex on HTML_B64.

---

## 11. RFC OPTIMIZATION STATUS

### Critical (55s timeout) — 5 RFCs
| RFC | Root Cause | Status |
|-----|-----------|--------|
| ZSDC_DIRECT_ART_VAL_BARCOD_RFC | 5-table JOIN, ZSDC_FLRMSTR no index | Optimized on PROD |
| ZWM_RFC_GRT_PUTWAY_POST | SELECT *, BAPI+COMMIT in loop | Code on GitHub |
| ZWM_CRATE_IDENTIFIER_RFC | SELECT SINGLE + GROUP BY | Optimized, deployed to DEV |
| ZSDC_DIRECT_ART_VAL1_SAVE1_RFC | Large transaction | Code on GitHub |
| ZWM_CREATE_HU_AND_ASSIGN_TVS | Complex putaway | Code on GitHub |

### High Priority — 26 remaining
ZWM_STORE_GRT_FROM_DISP_AREA, ZWM_APP_ARTICLE_SA_RETAIL_APP, ZDIS_HU_DC_HUB_PRO_RFC, ZWM_PO_SCAN_DATA_SAVE, ZFM_HU_WGT, ZWM_RFC_STOCK_TAKE_ARTI_VALI, ZWM_VALI_CRATE_EMPTYBIN, ZWM_PO_GET_DETAILS, ZWM_VALIDATE_CRATE, ZWM_TVS_VAL_EXTERNAL_HU, ZWM_CLA_PALETTE_VALIDATE, ZWM_RFC_STORE_EAN_DATA_STK, ZFMS_SCREEN, ZWM_GET_PACKING_MATERIAL, SCNREC, ZFM_HU_WGT_SAVE, ZWM_SAVE_EMPTY_BIN, ZWM_STORE_GET_STOCK, ZWM_VALIDATE_EMPTY_BIN, ZWM_CLA_HU_VALIDATE, ZSDC_DIRECT_FLR_RFC, ZSTORE_DISCOUNT_GET_EAN_DATA (254K calls!), ZWM_LIVE_STOCK_SCANNING, ZWM_VALIDATE_PURCHASE_ORDER

---

## 12. CREDENTIALS & ACCESS

| System | Credential |
|--------|-----------|
| ABAP AI Studio | akash/admin2026 (Admin), bhavesh/developer |
| SAP RFC Proxy | Header: `X-RFC-Key: v2-rfc-proxy-2026` |
| Cloudflare (v2kart) | Account ID: `bab06c93e17ae71cae3c11b4cc40240b` |
| D1 Database | `43487dc8-c72c-42fc-a901-efafab7b5dd9` |
| IIS Server | 192.168.151.36:9292, App Pool: V2RfcTestPool |
| Azure HHT MW | v2-hht-api.azurewebsites.net (SAP: BATCHUSER) |

---

## 13. COMMON TASKS — HOW TO DO THEM

### Read any RFC source code
1. Find include: Query TFDIR for PNAME + INCLUDE number
2. Include name: `L<FG_NAME>U<INCLUDE_NUM>` (e.g., `LZWM_BIN_CRATE_IDENTIFIERU02`)
3. Read source: Call `RPY_PROGRAM_READ` with the include name
4. Read from PROD: Add `?env=prod` to the proxy URL

### Deploy code to SAP DEV
```
POST https://abap.v2retail.net/pipeline/full-deploy
Auth: Bearer <token from /auth/login>
Body: {
  "fm_name": "ZWM_CRATE_IDENTIFIER_RFC",
  "fg_name": "ZWM_BIN_CRATE_IDENTIFIER",
  "source": "<ABAP code>",
  "short_text": "Description"
}
```
After deploy: Activate in SE80 (Ctrl+F3)

### Build and deploy HHT APK
1. Push code to `akash0631/v2-android-hht` main branch
2. GitHub Actions auto-builds signed APK
3. Download artifact from GitHub Actions
4. Upload to R2: `PUT .../r2/buckets/v2retail/objects/V2_HHT_Azure_Release.apk`
5. Live at apk.v2retail.net/download

### Fix an HHT bug
1. Identify which Fragment (screen) has the bug
2. Read the Java source from GitHub
3. Find the `args.put("IM_xxx", WRONG_VARIABLE)` line
4. Fix to use the correct variable
5. Push to main → build → deploy to R2

### Diagnose a 55s timeout
1. Read the RFC source via RPY_PROGRAM_READ
2. Look for: SELECT *, SELECT in LOOP, missing WHERE, WAIT UP TO, COMMIT in LOOP
3. Check table indexes via DD03L
4. Optimize the query, add indexes if needed

---

## 14. QUICK REFERENCE COMMANDS

### Test an RFC
```bash
curl -X POST https://sap-api.v2retail.net/api/rfc/proxy \
  -H "X-RFC-Key: v2-rfc-proxy-2026" \
  -H "Content-Type: application/json" \
  -d '{"bapiname":"ZWM_CRATE_IDENTIFIER_RFC","IM_USER":"","IM_PLANT":"DH24","IM_CRATE":"C1"}'
```

### Check for syntax errors
If the response contains `Syntax error in program SAPL...` → the deployed code has a bug. Restore from PROD.

### Login to ABAP Studio API
```bash
TOKEN=$(curl -s -X POST https://abap.v2retail.net/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"akash","password":"admin2026"}' | jq -r '.token')
```

### Upload APK to R2
```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/bab06c93.../r2/buckets/v2retail/objects/V2_HHT_Azure_Release.apk" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @app.apk
```

---

## 15. WHAT TO TELL CLAUDE / CLAUDE CODE

When starting a new conversation about V2 Retail, paste this prompt:

```
I work at V2 Retail (320+ stores, S4/HANA). Here are the key rules:
- SAP naming: IM_ (import), EX_ (export). NEVER IV_/EV_.
- Return: EX_RETURN TYPE BAPIRET2
- RFC proxy: POST sap-api.v2retail.net/api/rfc/proxy (Header: X-RFC-Key: v2-rfc-proxy-2026)
- ALWAYS read PROD source first before modifying any RFC
- ALWAYS test FM after deploying (call with blank params)
- NEVER invent tables or parameters — verify from FUPARAREF
- Verified tables: ZWM_USR02, ZWM_CRATE, ZWM_DCSTK1/2/3, ZSDC_FLRMSTR, ZWM_DC_MASTER
- FM name ≠ FG name — check TFDIR.PNAME for the correct include
- HHT bugs: fix the CALLER (Java app), not the RFC
```

---

*This document is the single source of truth. Save it in all repos. Update after every incident.*

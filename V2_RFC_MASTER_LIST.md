# V2 Retail — Complete RFC & API Master List
## Every RFC and endpoint that enables Claude to develop on SAP

---

## LAYER 1: SAP Standard RFCs (already exist, Claude uses directly)

| RFC | What Claude does with it | Status |
|-----|-------------------------|--------|
| `RPY_PROGRAM_READ` | Reads source code of any ABAP program/include | ✅ Working |
| `RPY_PROGRAM_UPDATE` | Uploads/overwrites source code to any include | ✅ Working |
| `RFC_READ_TABLE` | Reads any SAP table — TFDIR, FUPARAREF, DD03L, DD02L, ZWM_*, etc. | ✅ Working |
| `RS_FUNCTIONMODULE_INSERT` | Creates new FM inside an existing Function Group | ✅ Working |
| `RS_FUNCTION_POOL_INSERT` | Creates new Function Group (but needs TADIR + activation) | ✅ Partial |
| `RS_WORKING_OBJECTS_ACTIVATE` | Activates programs and objects | ✅ Working |
| `TR_TADIR_INTERFACE` | Registers objects in SAP repository (TADIR) | ✅ Working |
| `BAPI_TRANSACTION_COMMIT` | Commits after BAPI calls | ✅ Working |

## LAYER 2: RFC Proxy (sap-api.v2retail.net — IIS .NET on Server .36)

| Endpoint | What it does |
|----------|-------------|
| `POST /api/rfc/proxy` | Calls ANY RFC on SAP DEV (default) |
| `POST /api/rfc/proxy?env=prod` | Calls ANY RFC on SAP PROD |
| `POST /api/rfc/proxy?env=qa` | Calls ANY RFC on SAP QA |
| `POST /api/rfc/deploy` | Deploys source code to SAP include |
| `GET /swagger` | API documentation (148 controllers) |
| **Header:** `X-RFC-Key: v2-rfc-proxy-2026` | Authentication |

## LAYER 3: ABAP AI Studio (abap.v2retail.net — Cloudflare Worker)

### Authentication
| Endpoint | What it does |
|----------|-------------|
| `POST /auth/login` | Get JWT token (akash/admin2026) |
| `GET /auth/me` | Check current user |

### AI Features (Claude-powered)
| Endpoint | What it does |
|----------|-------------|
| `POST /claude` | AI Chat — proxies to Anthropic API with full V2 knowledge base |
| `POST /pipeline` | Agent Pipeline — AI generates ABAP code with 8-stage safety |
| `POST /pipeline/full-deploy` | Deploy code to SAP (upload source + verify) |
| `POST /pipeline/smart-deploy` | Smart deploy with AI review |
| `POST /pipeline/smart-optimize` | AI reads existing RFC and optimizes it |
| `POST /pipeline/generate-tests` | AI generates test cases for FM |
| `POST /sap/smart-debug` | AI debugs SAP errors with full context |
| `POST /sap/auto-doc` | AI generates documentation for any FM |
| `POST /sap/bulk-scan` | Scan multiple RFCs for anti-patterns (SELECT *, BREAK, etc.) |
| `POST /hht/diagnose` | AI diagnoses HHT Android bugs |

### SAP Development
| Endpoint | What it does |
|----------|-------------|
| `POST /sap/smart-source` | Read FM source with AI analysis |
| `POST /sap/smart-search` | Smart search across SAP objects |
| `POST /sap/rfc-execute` | Execute any RFC via proxy (used by Plant Creator, etc.) |
| `POST /sap/rfc-params` | Read FM interface params from FUPARAREF |
| `POST /sap/code-search` | Search ABAP code across programs |
| `POST /sap/table-data` | Read any SAP table data |
| `POST /sap/error-log` | Read SAP error logs (ST22 dumps) |
| `POST /sap/where-used` | Where-used analysis for objects |
| `POST /sap/jobs` | Monitor background jobs (SM37) |
| `POST /sap/create-fg` | Create function group |
| `POST /sap/create-fm` | Create function module |
| `POST /sap/create-table` | Create Z table |
| `POST /sap/activate` | Activate program/object |
| `POST /diagnostics` | SAP system diagnostics |

### HHT Android Development
| Endpoint | What it does |
|----------|-------------|
| `GET /hht/status` | HHT middleware status + device count |
| `POST /hht/search` | Search HHT Java codebase on GitHub |
| `POST /hht/read` | Read HHT Java source from GitHub |
| `POST /hht/deploy-apk` | Deploy APK to R2 bucket |
| `GET /hht/registry` | Screen → RFC → middleware mapping (50 screens, 37 RFCs) |

### Other
| Endpoint | What it does |
|----------|-------------|
| `POST /repo/search` | Search GitHub repos for code |
| `GET /health` | Worker health check |

## LAYER 4: HHT Dev/QA Proxy (hht-api.v2retail.net — Cloudflare Worker)

| Endpoint | What it does |
|----------|-------------|
| `POST /dev` | Route HHT JSON to SAP DEV (v12 compatible) |
| `POST /qa` | Route HHT JSON to SAP QA (v12 compatible) |
| `GET /health` | Health check |
| `GET /appversion` | APK version info |
| `GET /index.jsp` | Connectivity check (HHT app startup) |

## LAYER 5: Universal MCP Server (universal-mcp.akash-bab.workers.dev)

| Tool | What it does |
|------|-------------|
| `abap_read_source` | Read FM source from SAP (auto-finds include via TFDIR) |
| `abap_read_interface` | Read FM params from FUPARAREF |
| `abap_test_fm` | Test FM with blank params, check for SYNTAX_ERROR |
| `abap_studio_status` | ABAP Studio health |
| `github_akash_repos` | All akash0631 repos |
| + 31 more tools | ARS, HHT, SQL, Cloudflare, Azure, Nubo, GitHub |

## LAYER 6: MISSING — ZDEV_TOOLS_RFC (needs one-time manual creation)

| IM_ACTION | What Claude could do | Currently |
|-----------|---------------------|-----------|
| `CREATE_FG` | Create any new Function Group remotely | ❌ Needs SE80 |
| `CREATE_FM` | Create any new Function Module remotely | ❌ Needs SE37 |
| `DEPLOY_SOURCE` | Upload source + find include automatically | ✅ Partial (via pipeline) |
| `ACTIVATE` | Activate any program remotely | ❌ Needs Ctrl+F3 |
| `CREATE_AND_DEPLOY` | All-in-one: FG + FM + code + activate | ❌ Not possible yet |

**Once Bhavesh creates ZDEV_TOOLS_RFC → Claude never needs SE80/SE37 again.**

## SAP TABLES CLAUDE QUERIES

| Table | What Claude reads from it |
|-------|--------------------------|
| `TFDIR` | FM name → Function Group → Include number |
| `FUPARAREF` | FM interface: param names, types, optional flags |
| `TLIBG` | Function group directory (check if FG exists) |
| `TADIR` | Repository object directory |
| `DD03L` | Table field definitions (verify fields exist before using) |
| `DD02L` | Table definitions (verify tables exist) |
| `ZWM_USR02` | V2 user-plant mapping |
| `T001W` | Plant master data |

## HOW IT ALL CONNECTS

```
You ask Claude → Claude reads PROD source (RPY_PROGRAM_READ via RFC proxy)
    → AI generates optimized code (8-stage pipeline)
    → Deploys to SAP DEV (RPY_PROGRAM_WRITE via pipeline/full-deploy)
    → Tests with blank params (calls FM via RFC proxy)
    → If SYNTAX_ERROR → auto-restores PROD code
    → If OK → Bhavesh activates in SE80 (Ctrl+F3)
    → [After ZDEV_TOOLS_RFC] → Claude activates too, no Bhavesh needed
```

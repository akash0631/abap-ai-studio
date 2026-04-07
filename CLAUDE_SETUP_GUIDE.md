# V2 Retail — Claude Setup Guide for Team
## How to give Claude the same access Akash has

---

## WHY YOUR CLAUDE FAILED

Your Claude said "I can't directly trigger the pipeline" because you used **plain Claude.ai chat** which has no ability to run commands. Akash's Claude works because he has **Code Execution** enabled — this gives Claude a Linux container where it can run curl, Python, and bash commands to call our APIs.

All V2 APIs are **PUBLIC Cloudflare Workers** — accessible from anywhere on the internet:
- `sap-api.v2retail.net` — SAP RFC proxy (public)
- `abap.v2retail.net` — ABAP AI Studio (public)
- `apk.v2retail.net` — HHT APK download (public)
- `hub.v2retail.net` — Command Center (public)

---

## OPTION 1: Claude.ai with Code Execution (RECOMMENDED)

### Step 1: Enable Code Execution
1. Go to `claude.ai` → Settings (gear icon)
2. Turn ON **"Code Execution and File Creation"**
3. This gives Claude a Linux container with bash, Python, curl, node

### Step 2: Create a Project
1. Go to `claude.ai` → Projects → Create Project
2. Name: "V2 Retail Development"
3. In Project Knowledge, upload `V2_COMPLETE_HANDOVER.md` (from any GitHub repo)
4. In Project Instructions, paste this:

```
You are the V2 Retail technology assistant. You have access to:
- SAP RFC Proxy: POST https://sap-api.v2retail.net/api/rfc/proxy (Header: X-RFC-Key: v2-rfc-proxy-2026)
- ABAP AI Studio: https://abap.v2retail.net (login: use /auth/login endpoint)
- HHT APK: https://apk.v2retail.net
- Hub: https://hub.v2retail.net

CRITICAL RULES:
1. ALWAYS use bash_tool/curl to call APIs — you CAN reach these URLs
2. ALWAYS read PROD source first before modifying any RFC
3. ALWAYS test FM after deploying (call with blank params)
4. NEVER invent tables or parameters — verify from FUPARAREF
5. V2 naming: IM_ (import), EX_ (export). NEVER IV_/EV_
6. FM name ≠ FG name — check TFDIR.PNAME

To read RFC source:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"RPY_PROGRAM_READ","PROGRAM_NAME":"<INCLUDE_NAME>"}'

To deploy code:
TOKEN=$(curl -s -X POST https://abap.v2retail.net/auth/login -H "Content-Type: application/json" -d '{"username":"akash","password":"admin2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
curl -s -X POST https://abap.v2retail.net/pipeline/full-deploy -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"fm_name":"<FM>","fg_name":"<FG>","source":"<CODE>","short_text":"<DESC>"}'

To test FM:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"<FM_NAME>"}'
```

### Step 3: Use it
Now when you ask Claude to "optimize ZWM_CRATE_IDENTIFIER_RFC", it will:
1. Read the source from SAP using curl
2. Generate optimized code
3. Deploy via the pipeline using curl
4. Test with blank params using curl
5. Report results

---

## OPTION 2: Claude Code (CLI)

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Run from your project directory
cd ~/v2-retail
claude

# Tell it about V2
> Read V2_COMPLETE_HANDOVER.md and use it as context for all V2 work
```

Claude Code runs commands directly on YOUR machine — it can reach all V2 APIs.

---

## OPTION 3: Use ABAP AI Studio directly

No Claude setup needed! Just use `abap.v2retail.net`:
- **AI Chat** tab — ask any ABAP question with full V2 context
- **Agent Pipeline** tab — generate and deploy code with 8-stage safety
- **HHT Studio** tab — diagnose HHT bugs, deploy APK
- **Smart Debug** tab — paste an error, AI reads source and diagnoses

Login: akash/admin2026 or bhavesh/developer

---

## COMMON MISTAKES

| Mistake | Fix |
|---------|-----|
| "I can't access the API" | Enable Code Execution in Claude.ai settings |
| "I don't have a connection" | All URLs are PUBLIC — use curl |
| AI uses IV_/EV_ params | Wrong! V2 uses IM_/EX_ — check handover doc |
| AI invents tables | NEVER! Only use verified tables from Section 5 |
| AI rewrites entire FM | ALWAYS read PROD source first, optimize FROM it |
| Deploy without testing | ALWAYS call FM after deploy to check SYNTAX_ERROR |

---

## QUICK TEST — Verify Your Claude Can Reach V2 APIs

Ask your Claude to run this:
```
Run this curl command and tell me the result:
curl -s https://abap.v2retail.net/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"akash","password":"admin2026"}'
```

If Claude returns a JSON token, it has access. If Claude says "I can't run commands", enable Code Execution.

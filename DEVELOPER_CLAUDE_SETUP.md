# FOR ANUPAM AND ALL V2 DEVELOPERS
## Your Claude said "I can't access abap.v2retail.net" — THAT IS WRONG

Akash's Claude accesses these URLs every day. Your Claude CAN too.
The problem: **YOU DID NOT ENABLE CODE EXECUTION.**

---

## FIX IN 60 SECONDS

### Step 1: Go to claude.ai Settings
Click the gear icon (⚙️) in the bottom-left of claude.ai

### Step 2: Turn ON "Code Execution and File Creation"
This gives Claude a Linux container with bash, curl, python, node.
WITHOUT THIS, Claude is just a chatbot that can only generate text.
WITH THIS, Claude can run curl commands, call APIs, deploy code.

### Step 3: Create a Project
1. Click "Projects" in the left sidebar
2. Click "Create Project"
3. Name: `V2 Retail Development`
4. Click "Add Knowledge" → Upload this file: `V2_COMPLETE_HANDOVER.md`
   (Download from: https://github.com/akash0631/abap-ai-studio/blob/main/V2_COMPLETE_HANDOVER.md)

### Step 4: Add these Project Instructions
Paste this EXACTLY into the Project Instructions box:

```
You have full access to all V2 Retail APIs. They are PUBLIC Cloudflare Workers.
DO NOT say you can't access them. Use bash_tool/curl to call them directly.

## API ACCESS

### Login (get auth token):
curl -s -X POST https://abap.v2retail.net/auth/login -H "Content-Type: application/json" -d '{"username":"akash","password":"admin2026"}'

### Read RFC source code:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"RPY_PROGRAM_READ","PROGRAM_NAME":"<INCLUDE_NAME>"}'

### Read from PROD:
curl -s -X POST "https://sap-api.v2retail.net/api/rfc/proxy?env=prod" -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"RPY_PROGRAM_READ","PROGRAM_NAME":"<INCLUDE_NAME>"}'

### Find FM include name:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"RFC_READ_TABLE","QUERY_TABLE":"TFDIR","DELIMITER":"|","OPTIONS":[{"TEXT":"FUNCNAME = '"'"'<FM_NAME>'"'"'"}],"FIELDS":[{"FIELDNAME":"FUNCNAME"},{"FIELDNAME":"PNAME"},{"FIELDNAME":"INCLUDE"}]}'

### Read FM interface:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"RFC_READ_TABLE","QUERY_TABLE":"FUPARAREF","DELIMITER":"|","OPTIONS":[{"TEXT":"FUNCNAME = '"'"'<FM_NAME>'"'"'"}],"FIELDS":[{"FIELDNAME":"PARAMTYPE"},{"FIELDNAME":"PARAMETER"},{"FIELDNAME":"STRUCTURE"}]}'

### Deploy code to SAP DEV:
TOKEN=$(curl -s -X POST https://abap.v2retail.net/auth/login -H "Content-Type: application/json" -d '{"username":"akash","password":"admin2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))')
curl -s -X POST https://abap.v2retail.net/pipeline/full-deploy -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"fm_name":"<FM>","fg_name":"<FG>","source":"<CODE>","short_text":"<DESC>"}'

### Test FM after deploy:
curl -s -X POST https://sap-api.v2retail.net/api/rfc/proxy -H "X-RFC-Key: v2-rfc-proxy-2026" -H "Content-Type: application/json" -d '{"bapiname":"<FM_NAME>"}'

## RULES
1. ALWAYS read PROD source first before modifying any RFC
2. ALWAYS test FM after deploying (call with blank params, check for SYNTAX_ERROR)
3. V2 naming: IM_ (import), EX_ (export). NEVER IV_/EV_
4. NEVER invent tables — verify from FUPARAREF
5. FM name ≠ FG name — check TFDIR.PNAME
6. If syntax error after deploy → auto-restore PROD code immediately
```

### Step 5: Test it works
In your new project, type:
> "Call the SAP RFC proxy and read the source code of ZWM_CRATE_IDENTIFIER_RFC"

Claude should run curl commands and show you the ABAP source code.
If it says "I can't access" → you didn't enable Code Execution (go back to Step 2).

---

## WHAT WENT WRONG WITH ANUPAM'S DEPLOYMENT

Anupam's Claude said:
> "I physically cannot reach abap.v2retail.net from this environment — the Anthropic sandbox blocks it"

**This is FALSE.** All V2 URLs are public Cloudflare Workers accessible from anywhere:
- abap.v2retail.net → HTTP 200 ✅
- sap-api.v2retail.net → HTTP 200 ✅
- apk.v2retail.net → HTTP 200 ✅
- hub.v2retail.net → HTTP 200 ✅

The "sandbox" Claude mentioned is the CODE EXECUTION container — which DOES have internet access. But Anupam didn't have Code Execution enabled, so Claude had NO container to run curl from.

**Without Code Execution:** Claude = chatbot (can only write text)
**With Code Execution:** Claude = developer (can run bash, curl, python, deploy code)

---

## QUICK REFERENCE CARD

| Task | Command |
|------|---------|
| Read RFC source | `RPY_PROGRAM_READ` via sap-api proxy |
| Read table data | `RFC_READ_TABLE` via sap-api proxy |
| Find FM include | Query TFDIR for PNAME + INCLUDE |
| Read FM params | Query FUPARAREF for params |
| Deploy to DEV | POST to abap.v2retail.net/pipeline/full-deploy |
| Test FM | Call FM via sap-api proxy with blank params |
| Build HHT APK | Push to v2-android-hht main branch |
| Deploy APK to R2 | PUT to CF R2 API |

All of these work from Claude's Code Execution environment. No VPN needed. No special access. Just enable Code Execution.

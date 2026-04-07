# EXACT Setup to Give Anupam the Same Claude as Akash
## This is Claude.ai — NOT Claude Code

Akash uses claude.ai (web browser). His Claude deploys code, manages Cloudflare Workers, calls SAP APIs, builds APKs — all from the browser. Anupam needs the EXACT same setup.

---

## STEP 1: Claude.ai Plan
Anupam needs **Claude Pro** or **Claude Team** plan.
- Go to claude.ai → Settings → Subscription
- If on Free plan, upgrade to Pro ($20/month)

## STEP 2: Enable Features (Settings → Feature Preview)
Go to claude.ai → Settings (gear icon bottom-left) → Toggle ON:

| Feature | What it does |
|---------|-------------|
| **Code Execution and File Creation** | Gives Claude a Linux container with bash, curl, python, node. THIS IS THE KEY ONE. |
| **Artifacts** | Lets Claude create downloadable files |
| **Web Search** | Lets Claude search the internet |

## STEP 3: Connect Cloudflare MCP (Settings → Connected Apps)
Go to claude.ai → Settings → **Integrations** (or "Connected Apps"):

1. Find **"Cloudflare Developer Platform"**
2. Click Connect
3. Login with the V2 Cloudflare account (akash@v2kart.com)
4. Authorize access

This gives Claude DIRECT access to:
- List/deploy/update CF Workers
- Manage R2 buckets
- Query D1 databases
- Manage KV namespaces

**Without this:** Claude uses curl + CF API token (works but slower)
**With this:** Claude manages Workers directly (same as Akash's setup)

## STEP 4: Create a Project with V2 Knowledge
1. Go to claude.ai → **Projects** (left sidebar)
2. Click **"Create Project"**
3. Name: `V2 Retail Development`
4. **Add Knowledge:**
   - Download `V2_COMPLETE_HANDOVER.md` from GitHub:
     https://github.com/akash0631/abap-ai-studio/blob/main/V2_COMPLETE_HANDOVER.md
   - Download `DEVELOPER_CLAUDE_SETUP.md` from GitHub:
     https://github.com/akash0631/abap-ai-studio/blob/main/DEVELOPER_CLAUDE_SETUP.md
   - Upload BOTH files as Project Knowledge

5. **Set Project Instructions** (paste this):

```
You are the V2 Retail technology assistant. You have FULL access to all V2 systems.

DO NOT say "I can't access" or "sandbox blocks it" — ALL URLs are public Cloudflare Workers.
Use bash_tool/curl to call APIs. Use Cloudflare MCP to manage workers directly.

Key APIs:
- SAP RFC Proxy: POST https://sap-api.v2retail.net/api/rfc/proxy
  Header: X-RFC-Key: v2-rfc-proxy-2026
  Body: {"bapiname":"RFC_NAME","IM_PARAM":"value"}
  Add ?env=prod for PROD, ?env=qa for QA (default=DEV)

- ABAP Studio Login: POST https://abap.v2retail.net/auth/login
  Body: {"username":"akash","password":"admin2026"}

- Deploy to SAP: POST https://abap.v2retail.net/pipeline/full-deploy
  Auth: Bearer <token from login>
  Body: {"fm_name":"..","fg_name":"..","source":"..","short_text":".."}

- Upload APK: PUT https://api.cloudflare.com/client/v4/accounts/bab06c93e17ae71cae3c11b4cc40240b/r2/buckets/v2retail/objects/V2_HHT_Azure_Release.apk

RULES:
1. ALWAYS read PROD source FIRST before modifying any RFC
2. ALWAYS test FM after deploy (blank params, check for SYNTAX_ERROR)
3. If syntax error → auto-restore PROD code immediately
4. V2 naming: IM_ (import), EX_ (export). NEVER IV_/EV_
5. NEVER invent tables — verify from FUPARAREF
6. FM name ≠ FG name — check TFDIR.PNAME
```

## STEP 5: Verify It Works
Open the project and type:

> Read the source code of ZWM_CRATE_IDENTIFIER_RFC from SAP PROD

Claude should:
1. Run `curl` to find the include name from TFDIR
2. Run `curl` to read the source via RPY_PROGRAM_READ
3. Display the ABAP code

If Claude says "I can't access" → go back to Step 2 and enable Code Execution.

---

## WHAT AKASH'S CLAUDE HAS (for reference)

| Feature | Status | How |
|---------|--------|-----|
| Code Execution | ✅ ON | Settings → Feature Preview |
| Cloudflare MCP | ✅ Connected | Settings → Integrations → Cloudflare |
| Google Drive MCP | ✅ Connected | Settings → Integrations → Google Drive |
| Gmail MCP | ✅ Connected | Settings → Integrations → Gmail |
| V2 Knowledge Base | ✅ Uploaded | Project Knowledge files |
| Project Instructions | ✅ Set | API endpoints + rules |

Anupam needs ALL of the above. Once set up, his Claude will be identical to Akash's.

---

## COMMON MISTAKE

❌ **"I can't reach the API"** = Code Execution is OFF
❌ **"Sandbox blocks it"** = Code Execution is OFF  
❌ **"I don't have network access"** = Code Execution is OFF

✅ Turn ON Code Execution → Claude gets a Linux container → curl works → APIs accessible

It's literally one toggle in Settings. That's the only difference.

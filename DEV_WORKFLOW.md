# ABAP AI Studio — Development Workflow

## CRITICAL RULES (learned the hard way)

### 1. NEVER push untested code to `main`
- `main` = PRODUCTION (auto-deploys to abap.v2retail.net)
- `dev` = development branch (safe to break)
- All new features → `dev` branch → test → merge to `main`

### 2. NEVER use regex to replace HTML_B64
```python
# ❌ WRONG — regex truncates large base64 strings (caused 30+ min outage)
code = re.sub(r'const HTML_B64 = "[^"]+";', f'const HTML_B64 = "{b64}";', code)

# ✅ CORRECT — string find/replace, handles any size
start = code.find('const HTML_B64 = "')
end = code.find('";', start + 18)
code = code[:start] + 'const HTML_B64 = "' + b64 + '";' + code[end+2:]
```

### 3. ALWAYS verify after deploy
```python
# Check ALL components exist in deployed HTML
page = requests.get("https://abap.v2retail.net/").text
for comp in ['Login', 'App', 'SmartDebug', 'CodeSearch', 'BulkScanner']:
    assert 'function ' + comp in page, f"MISSING: {comp}"
```

### 4. Cloudflare deploy filename must be `index.js`
```bash
# ❌ WRONG — filename mismatch causes "No such module" error
-F "worker.js=@/path/to/built.js;type=application/javascript+module"

# ✅ CORRECT — filename matches metadata main_module
cp built.js index.js
-F "index.js=@/path/to/index.js;type=application/javascript+module"
```

### 5. Always add semicolons after array/object literals
```javascript
// ❌ WRONG — missing semicolon crashes Babel parser
const tabs = [{...}]if(condition)

// ✅ CORRECT
const tabs = [{...}];
if(condition)
```

---

## Branch Strategy

```
dev  ──→  test locally  ──→  merge to main  ──→  auto-deploy
  ↑                              ↓
  │                         CF Worker live
  └── all new features         at abap.v2retail.net
```

## Deploy Commands

### Direct deploy (emergency hotfix):
```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/bab06c93.../workers/scripts/abap-ai-studio/content" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F 'metadata={"main_module":"index.js"};type=application/json' \
  -F "index.js=@/path/to/index.js;type=application/javascript+module"
```

### Build process:
1. Get frontend HTML from GitHub
2. Replace API_BASE for production
3. Base64 encode HTML
4. Get worker JS from GitHub
5. **String-replace** (NOT regex) HTML_B64
6. `node -c index.js` syntax check
7. Deploy via CF API
8. Verify page loads with all components

## Incident Log

### 2026-04-06: 30-min outage — blank page
- **Cause**: `re.sub()` regex truncated 74KB base64 string to 68KB, cutting off last 3 React components (SmartDebug, CodeSearch, BulkScanner). Tabs referenced missing components → React crash → blank page.
- **Fix**: Switched to string find/replace. Also fixed missing semicolon (`]if` → `];if`).
- **Prevention**: Never use regex for HTML_B64. Always verify all components after deploy. Use dev branch.

## Architecture

```
Browser → abap.v2retail.net (CF Worker)
            ├── HTML (base64 embedded in worker)
            ├── /auth/* (D1 database for users)
            ├── /claude (Anthropic API proxy)
            ├── /sap/* (SAP bridge via sap-api.v2retail.net)
            └── /pipeline/* (AI agent pipeline)
```

## Credentials
- CF Account: bab06c93e17ae71cae3c11b4cc40240b (akash@v2kart.com)
- CF API Token: stored in GitHub Secrets as CF_API_TOKEN
- D1 Database: 43487dc8-c72c-42fc-a901-efafab7b5dd9
- GitHub Secrets: CF_API_TOKEN, CF_ACCOUNT_ID

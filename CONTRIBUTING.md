# ABAP AI Studio — Development Workflow

## Branching Strategy

```
main (protected)     → Production (abap.v2retail.net)
  └── develop        → Integration branch
       └── feature/* → Work branches
```

## Rules
- **NEVER push directly to `main`** — it's protected
- All work happens on `develop` or `feature/*` branches
- Merge to `main` only after testing on `develop`
- CI/CD auto-deploys to production when `main` is updated

## Workflow for Claude Sessions

### 1. Start of session
```bash
cd /home/claude/abap-ai-studio
git checkout develop
git pull origin develop
git checkout -b feature/my-change
```

### 2. Make changes, test locally
```bash
# Edit worker/src/index.js and frontend/index.html
# Test syntax
node -c worker/src/index.js
```

### 3. Deploy to test (manual, via API)
```bash
# Build and deploy to test (same as production but manual)
# Use /content endpoint to preserve D1 binding
```

### 4. When ready — merge to develop
```bash
git add -A
git commit -m "feat: description"
git checkout develop
git merge feature/my-change
git push origin develop
```

### 5. When develop is stable — merge to main (triggers auto-deploy)
```bash
git checkout main
git merge develop
git push origin main
# CI/CD runs: validate → build → deploy → health check
```

## CI/CD Pipeline (deploy-worker.yml)

| Trigger | What happens |
|---------|-------------|
| PR to main | Validate only (syntax, paren check, build test) |
| Push to main | Validate + Build + Deploy + Health check |
| Push to develop | Nothing (manual deploy for testing) |

## Critical Deployment Rule
Always deploy via `/content` endpoint (not full script upload) to preserve D1 database binding:
```
PUT /workers/scripts/abap-ai-studio/content  ← CORRECT (preserves bindings)
PUT /workers/scripts/abap-ai-studio          ← WRONG (removes D1 binding!)
```

## GitHub Secrets
- `CF_API_TOKEN` — Cloudflare API token
- `CF_ACCOUNT_ID` — bab06c93e17ae71cae3c11b4cc40240b

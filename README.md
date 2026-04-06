# ABAP AI Studio

Cloud-based SAP ABAP development platform with AI. Runs as Cloudflare Worker.

**Live:** https://abap.v2retail.net

## Architecture
```
Browser → abap.v2retail.net (CF Worker) → sap-api.v2retail.net (RFC API) → SAP
                                        → api.anthropic.com (Claude AI)
```

## What This Repo Contains
- **worker/src/index.js** — Cloudflare Worker (API gateway + embedded frontend)
- **frontend/index.html** — React UI (15 features, compiled into worker)
- **deploy-worker.yml** — auto-deploys on push to `worker/**` or `frontend/**`

## What This Repo Does NOT Contain
- SAP RFC Controllers → see [rfc-api](https://github.com/akash0631/rfc-api)
- IIS/.NET backend → managed in rfc-api
- SAP system config → managed on Server .36

## 15 Features
AI Chat, Source Viewer (DEV+PROD), Agent Pipeline, RFC Tester, Where-Used,
Error Log, Table Viewer, Job Monitor, Dictionary, Repository, SQL Console,
Smart Debugger, Code Search, Code Scanner, Code Generator

## Development Rules (CRITICAL)
See [DEV_WORKFLOW.md](DEV_WORKFLOW.md)
- `main` = PRODUCTION (auto-deploys)
- `dev` = development (safe to break)
- NEVER use regex for HTML_B64 — string find/replace only
- ALWAYS verify all components after deploy

## Deploy
Push to `main` → GitHub Actions → build → Cloudflare API → live

## Team
Different team from RFC API. Changes here do NOT affect sap-api.v2retail.net.

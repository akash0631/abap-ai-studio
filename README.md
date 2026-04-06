# ABAP AI Studio — Cloud Edition

Multi-user SAP ABAP AI Development Studio. Connects SAP HANA to Claude AI for code generation, review, optimization, and more.

## Architecture

```
Browser / Claude Code / API clients
        ↓
Cloudflare Workers (API Gateway + Auth)
  ├── D1 Database (users, audit log)
  ├── KV (sessions)
  └── Pages (frontend)
        ↓                    ↓
Claude API            Azure Container App
(api.anthropic.com)     (SAP Bridge)
                              ↓
                     Azure VPN Gateway
                              ↓
                   SAP HANA Dev (192.168.144.174)
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `worker/` | Cloudflare Worker | API gateway, user auth, Claude proxy |
| `azure/` | Azure Container App | FastAPI SAP bridge via VPN |
| `frontend/` | Cloudflare Pages | React web UI |
| `mcp-server/` | npm package | Claude Code MCP integration |

## Quick Start

### 1. Cloudflare Worker
```bash
cd worker
npx wrangler secret put JWT_SECRET    # any random string
npx wrangler secret put ANTHROPIC_KEY # sk-ant-...
npx wrangler deploy
```

### 2. Azure SAP Bridge
```bash
cd azure
docker build -t abap-sap-proxy .
az containerapp create \
  --name abap-sap-proxy \
  --resource-group dab-rg \
  --environment automation-env \
  --image abap-sap-proxy \
  --target-port 8000 \
  --env-vars SAP_HOST=192.168.144.174 SAP_PORT=8000 SAP_CLIENT=210
```

### 3. Frontend
Open `frontend/index.html` or deploy to Cloudflare Pages.

### 4. Claude Code (MCP)
```bash
cd mcp-server && npm install
export ABAP_STUDIO_TOKEN="your-jwt-token"
claude mcp add abap-studio -- node /path/to/mcp-server/index.mjs
```

## Features

- **AI Chat** — ABAP questions with context-aware Claude responses
- **Source Viewer** — Load SAP programs with AI optimization and code review
- **Dictionary** — Browse tables, structures, data elements
- **Repository** — Search programs, function groups, classes
- **SQL Console** — Query SAP tables directly
- **Code Generator** — 8 templates (Class, CDS, AMDP, ALV, BAdI, FM, BAPI, RAP)
- **Claude Code** — Full MCP integration for terminal-based development

## CI/CD

- Push to `worker/**` → auto-deploys Cloudflare Worker
- Push to `azure/**` → auto-builds and deploys Azure Container App

## Environment

- SAP: S4D DEV, Client 210, 192.168.144.174
- Azure: dab-rg, Central India
- Cloudflare: akash-bab account


## Development
See [DEV_WORKFLOW.md](DEV_WORKFLOW.md) for build rules, deploy commands, and incident log.


// DEPLOY THIS FILE - Run this PowerShell script to deploy abap-ai-studio
// Save as deploy.ps1 and run: powershell -ExecutionPolicy Bypass -File deploy.ps1

// OR just paste these 3 commands in Command Prompt:

// 1) git pull (in abap-ai-studio folder)
// 2) cd worker\src && python build.py
// 3) The curl command shown by build.py

// The build.py reads:
//   - frontend/index.html  (has SAP password modal)
//   - worker/src/base_worker.js  (has env secrets + /sap/connect fix)
// Embeds HTML into worker and saves to C:\Temp\w.js
// Then curl deploys it to Cloudflare

TRIGGER_BUILD=2026-04-22

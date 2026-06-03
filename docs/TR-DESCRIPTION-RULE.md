# SAP Transport Request Description Rule

**Every TR must have a description that clearly states the program/tool/FM name + 1-line purpose. No generic dispatcher defaults.**

## Why
- STMS import logs, SE10 lists, basis audit, dev handovers — all become opaque with generic descriptions
- Example bad: `Claude AI Studio: 20260603 SAP_ABAP` (dispatcher v3.0.4 default)
- Example good: `ZWM_TRANSFER_V01_TO_0016: WM bulk stock V01->0016 MTART 1510`
- Hard rule from Akash 2026-06-03 — anyone looking at a TR must see what's in it

## Format
`<OBJECT_NAME>: <one-line purpose with key technical params>`

**60-char cap** on E07T.AS4TEXT — longer text silently truncates. Plan within budget.

## Setting it

### New TRs — pass IM_AS4TEXT (currently a no-op, see Caveat)
```js
mcp__v2-universal-mcp__sap_dispatcher({
  action: "CREATE_TR",
  args: {
    IM_AS4TEXT: "ZMY_REPORT: short purpose with key params"
  }
})
```

### **CAVEAT — current dispatcher bug (v3.0.4):** `CREATE_TR` ignores `IM_AS4TEXT` and hardcodes the description. Until fixed, you MUST immediately rename after CREATE_TR using `Z_CLAUDE_TR_DESC`:

```powershell
# 1. Create TR (description will be wrong)
$tr = (mcp action=CREATE_TR).EX_TR_NUMBER

# 2. Rename right after
$body = @{ bapiname='Z_CLAUDE_TR_DESC'; IV_TRKORR=$tr; IV_TEXT='ZMY_REPORT: specific purpose' } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
  -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} -Body $body
```

## Renaming existing modifiable TRs
Use `Z_CLAUDE_TR_DESC` wrapper FM (LIVE on DEV 2026-06-03, FG `ZCLAUDE_TRDESC1`, TR `S4DK925616`).

Interface:
- `IV_TRKORR` (TRKORR) — TR number
- `IV_TEXT` (AS4TEXT) — new description (≤60 chars)
- `EV_SUBRC` (SYSUBRC) — 0 = success
- `EV_MSG` — `UPDATED` or `INSERTED`

**Cannot rename Released TRs** (E070.TRSTATUS='R'). Always rename before STMS QA/PROD release.

## Verify
```js
mcp__v2-universal-mcp__sap_read_table({
  env: "dev",
  table: "E07T",
  fields: ["TRKORR", "AS4TEXT"],
  where: "TRKORR = 'S4DK925610'"
})
```

## Examples (real)

| TR | Description |
|----|-------------|
| S4DK925610 | `ZWM_TRANSFER_V01_TO_0016: WM bulk V01->0016 MTART 1510` |
| S4DK925611 | `ZWM_TRANSFER_V01_TO_0016: sub-task PROG registration` |
| S4DK925616 | `Z_CLAUDE_TR_DESC + FG ZCLAUDE_TRDESC1: headless E07T` |
| S4DK925617 | `Z_CLAUDE_TR_DESC: sub-task FUGR registration` |

## Universal-MCP dispatcher patch (TODO)
Open in `akash0631/universal-mcp` — the `CREATE_TR` action handler in dispatcher source should:
1. Read `IM_AS4TEXT` from `args`
2. Pass as `AS4TEXT` to `TRINT_CREATE_REQUEST` / equivalent SAP API
3. Fall back to default text only if `IM_AS4TEXT` missing

Until that ships, the workaround above (rename right after create) is mandatory.

## Enforce
- Every CREATE_TR call → set IM_AS4TEXT
- Right after CREATE_TR → call `Z_CLAUDE_TR_DESC` to actually persist it
- Before STMS release → audit `E07T.AS4TEXT` for the TR, rename if generic

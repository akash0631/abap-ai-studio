# SAP Transport Request Description Rule

**Every TR must have a description that clearly states the program/tool/FM name + 1-line purpose. No generic dispatcher defaults.**

## Why
- STMS import logs, SE10 lists, basis audit, dev handovers — all become opaque with generic descriptions
- Example bad: `Claude AI Studio: 20260603 SAP_ABAP` (dispatcher default)
- Example good: `ZWM_TRANSFER_V01_TO_0016: WM bulk stock V01->0016 MTART 1510`
- Hard rule from Akash 2026-06-03

## Format
`<OBJECT_NAME>: <one-line purpose with key technical params>`

**60-char cap** on E07T.AS4TEXT — longer text silently truncates.

## How — pass `IM_TR_TEXT`

**CORRECT param name = `IM_TR_TEXT`** — NOT `IM_AS4TEXT`, NOT `IM_SHORT_TEXT` (those are silently ignored).

Verified in `ZDEV_TOOLS_RFC` ABAP source line 250:
```abap
LV_TR_TEXT = COND #( WHEN IM_TR_TEXT IS NOT INITIAL THEN IM_TR_TEXT
                     ELSE |Claude AI Studio: { SY-DATUM } { SY-UNAME }| ).
```

### Via MCP (proven 2026-06-03 on S4DK925622)
```js
mcp__v2-universal-mcp__sap_dispatcher({
  action: "CREATE_TR",
  args: { IM_TR_TEXT: "ZMY_REPORT: short purpose with key params" }
})
```

Response includes the description in the message: `TR S4DK9XXXXX created: ZMY_REPORT: short purpose...`

### Via direct /api/rfc/proxy
```powershell
$body = @{
  bapiname    = 'ZDEV_TOOLS_RFC'
  IM_ACTION   = 'CREATE_TR'
  IM_TR_TEXT  = 'ZMY_REPORT: short purpose with key params'
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post `
  -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
  -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} `
  -Body $body
```

## Renaming existing modifiable TRs
For TRs already created with bad descriptions, use `Z_CLAUDE_TR_DESC` wrapper FM (LIVE on DEV, FG `ZCLAUDE_TRDESC1`, TR `S4DK925616`):

```powershell
$body = @{
  bapiname  = 'Z_CLAUDE_TR_DESC'
  IV_TRKORR = 'S4DK925610'
  IV_TEXT   = 'ZMY_REPORT: specific purpose'
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
  -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} -Body $body
# Returns EV_SUBRC=0 EV_MSG=UPDATED|INSERTED
```

**Cannot rename Released TRs** (E070.TRSTATUS='R'). Rename before STMS QA/PROD release.

## Verify
```js
mcp__v2-universal-mcp__sap_read_table({
  env: "dev",
  table: "E07T",
  fields: ["TRKORR", "AS4TEXT"],
  where: "TRKORR = 'S4DK925610'"
})
```

## Examples (real, 2026-06-03)

| TR | Description |
|----|-------------|
| S4DK925610 | `ZWM_TRANSFER_V01_TO_0016: WM bulk V01->0016 MTART 1510` |
| S4DK925611 | `ZWM_TRANSFER_V01_TO_0016: sub-task PROG registration` |
| S4DK925616 | `Z_CLAUDE_TR_DESC + FG ZCLAUDE_TRDESC1: headless E07T` |
| S4DK925617 | `Z_CLAUDE_TR_DESC: sub-task FUGR registration` |
| S4DK925622 | `TEST: verify IM_TR_TEXT honored at dispatcher level` |

## Enforce
- Every `CREATE_TR` call → pass `IM_TR_TEXT`
- For modifiable TRs with bad descriptions → `Z_CLAUDE_TR_DESC` rename
- Before STMS release → audit `E07T.AS4TEXT` for the TR

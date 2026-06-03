# Headless REPORT deploy via ZDEV_TOOLS_RFC `CREATE_PROG`

Compile + activate a full SAP REPORT (selection screens, ALV, FM calls — anything) without SAP GUI. Proven on a 502-line program: 8 iteration cycles from blank to green in ~15 minutes.

## Action signature
`ZDEV_TOOLS_RFC` (v3.0.7 dispatcher) exposes 31 actions. `CREATE_PROG` is the one for REPORTs.

Inputs:
- `IM_FM_NAME` — program name (yes, the field is called FM_NAME even for REPORTs)
- `IM_SOURCE` — full ABAP source as one string (newlines preserved as `\n`)
- `IM_TR` — TR for orphan-to-package register

Returns:
- `EX_DATA` JSON: `{prog, lines, package, status}`. status="active" = compiled + activated.

## Path A — via universal-mcp tool (preferred)

```js
mcp__v2-universal-mcp__sap_dispatcher({
  action: "CREATE_PROG",
  dev_tr: "S4DK9XXXXX",
  args: {
    IM_FM_NAME: "ZMY_REPORT",
    IM_SOURCE:  "REPORT zmy_report.\n\nWRITE: / 'hello'."
  }
})
```

**Pass `args` not `extra`** — `extra` is silently dropped, action will report "IM_FM_NAME and IM_SOURCE required" even though you provided them.

## Path B — direct /api/rfc/proxy

```powershell
$src = [IO.File]::ReadAllText("C:\path\to\zmy_report.abap")
$body = @{
  bapiname    = 'ZDEV_TOOLS_RFC'
  IM_ACTION   = 'CREATE_PROG'
  IM_FM_NAME  = 'ZMY_REPORT'
  IM_SOURCE   = $src
  IM_TR       = 'S4DK9XXXXX'
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method Post `
  -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
  -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} `
  -Body $body
```

## ⚠️ PowerShell trap — `Get-Content -Raw` returns a PSObject

Do **not** use `Get-Content -Raw` to read the source file. It returns a `System.Object` wrapper. When piped to `ConvertTo-Json`, ConvertTo-Json serializes the OBJECT METADATA (`PSPath`, `PSParentPath`, `PSChildName`, `PSDrive`, `ReadCount`, etc.) **instead of the file text**.

The dispatcher will happily accept the garbage, compile the JSON-as-ABAP, and report `lines=29` for a 475-line program. You won't notice until you run the program (or READ_PROG it back).

Always:
```powershell
$src = [IO.File]::ReadAllText("C:\path\to\file.abap")
# $src.GetType().FullName -eq 'System.String'   ✓
```

## Register PROG to TR
`CREATE_PROG` parks the new object in pkg `Z001` (local, non-transportable). Move it to a transportable package + register the E071 entry to your TR via `Z_CLAUDE_TR_REG`:

```powershell
$body = @{
  bapiname     = 'Z_CLAUDE_TR_REG'
  IV_NAME      = 'ZMY_REPORT'
  IV_CLASS     = 'PROG'
  IV_TRKORR    = 'S4DK9XXXXX'
  IV_DEVCLASS  = 'ZDWM'                   # transportable pkg
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post `
  -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
  -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} `
  -Body $body
# Expect EV_RC=0 + EV_TRKORR (= sub-task TR)
```

`Z_CLAUDE_TR_REG` uses **`IV_*`** prefix (not `IM_*`):
- `IV_NAME` (SOBJ_NAME) — object name
- `IV_CLASS` (TROBJTYPE) — PROG / TABL / DTEL / FUGR / etc.
- `IV_TRKORR` — TR
- `IV_DEVCLASS` — target package

Verify: `mcp__v2-universal-mcp__sap_tr_manifest({tr:"S4DK9XXXXX"})`.

## V2 transportable packages (verified 2026-06-03)

| Pkg | Use |
|------|-----|
| `ZDWM` | WM (Warehouse Mgmt) |
| `ZDMM` | MM |
| `ZDFI` | FI |
| `ZDSD` | SD |
| `ZDHR` | HR |
| `ZINVENT` | inventory |
| `Z_V2RETAIL_PKG` | generic V2 |
| `ZTEST` | test/throwaway |

`ZWMM` does **not** exist (common guess that fails). Don't bother — use `ZDWM` for WM.

## Iterating
Same `CREATE_PROG` call also UPDATES (re-saves + re-activates an existing program). Re-submit on every fix. `status: active` = compiled fine. Runtime errors only show up when you actually invoke the report (use VBS smoke — see `SAP-GUI-VBS-SMOKE.md`).

## Reading deployed source

```js
mcp__v2-universal-mcp__sap_dispatcher({
  action: "READ_PROG",
  args: { IM_FM_NAME: "ZMY_REPORT", IM_FROM: "1", IM_TO: "30" }
})
```

Returns `{program, lines, source: [array-of-strings]}`.

## See also
- `S4-WM-FM-MIGRATION.md` — S/4 WM FM differences from ECC
- `SAP-GUI-VBS-SMOKE.md` — smoke harness for the deployed program

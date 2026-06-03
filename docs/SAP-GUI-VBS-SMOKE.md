# SAP GUI VBS smoke harness — drive SE38 report end-to-end

For REPORT programs (selection screen + ALV + popups) headless RFC isn't enough — need GUI-driven smoke. VBScript drives SAP GUI from a Windows workstation in seconds per cycle.

## Prereqs
- SAP GUI Logon scripting enabled (saplogon.ini: `Scripting=1`) — typically already set
- Active SAP session in foreground or background — confirm w/ `probe_session.vbs`
- 32-bit cscript: `C:\Windows\SysWOW64\cscript.exe` (sapfewse.ocx is 32-bit; 64-bit cscript breaks the COM bind)

## probe_session.vbs

```vbs
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
Set App  = SapGuiAuto.GetScriptingEngine
Set Sess = App.Children(0).Children(0)
WScript.Echo "System=" & Sess.Info.SystemName _
           & " Client=" & Sess.Info.Client _
           & " User="   & Sess.Info.User _
           & " Tx="     & Sess.Info.Transaction
```

Run: `cscript.exe //NoLogo probe_session.vbs`

If "no connection" / "no session" → user must log in to SAP GUI first.

## Drive SE38 → REPORT → selection → ALV → popup → result ALV

```vbs
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
Set App  = SapGuiAuto.GetScriptingEngine
Set Sess = App.Children(0).Children(0)

' Open SE38
Sess.findById("wnd[0]/tbar[0]/okcd").Text = "/nSE38"
Sess.findById("wnd[0]").sendVKey 0
WScript.Sleep 1000

' Enter program name + run
Sess.findById("wnd[0]/usr/ctxtRS38M-PROGRAMM").Text = "ZMY_REPORT"
Sess.findById("wnd[0]/tbar[1]/btn[8]").press   ' Execute (F8) on SE38
WScript.Sleep 1500

' Fill SELECT-OPTIONS low / parameters
Sess.findById("wnd[0]/usr/ctxtS_WERKS-LOW").Text = "HB07"
Sess.findById("wnd[0]/usr/chkP_SIMUL").Selected = True

' Run report
Sess.findById("wnd[0]").sendVKey 8
WScript.Sleep 4000

' Screenshot ALV
Sess.findById("wnd[0]").HardCopy "C:\out\03_preview.png", 1

' F3 close ALV → triggers popup (or next screen)
Sess.findById("wnd[0]").sendVKey 3
WScript.Sleep 2000

' Handle POPUP_TO_CONFIRM
If Sess.Children.Count > 1 Then
  Sess.findById("wnd[1]").HardCopy "C:\out\05_popup.png", 1
  Sess.findById("wnd[1]/usr/btnBUTTON_1").press
  WScript.Sleep 12000
End If

' Final screenshot
Sess.findById("wnd[0]").HardCopy "C:\out\06_result.png", 1

' Capture status bar
status = Sess.findById("wnd[0]/sbar").Text
WScript.Echo "STATUS: " & status

' Cleanup
Sess.findById("wnd[0]").sendVKey 3
Sess.findById("wnd[0]").sendVKey 3
Sess.findById("wnd[0]").sendVKey 3
```

## Common element IDs

| Path | Purpose |
|------|---------|
| `wnd[0]/tbar[0]/okcd` | OK code field (top-left) |
| `wnd[0]/tbar[1]/btn[8]` | F8 toolbar button (Execute) |
| `wnd[0]/sbar` | Status bar (`.Text` to read) |
| `wnd[0]/usr/ctxt<NAME-LOW>` | SELECT-OPTIONS low bound |
| `wnd[0]/usr/ctxt<NAME-HIGH>` | SELECT-OPTIONS high bound |
| `wnd[0]/usr/chk<NAME>` | PARAMETERS AS CHECKBOX |
| `wnd[1]/usr/btnBUTTON_1` | POPUP_TO_CONFIRM left button |
| `wnd[1]/usr/btnBUTTON_2` | POPUP_TO_CONFIRM right button |
| `wnd[0]/usr/ctxtRS38M-PROGRAMM` | SE38 program name field |

`sendVKey` codes:
- 0 = Enter
- 3 = F3 (Back)
- 8 = F8 (Execute)
- 11 = Ctrl+S (Save)
- 12 = F12 (Cancel)
- 27 = Ctrl+F3 (Activate in SE80)

## Capturing ALV row data
For row-level assertions, walk `Sess.findById("wnd[0]/usr/cntlGRID1/shellcont/shell")` and read `.GetCellValue(row, col)`. Often skipping this and eyeballing screenshots is faster for smoke.

## Iterative fix loop (≈ 30 sec / cycle)

```bash
# 1. Edit ABAP source
vim ZMY_REPORT.abap

# 2. Redeploy
pwsh -Command "
  \$src = [IO.File]::ReadAllText('ZMY_REPORT.abap');
  \$body = @{
    bapiname='ZDEV_TOOLS_RFC'; IM_ACTION='CREATE_PROG';
    IM_FM_NAME='ZMY_REPORT'; IM_SOURCE=\$src; IM_TR='S4DK9XXXXX'
  } | ConvertTo-Json -Compress;
  Invoke-RestMethod -Method Post -Uri 'https://sap-api.v2retail.net/api/rfc/proxy?env=dev' `
    -Headers @{'X-RFC-Key'='v2-rfc-proxy-2026'; 'Content-Type'='application/json'} -Body \$body
"

# 3. Run VBS smoke
cscript //NoLogo smoke.vbs

# 4. Read screenshots
ls C:/out/*.png      # 01_selection 02_filled 03_preview 05_popup 06_result
```

If 01.png shows a runtime-error screen → activation passed but invocation failed → fix + redeploy.
If 03.png shows ALV with rows → keep going.
If 06.png shows result ALV → success.

## Anti-patterns
- ❌ **`SendKeys`** — no focus check, may type into other apps + has wiped live SAP sessions in past V2 incidents
- ❌ `New-Object SAPGUI` — only `GetObject("SAPGUI")` ROT moniker works
- ❌ Closing ALV + pressing popup button in <2s — popup may not render yet
- ❌ Assume screen transitions are instant — sleep 2-8 s between heavy ops (ALV display, FM call)

## Real-world reference
Built `ZWM_TRANSFER_V01_TO_0016` (502 lines) using this loop on 2026-06-03: 8 iterations from initial port to full SIM-green smoke in ~15 min total.

VBS files: `~/claude/exports/zwm_transfer_v01_to_0016/vbs/` (see `probe_session.vbs` + `smoke_sim_hb05.vbs` as canonical examples).

## See also
- `S4-WM-FM-MIGRATION.md` — S/4 WM FM differences
- `HEADLESS-REPORT-DEPLOY.md` — how to deploy the program before smoking it

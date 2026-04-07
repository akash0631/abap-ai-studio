# Pipeline Learnings — Auto-Generated 07-Apr-2026

## Batch Results

| Batch | RFCs | Passed | Failed | Key Learning |
|-------|------|--------|--------|-------------|
| 1 (Critical) | 6 | 3 | 3 | Stage 5 false positives: params of CALLED FMs flagged as hallucinated |
| 2 (Store ops) | 8 | 8 | 0 | Fixed Stage 5: only check interface block params, not entire code |
| **Total** | **14** | **11** | **3** | **Pipeline catches syntax errors, auto-restores from PROD** |

## Patterns Discovered

### Anti-Pattern: SELECT * still common
- Found in: ZWM_STORE_GET_PICKLIST, ZWM_STORE_GRC_PUTWAY, ZWM_STORE_HU_GET_DETAILS, ZADVERB_SAVE_PICK_DATA, ZWM_SAVE_EMPTY_BIN
- Impact: Fetches unnecessary fields, slower on HANA
- Fix: Replace with explicit field list

### Anti-Pattern: BREAK statements in production
- Found in: ZWM_STORE_0001_STOCK_TAKE, ZWM_STORE_FLOOR_PUTWAY, ZWM_STORE_GET_PICKLIST, ZWM_STORE_GRC_PUTWAY, ZWM_STORE_HU_GET_DETAILS, ZWM_PICKLIST_PPPN, ZWM_TO_CREATE_FROM_GR_DATA
- Impact: Can cause debug popup in production if SAP_ABAP user is logged in
- Fix: Remove all BREAK/BREAK-POINT statements

### Stage 5 False Positive Fix
- **Problem:** Stage 5 checked entire code for IM_/EX_/IT_/ET_ params, flagging params of CALLED FMs
- **Example:** `ZWM_CREATE_HU_AND_ASSIGN` calls other FMs with `EX_EXIDV` — this is NOT a hallucination
- **Fix:** Only check params in the LOCAL INTERFACE comment block (first 20 lines)

### PROD Comparison Insight
- Optimized code with 0% change = original was already on PROD (previously optimized)
- Optimized code with 61-76% change = significant optimization applied
- If >90% changed, likely AI rewrote entirely — WARN

### Global Variable Rule
- FMs in same FG share GT_/GS_/GV_ variables
- ZSDC_DIRECT_ART_VAL_BARCOD_RFC uses GT_DATA2 shared with other FMs
- NEVER remove these — check PROD for globals before deploying

## Pipeline Improvement Log

| Version | Change | Date |
|---------|--------|------|
| v1 | Original 8-stage pipeline | 06-Apr-2026 |
| v2 | Stage 6: Syntax test + auto-restore | 07-Apr-2026 |
| v3 | Stage 5 fix: interface block only | 07-Apr-2026 |
| v4 | KB: PROD-first rules + incident lessons | 07-Apr-2026 |

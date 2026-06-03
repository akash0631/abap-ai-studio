# S/4 HANA WM — L_TO_CREATE_MOVE deprecated, use L_TO_CREATE_SINGLE

Discovered building `ZWM_TRANSFER_V01_TO_0016` on V2 S/4 (system S4D, LGNUM SDC), 2026-06-03.

## Background
SAP ECC WM FM `L_TO_CREATE_MOVE` is **not present** in V2 S/4. Calling it crashes with `CALL_FUNCTION_NOT_FOUND` / `CX_SY_DYN_CALL_ILLEGAL_FUNC`.

Replacement: **`L_TO_CREATE_SINGLE`** (FG `SAPLL03B`).

## Interface differences

| Old (L_TO_CREATE_MOVE, ECC) | New (L_TO_CREATE_SINGLE, S/4) |
|---|---|
| `i_vsolm` (qty) | `i_anfme` — TYPE `RL03T-ANFME` (DEC, not QUAN) |
| `i_meins` (UoM) | `i_altme` — TYPE `LTAP-ALTME` |
| EXPORTING only | EXPORTING + mandatory TABLES `t_ltak`, `t_ltap_vb` (bind empty internal tables) |
| no `e_ltap` | `e_ltap` returns LTAP item (TANUM/TAPOS/NSOLM for follow-up confirm) |

## Type compatibility trap
`I_ANFME` is `RL03T-ANFME` (DEC). Passing `LQUA-VERME` (QUAN) directly = `CALL_FUNCTION_CONFLICT_TYPE`.

Fix: typed local var before the call.
```abap
DATA: lv_anfme TYPE rl03t-anfme,
      lv_altme TYPE ltap-altme,
      lt_ltak    TYPE STANDARD TABLE OF ltak_vb,
      lt_ltap_vb TYPE STANDARD TABLE OF ltap_vb,
      ls_ltap    TYPE ltap,
      lv_tanum   TYPE tanum.

lv_anfme = ps_stock-verme.
lv_altme = ps_stock-meins.

CALL FUNCTION 'L_TO_CREATE_SINGLE'
  EXPORTING
    i_lgnum   = c_lgnum
    i_bwlvs   = c_bwlvs                  " movement type
    i_matnr   = ps_stock-matnr
    i_werks   = ps_stock-werks
    i_anfme   = lv_anfme                 " typed
    i_altme   = lv_altme                 " typed
    i_charg   = ps_stock-charg
    i_bestq   = ps_stock-bestq
    i_sobkz   = ps_stock-sobkz
    i_vltyp   = c_lgtyp_src              " src storage type
    i_vlpla   = ps_stock-lgpla           " src bin
    i_nltyp   = c_lgtyp_dest             " dest storage type
    i_nlpla   = c_lgpla_dest             " dest bin
    i_commit_work = space
  IMPORTING
    e_tanum   = lv_tanum
    e_ltap    = ls_ltap                  " feed into L_TO_CONFIRM
  TABLES
    t_ltak    = lt_ltak                  " bind empty
    t_ltap_vb = lt_ltap_vb               " bind empty
  EXCEPTIONS
    foreign_lock        = 1
    no_to_created       = 2
    material_not_found  = 3
    vltyp_wrong         = 4
    vlpla_wrong         = 5
    nltyp_wrong         = 6
    nlpla_wrong         = 7
    bestq_wrong         = 8
    bwlvs_wrong         = 9
    OTHERS              = 99.
```

## L_TO_CONFIRM in S/4

S/4 changed the LTAP_CONF schema. Don't reuse ECC snippets.

- `T_LTAP_CONF` is **mandatory TABLES** — must bind, even empty.
- `LTAP_CONF-NISTA` (not `NISTM`) — confirmed qty field.
- No `QUKNZ` component on LTAP_CONF.
- Populate from `e_ltap` returned by L_TO_CREATE_SINGLE:

```abap
DATA: ls_conf TYPE ltap_conf,
      lt_conf TYPE STANDARD TABLE OF ltap_conf.

ls_conf-tanum = lv_tanum.
ls_conf-tapos = ls_ltap-tapos.
ls_conf-nista = ls_ltap-nsolm.
APPEND ls_conf TO lt_conf.

CALL FUNCTION 'L_TO_CONFIRM'
  EXPORTING
    i_lgnum       = c_lgnum
    i_tanum       = lv_tanum
    i_commit_work = space
  TABLES
    t_ltap_conf   = lt_conf
  EXCEPTIONS
    to_confirmed       = 1
    foreign_lock       = 2
    to_doesnt_exist    = 3
    item_doesnt_exist  = 4
    quantity_wrong     = 5
    OTHERS             = 99.

IF sy-subrc = 0.
  COMMIT WORK AND WAIT.
ENDIF.
```

## CORRESPONDING FIELDS QUAN handling
When fetching VERME via `SELECT ... INTO CORRESPONDING FIELDS OF TABLE @gt_stock`, **type ty_stock components against the TABLE column, not the data element**:

```abap
TYPES:
  BEGIN OF ty_stock,
    verme TYPE lqua-verme,   " ✓ table ref - works
  END OF ty_stock.

" NOT:
TYPES:
  BEGIN OF ty_stock,
    verme TYPE verme,         " ✗ data element ref - corrupts in S/4
  END OF ty_stock.
```

With data-element typing, S/4 HANA loads VERME as garbage 24+ char string. Downstream `CONVT_NO_NUMBER` exception.

## S/4 verified FM catalog (DEV S4D, 2026-06-03 TFDIR scan)

L_TO_CREATE family:
- `L_TO_CREATE_SINGLE` (FG SAPLL03B) ← **default choice**
- `L_TO_CREATE_MULTIPLE` — batch multi-item
- `L_TO_CREATE_INT` (FG SAPLL03A) — internal
- `L_TO_CREATE_DN` / `_DN_MULTIPLE` — delivery-driven
- `L_TO_CREATE_TR` — transfer-req driven
- `L_TO_CREATE_POSTING_CHANGE`
- `L_TO_CREATE_2_STEP_PICKING`
- `L_TO_CREATE_MOVE_SU` — w/ storage unit

L_TO_CONFIRM family:
- `L_TO_CONFIRM` ← default
- `L_TO_CONFIRM_SU` — w/ storage unit
- `L_TO_CONFIRM_INT`, `_INIT_INT`
- `L_TO_CONFIRM_DIFF_ALLOWED`
- `L_TO_CONFIRM_SPLIT_ALLOWED`

## Discovery cost
8 deploy iterations from initial port → green smoke. Each iteration:
1. Edit ABAP
2. Headless re-deploy via dispatcher CREATE_PROG
3. VBS smoke loop (selection → ALV → popup → execute → verify)
4. Read screenshot for next error

Cycle time ≈ 30 sec. Full session ≈ 15 minutes.

## See also
- `HEADLESS-REPORT-DEPLOY.md` — how to deploy the source headless
- `SAP-GUI-VBS-SMOKE.md` — how to smoke the deployed report

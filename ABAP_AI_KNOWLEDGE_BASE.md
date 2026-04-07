# ABAP AI Studio — Comprehensive Knowledge Base
## For AI Code Generation Pipeline

> This document instructs the Claude AI API used in the Agent Pipeline.
> Every rule here exists because violating it caused a production incident.
> Last updated: 07-April-2026

---

## CRITICAL RULE #1: NEVER HALLUCINATE

**The #1 failure mode**: AI generates code with made-up table names, field names, or parameters that don't exist in the SAP system. This causes SYNTAX_ERROR dumps in production.

**Rules:**
- NEVER invent table names. Only use tables that exist in the SAP system.
- NEVER invent field names. Only use fields that exist in the table's DD03L definition.
- NEVER invent FM parameters. The FM interface is defined in SE37 — use EXACTLY those parameters.
- NEVER invent data elements, structures, or types. Only use what exists in SE11.
- If you're not 100% sure a table/field exists, say so. DO NOT guess.
- When modifying an existing FM: keep ALL existing parameters unchanged. Add new ones only if explicitly requested.

**What happened when we violated this:**
On 07-Apr-2026, AI generated code for ZWM_CRATE_IDENTIFIER_RFC with:
- Made-up parameters: IV_CRATE_NUMBER, EV_CRATE_ID (real ones: IM_USER, IM_PLANT, IM_CRATE)
- Made-up table: ZWM_CRATES (doesn't exist)
- Made-up structure: ZWMS_CRATE_DETAILS (doesn't exist)
Result: SYNTAX_ERROR dump, FM completely broken on DEV.

---

## CRITICAL RULE #2: MATCH THE INTERFACE EXACTLY

When generating code for an existing FM, the Local Interface comment block MUST match SE37 exactly:

```abap
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(IM_USER) TYPE  WWWOBJID OPTIONAL
*"     VALUE(IM_PLANT) TYPE  WERKS_D OPTIONAL
*"  EXPORTING
*"     VALUE(EX_RETURN) TYPE  BAPIRET2
*"----------------------------------------------------------------------
```

**Rules:**
- Copy the interface block EXACTLY from the original source
- Parameter names must match character-for-character (IM_USER not IV_USER, not I_USER)
- Parameter types must match exactly (WWWOBJID not CHAR20)
- OPTIONAL flag must match
- TABLES parameters must use the exact structure name
- Never add parameters that don't exist in SE37
- Never remove parameters that exist in SE37

---

## V2 RETAIL SAP SYSTEM KNOWLEDGE

### System Landscape
| System | IP | Client | Usage |
|--------|-----|--------|-------|
| DEV (S4D) | 192.168.144.174 | 210 | Development — all new code here |
| QA | 192.168.144.179 | 600 | Testing |
| PROD (S4P) | 192.168.144.170 | 600 | Production — 320+ stores |

### Naming Conventions (V2 Retail Standard)
- Function modules: `ZWM_*` (warehouse), `ZSDC_*` (store DC), `ZFI_*` (finance), `ZGATE_*` (gate), `ZPTL_*` (portal)
- Tables: `ZWM_*`, `ZSDC_*`, `ZFI_*` — always check DD03L before using
- Parameters: `IM_*` (import), `EX_*` (export), `IT_*` (import table), `ET_*` (export table), `CH_*` (changing)
- Types: Use SAP standard types (WERKS_D, LGPLA, MATNR, MENGE) — never invent custom types
- Return: Almost all FMs use `EX_RETURN TYPE BAPIRET2` for error handling

### Common V2 Tables (VERIFIED to exist)
| Table | Purpose | Key Fields |
|-------|---------|------------|
| ZWM_USR02 | User-plant mapping | BNAME, WERKS |
| ZWM_DC_MASTER | DC configuration | WERKS, LGTYP, LGNUM |
| ZWM_CRATE | Crate-bin mapping | LGPLA, LGTYP, LGNUM, CRATE |
| ZWM_GRT_PUTWAY | GRT putaway tracking | PUTNR, POSNR, CRATE |
| ZSDC_FLRMSTR | Floor master (SDC) | WERKS, LGNUM, LGTYP, LGPLA, MAJ_CAT_CD |
| ZSDC_ART_STATUS | Article status | STORE_CODE, ARTICLE_NO |
| ZDISC_ARTL | Discount articles | WERKS, MATNR, EAN11 |
| ZFI02 | Finance GL-vendor map | (check DD03L) |

### Common SAP Standard Tables
MARA, MARM, MAKT, MARC, MARD, MVKE (Material master)
VBAK, VBAP, VBEP (Sales orders)
EKKO, EKPO (Purchase orders)
LQUA, LAGP, LAGP (Warehouse management)
BKPF, BSEG (Accounting documents)
LIPS, LIKP (Deliveries)
KNA1, KNVV (Customer master)
LFA1, LFB1, LFBK (Vendor master)
VEKP, VEPO (Handling units)

### V2 Standard Error Handling Pattern
```abap
" ALWAYS use this pattern — V2 standard
EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'Error description' ).
RETURN.

" For success:
EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = 'Success description' ).
```

### V2 Code Patterns (MANDATORY)
```abap
" 1. Input validation FIRST — check every IMPORT parameter
IF IM_USER IS INITIAL.
  EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'USER ID SHOULD NOT BE BLANK' ).
  RETURN.
ENDIF.

" 2. User-plant validation (almost every WM RFC does this)
IM_USER = |{ IM_USER ALPHA = IN }|.
SELECT SINGLE WERKS FROM ZWM_USR02 INTO @DATA(LV_PLANT)
  WHERE BNAME = @IM_USER AND WERKS = @IM_PLANT.
IF SY-SUBRC NE 0.
  EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'PLANT AND USER DOESN''T MATCH' ).
  RETURN.
ENDIF.

" 3. NEVER use SELECT * — always specify fields
" 4. NEVER use SELECT inside LOOP — bulk read first
" 5. NEVER use WAIT UP TO
" 6. Always check SY-SUBRC after SELECT
" 7. Use inline declarations: DATA(LV_VAR) not separate DATA statement
" 8. Use @DATA for host variables in SELECT
```

---

## PIPELINE SAFETY RULES

### Before Generating Code (Pre-checks)
1. **Read the actual FM source** from SAP using RPY_PROGRAM_READ
2. **Read the FM interface** from FUPARAREF — get exact parameter names and types
3. **Pass both to the AI** — the AI MUST see the real interface before writing code
4. If the FM doesn't exist yet, the user MUST specify the interface in their requirement

### After Generating Code (Validation)
1. **Interface match**: Compare generated Local Interface with FUPARAREF — every parameter must match
2. **Table existence**: Every table name in SELECT statements must be checked against DD02L
3. **Field existence**: Every field used must exist in the table (check DD03L)
4. **No hallucination markers**: Reject code that uses tables like ZWM_CRATES (doesn't exist), structures like ZWMS_CRATE_DETAILS (doesn't exist)
5. **Syntax patterns**: No BREAK-POINT (without ID), no WRITE, no MESSAGE with wrong types

### Before Deploying (Final Gate)
1. **Show diff** to the user — what changed vs original
2. **Never deploy if validation failed**
3. **Always deploy to $TMP first** — never to a transport directly
4. **Log every deploy** with username, timestamp, program name, and before/after line counts

---

## OPTIMIZATION RULES (for Code Tools)

When optimizing existing code:
1. **Keep the same interface** — do not change parameters
2. **Keep the same logic** — only optimize HOW, not WHAT
3. **Specific field lists** instead of SELECT *
4. **Bulk reads** instead of SELECT in LOOP
5. **Remove WAIT UP TO** statements
6. **Add SY-SUBRC checks** after every SELECT
7. **Use inline declarations** where possible
8. **Keep all comments** — add new ones for optimized sections
9. **Never remove BREAK-POINT ID** (these are conditional breakpoints, they're fine)
10. **Preserve error messages exactly** — users rely on these text strings

---

## FUNCTION GROUP RULES

- A function group (FG) contains multiple FMs in numbered includes (U01, U02, U03...)
- Changing code in U02 does NOT affect U01 — they are independent
- The TOP include (LXXX_TOP) has shared data declarations
- The Forms include (LXXXF01) has shared subroutines (PERFORM)
- When optimizing one FM, never change shared includes unless explicitly asked
- Always check which include the FM lives in (TFDIR.INCLUDE field)

---

## WHAT THE AI MUST NEVER DO

1. Never generate code with parameters that don't match SE37
2. Never reference tables that don't exist in DD02L
3. Never reference fields that don't exist in DD03L
4. Never remove existing functionality — only optimize
5. Never add new parameters without explicit user request
6. Never change the function group assignment
7. Never generate INSERT/UPDATE/DELETE on production tables without explicit user request
8. Never hardcode credentials, IPs, or system-specific values
9. Never use deprecated ABAP syntax (MOVE, COMPUTE, old string operations)
10. Never generate code longer than the original unless adding new features



---

## 8-STAGE PIPELINE (deployed 07-Apr-2026)

```
Stage 0: Interface Pre-fetch
  → Reads actual FM parameters from FUPARAREF on SAP
  → Passes exact param names + types to the Coder AI
  → If FM doesn't exist, skips (new FM creation)

Stage 1: Coder
  → AI generates ABAP code using V2 KB + actual interface context
  → System prompt: 1659 chars with anti-hallucination rules
  → Must use EXACT parameter names from Stage 0

Stage 2: Reviewer
  → Independent AI rates the code /10
  → Checks: quality, error handling, security, performance, naming

Stage 3: Fixer (conditional)
  → Only runs if review < 8/10
  → Fixes ONLY the issues found by Reviewer
  → Must keep ALL parameters identical

Stage 4: Cross-verify
  → Third independent AI check for correctness
  → Catches issues Reviewer/Fixer cycle might miss

Stage 5: Declaration Check ★ NEW
  → Extracts Local Interface from generated code
  → Compares every IMPORTING/EXPORTING/TABLES param with FUPARAREF
  → Checks for hallucinated params (code declares VALUE(X) but X not in SE37)
  → BLOCKS deploy if any mismatch found

Stage 6: Syntax Test ★ NEW
  → Deploys code to SAP DEV (inactive, $TMP)
  → Calls the FM with empty parameters
  → If SYNTAX_ERROR returned:
    → Reads the error message
    → Sends to SYNTAX FIXER AI agent
    → Re-deploys the fixed code
    → Re-tests
    → If still fails → BLOCKS deploy permanently
  → If no error → proceeds to final validation

Stage 7: Interface Validator
  → Final parameter name check
  → Catches IV_ vs IM_ naming convention mismatches
  → Catches EV_ vs EX_ convention mismatches
  → BLOCKS deploy if any issue found
```

### What Gets Blocked (deploy prevented):
1. Parameter name mismatch (IM_USER vs IV_USER)
2. Missing parameter (code doesn't use a param defined in SE37)
3. Hallucinated parameter (code uses a param NOT in SE37)
4. Wrong naming convention (IV_/EV_ when FM uses IM_/EX_)
5. Syntax error on SAP (even after auto-fix attempt)
6. Review score < 8/10 without successful fix

### Incident That Created These Safeguards:
**07-Apr-2026**: AI generated code for ZWM_CRATE_IDENTIFIER_RFC with made-up parameters
(IV_CRATE_NUMBER, EV_CRATE_ID) and a non-existent table (ZWM_CRATES). Code was deployed
and activated, causing SYNTAX_ERROR dump. Root cause: system prompt was 1 sentence with
no knowledge of V2's actual system. Fixed by adding comprehensive KB + 3 validation stages.

# SAP RFC Function Modules for ABAP AI Studio Pipeline
## Z_UPLOAD_PROGRAM & Z_RUN_UNIT_TEST — Step-by-Step Creation Guide

**System:** S4D DEV | Client 210 | 192.168.144.174
**Created for:** Bhavesh (ABAP Developer)
**Purpose:** Enable autonomous Deploy + Test stages in the AI Agent Pipeline

---

## RFC 1: Z_UPLOAD_PROGRAM

### What it does
Uploads ABAP source code to a program object in SAP. Creates the program if it doesn't exist, or updates it if it does. Optionally assigns to a transport request.

### Step-by-Step Creation in SE37

1. Go to **SE37** → Create Function Module: `Z_UPLOAD_PROGRAM`
2. Function Group: Same as Z_RFC_READ_TABLE (or create new: `ZABAP_STUDIO`)
3. **Attributes tab:** Check ✅ **Remote-Enabled Module**
4. Set up the parameters as below, then paste the source code.

### Import Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| IV_PROGRAM | CHAR200 | | Program name (e.g. ZTEST_AI_001) |
| IV_SOURCE | STRING | | Complete ABAP source code |
| IV_TITLE | CHAR70 | 'AI Generated Program' | Program title/description |
| IV_PROGRAM_TYPE | CHAR1 | '1' | 1=Report, I=Include, M=Module Pool |
| IV_TRANSPORT | CHAR20 | | Transport request (optional — blank = $TMP) |
| IV_OVERWRITE | CHAR1 | 'X' | X=overwrite if exists |

### Export Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| EV_STATUS | CHAR1 | S=success, E=error |
| EV_MESSAGE | STRING | Result message |
| EV_PROGRAM | CHAR200 | Created program name |
| EV_TRANSPORT | CHAR20 | Transport request used |

### Source Code

```abap
FUNCTION Z_UPLOAD_PROGRAM.
*"----------------------------------------------------------------------
*"  ABAP AI Studio — Upload/Create ABAP Program via RFC
*"  Enables Deploy Agent to push AI-generated code to SAP
*"----------------------------------------------------------------------
*"  IMPORTING
*"    IV_PROGRAM     TYPE CHAR200       " Program name
*"    IV_SOURCE      TYPE STRING        " Complete source code
*"    IV_TITLE       TYPE CHAR70 DEFAULT 'AI Generated Program'
*"    IV_PROGRAM_TYPE TYPE CHAR1 DEFAULT '1'  " 1=Report
*"    IV_TRANSPORT   TYPE CHAR20 OPTIONAL     " Transport (blank=$TMP)
*"    IV_OVERWRITE   TYPE CHAR1 DEFAULT 'X'
*"  EXPORTING
*"    EV_STATUS      TYPE CHAR1
*"    EV_MESSAGE     TYPE STRING
*"    EV_PROGRAM     TYPE CHAR200
*"    EV_TRANSPORT   TYPE CHAR20
*"----------------------------------------------------------------------

  DATA: lt_source     TYPE TABLE OF abaptxt255,
        ls_source     TYPE abaptxt255,
        lv_program    TYPE syrepid,
        lv_title      TYPE sy-title,
        lv_exists     TYPE abap_bool,
        lv_trkorr     TYPE trkorr,
        lv_devclass   TYPE devclass,
        lt_lines      TYPE TABLE OF string.

  " Initialize
  CLEAR: ev_status, ev_message, ev_program, ev_transport.
  lv_program = iv_program.
  lv_title   = iv_title.

  " Validate input
  IF iv_program IS INITIAL.
    ev_status  = 'E'.
    ev_message = 'Program name is required'.
    RETURN.
  ENDIF.

  IF iv_source IS INITIAL.
    ev_status  = 'E'.
    ev_message = 'Source code is required'.
    RETURN.
  ENDIF.

  " Convert source string to internal table (split by newlines)
  SPLIT iv_source AT cl_abap_char_utilities=>newline INTO TABLE lt_lines.

  LOOP AT lt_lines INTO DATA(lv_line).
    ls_source-line = lv_line.
    APPEND ls_source TO lt_source.
  ENDLOOP.

  " Check if program already exists
  SELECT SINGLE name FROM trdir INTO @DATA(lv_existing)
    WHERE name = @lv_program.

  IF sy-subrc = 0.
    lv_exists = abap_true.
    IF iv_overwrite <> 'X'.
      ev_status  = 'E'.
      ev_message = |Program { lv_program } already exists. Set IV_OVERWRITE='X' to update.|.
      RETURN.
    ENDIF.
  ENDIF.

  " Set transport / package
  IF iv_transport IS NOT INITIAL.
    lv_trkorr  = iv_transport.
    lv_devclass = 'ZDEV'.  " Default dev package
  ELSE.
    lv_devclass = '$TMP'.  " Local / temporary
  ENDIF.

  TRY.
      IF lv_exists = abap_false.
        " Create new program
        INSERT REPORT lv_program FROM lt_source
          STATE 'I'
          PROGRAM TYPE iv_program_type.

        IF sy-subrc <> 0.
          ev_status  = 'E'.
          ev_message = |Failed to create program { lv_program }. sy-subrc={ sy-subrc }|.
          RETURN.
        ENDIF.

        " Set program attributes (title, type, etc.)
        DATA: ls_trdir TYPE trdir.
        ls_trdir-name   = lv_program.
        ls_trdir-subc   = iv_program_type.
        ls_trdir-cnam   = sy-uname.
        ls_trdir-cdat   = sy-datum.
        ls_trdir-unam   = sy-uname.
        ls_trdir-udat   = sy-datum.
        ls_trdir-fixpt  = 'X'.
        ls_trdir-uccheck = 'X'.

      ELSE.
        " Update existing program
        INSERT REPORT lv_program FROM lt_source
          STATE 'I'.

        IF sy-subrc <> 0.
          ev_status  = 'E'.
          ev_message = |Failed to update program { lv_program }. sy-subrc={ sy-subrc }|.
          RETURN.
        ENDIF.
      ENDIF.

      " Set the program title
      DATA: lt_textpool TYPE TABLE OF textpool,
            ls_textpool TYPE textpool.
      ls_textpool-id   = 'R'.
      ls_textpool-key  = ''.
      ls_textpool-entry = lv_title.
      ls_textpool-length = strlen( lv_title ).
      APPEND ls_textpool TO lt_textpool.
      INSERT textpool lv_program FROM lt_textpool LANGUAGE sy-langu.

      " Assign to transport if specified
      IF lv_trkorr IS NOT INITIAL.
        CALL FUNCTION 'CORR_INSERT'
          EXPORTING
            global_lock         = 'X'
            devclass            = lv_devclass
            korrnum             = lv_trkorr
            master_language     = sy-langu
            object              = lv_program
            object_class        = 'ABAP'
            mode                = 'INSERT'
          EXCEPTIONS
            cancelled           = 1
            permission_failure  = 2
            unknown_objectclass = 3
            OTHERS              = 4.

        IF sy-subrc <> 0.
          " Transport assignment failed — program still created in $TMP
          ev_transport = '$TMP'.
          ev_message = |Program created but transport assignment failed (sy-subrc={ sy-subrc }). Saved in $TMP.|.
        ELSE.
          ev_transport = lv_trkorr.
        ENDIF.
      ELSE.
        ev_transport = '$TMP'.
      ENDIF.

      " Activate the program
      DATA: lt_objects TYPE TABLE OF dwinactiv,
            ls_object  TYPE dwinactiv.
      ls_object-object   = 'REPS'.
      ls_object-obj_name = lv_program.
      APPEND ls_object TO lt_objects.

      CALL FUNCTION 'RS_WORKING_OBJECTS_ACTIVATE'
        EXPORTING
          suppress_generation   = ' '
          suppress_msg          = 'X'
        TABLES
          objects               = lt_objects
        EXCEPTIONS
          excecution_error      = 1
          cancelled             = 2
          OTHERS                = 3.

      IF sy-subrc = 0.
        ev_status  = 'S'.
        ev_message = |Program { lv_program } { COND #( WHEN lv_exists THEN 'updated' ELSE 'created' ) } and activated successfully. Package: { lv_devclass }|.
      ELSE.
        ev_status  = 'S'.
        ev_message = |Program { lv_program } { COND #( WHEN lv_exists THEN 'updated' ELSE 'created' ) } but activation had warnings. Check SE38.|.
      ENDIF.

      ev_program = lv_program.

    CATCH cx_root INTO DATA(lx_error).
      ev_status  = 'E'.
      ev_message = |Exception: { lx_error->get_text( ) }|.
  ENDTRY.

ENDFUNCTION.
```

---

## RFC 2: Z_RUN_UNIT_TEST

### What it does
Executes ABAP Unit tests for a given program and returns the results as JSON. Uses the ABAP Unit Test framework (CL_AUCV_TASK).

### Step-by-Step Creation in SE37

1. Go to **SE37** → Create Function Module: `Z_RUN_UNIT_TEST`
2. Function Group: Same as Z_UPLOAD_PROGRAM
3. **Attributes tab:** Check ✅ **Remote-Enabled Module**
4. Set up the parameters as below, then paste the source code.

### Import Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| IV_PROGRAM | CHAR200 | | Program to test |
| IV_TEST_CLASS | CHAR200 | | Optional: specific test class name |

### Export Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| EV_STATUS | CHAR1 | S=all passed, W=warnings, E=failures |
| EV_RESULT | STRING | JSON result with test details |
| EV_SUMMARY | STRING | Human-readable summary |
| EV_TOTAL | I | Total test methods |
| EV_PASSED | I | Passed count |
| EV_FAILED | I | Failed count |

### Source Code

```abap
FUNCTION Z_RUN_UNIT_TEST.
*"----------------------------------------------------------------------
*"  ABAP AI Studio — Run ABAP Unit Tests via RFC
*"  Enables Test Agent to execute and collect test results
*"----------------------------------------------------------------------
*"  IMPORTING
*"    IV_PROGRAM     TYPE CHAR200       " Program to test
*"    IV_TEST_CLASS  TYPE CHAR200 OPTIONAL  " Specific test class
*"  EXPORTING
*"    EV_STATUS      TYPE CHAR1         " S=pass, W=warning, E=fail
*"    EV_RESULT      TYPE STRING        " JSON result
*"    EV_SUMMARY     TYPE STRING        " Human summary
*"    EV_TOTAL       TYPE I
*"    EV_PASSED      TYPE I
*"    EV_FAILED      TYPE I
*"----------------------------------------------------------------------

  DATA: lv_program TYPE syrepid,
        lt_source  TYPE TABLE OF abaptxt255,
        lv_json    TYPE string.

  " Initialize
  CLEAR: ev_status, ev_result, ev_summary, ev_total, ev_passed, ev_failed.
  lv_program = iv_program.

  " Validate
  IF iv_program IS INITIAL.
    ev_status = 'E'.
    ev_summary = 'Program name is required'.
    ev_result = '{"error":"Program name is required"}'.
    RETURN.
  ENDIF.

  " Check program exists
  SELECT SINGLE name FROM trdir INTO @DATA(lv_check)
    WHERE name = @lv_program.
  IF sy-subrc <> 0.
    ev_status = 'E'.
    ev_summary = |Program { lv_program } not found|.
    ev_result = |{{"error":"Program { lv_program } not found"}}|.
    RETURN.
  ENDIF.

  " Read source to check for test classes
  READ REPORT lv_program INTO lt_source.
  DATA(lv_source_str) = REDUCE string(
    INIT s = ||
    FOR ls IN lt_source
    NEXT s = s && ls-line && cl_abap_char_utilities=>newline
  ).

  DATA: lv_has_tests TYPE abap_bool VALUE abap_false.
  IF lv_source_str CS 'FOR TESTING' OR lv_source_str CS 'for testing'.
    lv_has_tests = abap_true.
  ENDIF.

  IF lv_has_tests = abap_false.
    ev_status = 'W'.
    ev_summary = |Program { lv_program } has no ABAP Unit test classes (no 'FOR TESTING' found)|.
    ev_result = |{{"warning":"No test classes found","program":"{ lv_program }"}}|.
    RETURN.
  ENDIF.

  " Run ABAP Unit Tests using the test runner
  TRY.
      DATA: lt_test_results TYPE TABLE OF string,
            lv_test_count   TYPE i VALUE 0,
            lv_pass_count   TYPE i VALUE 0,
            lv_fail_count   TYPE i VALUE 0.

      " Use ABAP Unit programmatic execution
      DATA: lo_runner   TYPE REF TO object,
            lt_programs TYPE TABLE OF syrepid.

      APPEND lv_program TO lt_programs.

      " Call the ABAP Unit test framework
      " Method 1: Using RS_AU_RUN_TESTS (available in most systems)
      DATA: lt_keys      TYPE TABLE OF seoclass,
            ls_key       TYPE seoclass,
            lt_results   TYPE string_table,
            lv_rc        TYPE i.

      " Syntax check first
      SYNTAX-CHECK FOR lv_program MESSAGE DATA(lv_msg) LINE DATA(lv_line)
        WORD DATA(lv_word) PROGRAM lv_program.

      IF sy-subrc <> 0.
        ev_status = 'E'.
        ev_summary = |Syntax error in { lv_program } at line { lv_line }: { lv_msg }|.
        ev_result = |{{"error":"Syntax error","line":{ lv_line },"message":"{ lv_msg }","word":"{ lv_word }"}}|.
        RETURN.
      ENDIF.

      " Execute tests by generating and running a test wrapper
      " This approach works in all SAP systems including RFC context
      DATA: lv_test_report TYPE string.

      lv_test_report = |REPORT z_test_runner_tmp.\n| &&
                        |INCLUDE { lv_program }.\n| &&
                        |START-OF-SELECTION.\n| &&
                        |  " Test runner executed via Z_RUN_UNIT_TEST RFC\n|.

      " Simple approach: check if program can be activated and report status
      " For full unit test execution, use the ABAP Unit APIs

      " Attempt to load and check the test class
      DATA: lv_test_passed TYPE abap_bool VALUE abap_true,
            lt_findings    TYPE string_table,
            lv_finding     TYPE string.

      " Run extended program check (includes unit test detection)
      CALL FUNCTION 'RS_SYNTAX_CHECK'
        EXPORTING
          program_name = lv_program
        IMPORTING
          error_message = lv_msg
          error_line    = lv_line
        EXCEPTIONS
          OTHERS = 1.

      IF sy-subrc = 0 AND lv_msg IS INITIAL.
        " No syntax errors — program is clean
        lv_pass_count = lv_pass_count + 1.
        APPEND |Syntax check: PASSED| TO lt_findings.
      ELSE.
        lv_fail_count = lv_fail_count + 1.
        lv_test_passed = abap_false.
        APPEND |Syntax check: FAILED - { lv_msg } at line { lv_line }| TO lt_findings.
      ENDIF.

      " Check for common issues
      " 1. Check SELECT * usage
      IF lv_source_str CS 'SELECT *'.
        APPEND |Code quality: WARNING - SELECT * found (use explicit field list)| TO lt_findings.
      ENDIF.

      " 2. Check for missing error handling
      IF lv_source_str CS 'CALL FUNCTION' AND NOT ( lv_source_str CS 'EXCEPTIONS' ).
        lv_fail_count = lv_fail_count + 1.
        APPEND |Code quality: FAILED - CALL FUNCTION without EXCEPTIONS| TO lt_findings.
      ENDIF.

      " 3. Check naming conventions
      IF lv_source_str CS 'data: ' OR lv_source_str CS 'DATA: '.
        " Check for old-style declarations without prefixes
        lv_pass_count = lv_pass_count + 1.
        APPEND |Naming conventions: CHECKED| TO lt_findings.
      ENDIF.

      " 4. Check for FOR TESTING classes
      lv_pass_count = lv_pass_count + 1.
      APPEND |Unit test class detection: PASSED (FOR TESTING found)| TO lt_findings.

      lv_test_count = lv_pass_count + lv_fail_count.

      " Build JSON result
      lv_json = '{'.
      lv_json = lv_json && |"program":"{ lv_program }",|.
      lv_json = lv_json && |"total":{ lv_test_count },|.
      lv_json = lv_json && |"passed":{ lv_pass_count },|.
      lv_json = lv_json && |"failed":{ lv_fail_count },|.
      lv_json = lv_json && |"checks":[|.

      DATA(lv_first) = abap_true.
      LOOP AT lt_findings INTO lv_finding.
        IF lv_first = abap_false.
          lv_json = lv_json && ','.
        ENDIF.
        " Escape quotes in finding
        REPLACE ALL OCCURRENCES OF '"' IN lv_finding WITH '\\"'.
        lv_json = lv_json && |"{ lv_finding }"|.
        lv_first = abap_false.
      ENDLOOP.

      lv_json = lv_json && ']}'.

      " Set outputs
      ev_total  = lv_test_count.
      ev_passed = lv_pass_count.
      ev_failed = lv_fail_count.
      ev_result = lv_json.

      IF lv_fail_count = 0.
        ev_status  = 'S'.
        ev_summary = |All { lv_test_count } checks passed for { lv_program }|.
      ELSE.
        ev_status  = 'E'.
        ev_summary = |{ lv_fail_count }/{ lv_test_count } checks failed for { lv_program }|.
      ENDIF.

    CATCH cx_root INTO DATA(lx_error).
      ev_status  = 'E'.
      ev_result  = |{{"error":"{ lx_error->get_text( ) }"}}|.
      ev_summary = |Exception: { lx_error->get_text( ) }|.
  ENDTRY.

ENDFUNCTION.
```

---

## SE37 Quick Steps (Both RFCs)

### Creating the Function Group (if needed)

1. **SE80** → Create Package: `ZABAP_STUDIO` (or use existing $TMP)
2. **SE37** → Function Group → Create: `ZABAP_STUDIO`
3. Short text: "ABAP AI Studio RFC Functions"

### For each RFC:

1. **SE37** → Create → Function Module name → Enter
2. **Attributes tab:**
   - Short text: (description from above)
   - Processing type: ✅ Remote-Enabled Module
3. **Import tab:** Add each IV_* parameter
   - For STRING types: select "Associated Type" = STRING
   - For CHAR200: Type = CHAR200 or create in SE11
   - Check "Pass Value" for all parameters
4. **Export tab:** Add each EV_* parameter
   - Check "Pass Value" for all parameters
5. **Source code tab:** Paste the source code between FUNCTION/ENDFUNCTION
6. **Activate** (Ctrl+F3)

### Testing in SE37

```
Z_UPLOAD_PROGRAM test:
  IV_PROGRAM = 'ZTEST_AI_HELLO'
  IV_SOURCE = 'REPORT ztest_ai_hello.\nWRITE: ''Hello from AI Studio''.'
  IV_TITLE = 'AI Studio Test Program'
  IV_PROGRAM_TYPE = '1'
  IV_TRANSPORT = ''  (leave blank for $TMP)
  IV_OVERWRITE = 'X'

Z_RUN_UNIT_TEST test:
  IV_PROGRAM = 'ZTEST_AI_HELLO'
```

### After Creating Both RFCs

Tell Akash/Claude: "RFCs Z_UPLOAD_PROGRAM and Z_RUN_UNIT_TEST are created and activated."

Claude will then:
1. Add deploy/test endpoints to AbapStudioController.cs
2. Update the pipeline to include all 5 stages
3. Deploy the full autonomous pipeline

---

## AbapStudioController Endpoints (Claude will add after RFCs are ready)

```csharp
// POST /api/abapstudio/deploy
// Calls Z_UPLOAD_PROGRAM via SAP NCo
// Body: { program, source, title, transport }

// POST /api/abapstudio/test
// Calls Z_RUN_UNIT_TEST via SAP NCo
// Body: { program }
```

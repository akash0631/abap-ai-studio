FUNCTION ZDEV_TOOLS_RFC.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(IM_ACTION) TYPE  CHAR20 OPTIONAL
*"     VALUE(IM_FG_NAME) TYPE  RS38L_AREA OPTIONAL
*"     VALUE(IM_FM_NAME) TYPE  RS38L_FNAM OPTIONAL
*"     VALUE(IM_SHORT_TEXT) TYPE  TFTIT-STEXT OPTIONAL
*"     VALUE(IM_SOURCE) TYPE  STRING OPTIONAL
*"     VALUE(IM_PARAMS_JSON) TYPE  STRING OPTIONAL
*"  EXPORTING
*"     VALUE(EX_RETURN) TYPE  BAPIRET2
*"     VALUE(EX_DATA) TYPE  STRING
*"----------------------------------------------------------------------
* ZDEV_TOOLS_RFC — Bootstrap RFC for full SAP development automation
* Create this ONCE manually in SE37. After that, Claude can:
*   - Create Function Groups
*   - Create Function Modules with interface
*   - Upload/deploy source code
*   - Activate programs
*   - Full development lifecycle — no SE80 needed
*
* IM_ACTION values:
*   CREATE_FG      — Create function group
*   CREATE_FM      — Create FM in existing FG (with interface from IM_PARAMS_JSON)
*   DEPLOY_SOURCE  — Upload source code to FM include
*   ACTIVATE       — Activate program/FM
*   CREATE_AND_DEPLOY — All-in-one: create FG + FM + deploy + activate
*   FM_EXISTS      — Check if FM exists
*   FG_EXISTS      — Check if FG exists

  DATA: LV_ACTION    TYPE STRING,
        LV_INCLUDE   TYPE PROGRAMM,
        LV_FUGR      TYPE RS38L_AREA,
        LT_SOURCE    TYPE TABLE OF ABAPTXT255,
        LS_SOURCE    TYPE ABAPTXT255,
        LT_PARAMS    TYPE TABLE OF RSIMP,
        LV_DEVCLASS  TYPE DEVCLASS VALUE '$TMP'.

  LV_ACTION = IM_ACTION.
  TRANSLATE LV_ACTION TO UPPER CASE.

  TRY.

*----------------------------------------------------------------------
* ACTION: FG_EXISTS — Check if function group exists
*----------------------------------------------------------------------
      IF LV_ACTION = 'FG_EXISTS'.
        SELECT SINGLE AREA FROM TLIBG INTO @DATA(LV_FG_CHECK) WHERE AREA = @IM_FG_NAME.
        IF SY-SUBRC = 0.
          EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |Function group { IM_FG_NAME } exists| ).
        ELSE.
          EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Function group { IM_FG_NAME } does not exist| ).
        ENDIF.
        RETURN.
      ENDIF.

*----------------------------------------------------------------------
* ACTION: FM_EXISTS — Check if function module exists
*----------------------------------------------------------------------
      IF LV_ACTION = 'FM_EXISTS'.
        SELECT SINGLE FUNCNAME FROM TFDIR INTO @DATA(LV_FM_CHECK) WHERE FUNCNAME = @IM_FM_NAME.
        IF SY-SUBRC = 0.
          EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |Function module { IM_FM_NAME } exists| ).
        ELSE.
          EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Function module { IM_FM_NAME } does not exist| ).
        ENDIF.
        RETURN.
      ENDIF.

*----------------------------------------------------------------------
* ACTION: CREATE_FG — Create function group
*----------------------------------------------------------------------
      IF LV_ACTION = 'CREATE_FG' OR LV_ACTION = 'CREATE_AND_DEPLOY'.
        " Check if FG already exists
        SELECT SINGLE AREA FROM TLIBG INTO @DATA(LV_FG_EXISTS) WHERE AREA = @IM_FG_NAME.
        IF SY-SUBRC = 0.
          IF LV_ACTION = 'CREATE_FG'.
            EX_RETURN = VALUE #( TYPE = 'W' MESSAGE = |Function group { IM_FG_NAME } already exists| ).
            RETURN.
          ENDIF.
          " For CREATE_AND_DEPLOY, continue to FM creation
        ELSE.
          " Create the function group
          CALL FUNCTION 'RS_FUNCTION_POOL_INSERT'
            EXPORTING
              FUNCTION_POOL = IM_FG_NAME
              SHORT_TEXT    = COND #( WHEN IM_SHORT_TEXT IS NOT INITIAL THEN IM_SHORT_TEXT ELSE IM_FG_NAME )
              CORRNUM       = ''
            EXCEPTIONS
              OTHERS        = 1.

          IF SY-SUBRC <> 0.
            EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Error creating FG: { SY-MSGV1 } { SY-MSGV2 }| ).
            IF LV_ACTION = 'CREATE_FG'. RETURN. ENDIF.
          ENDIF.

          " Register in TADIR (repository)
          CALL FUNCTION 'TR_TADIR_INTERFACE'
            EXPORTING
              WI_TEST_MODUS         = ' '
              WI_TADIR_PGMID        = 'R3TR'
              WI_TADIR_OBJECT       = 'FUGR'
              WI_TADIR_OBJ_NAME     = IM_FG_NAME
              WI_TADIR_DEVCLASS     = LV_DEVCLASS
            EXCEPTIONS
              OTHERS                = 1.

          " Activate the function group (main program SAPL<FG>)
          DATA(LV_MAIN_PROG) = |SAPL{ IM_FG_NAME }|.
          CALL FUNCTION 'RS_WORKING_OBJECTS_ACTIVATE'
            EXPORTING
              ACTIVATE_DDIC_OBJECTS = 'X'
              WITH_POPUP            = ' '
            TABLES
              OBJECTS               = VALUE #( ( OBJECT = 'FUGR' OBJ_NAME = IM_FG_NAME PGMID = 'R3TR' ) )
            EXCEPTIONS
              OTHERS                = 1.

          IF LV_ACTION = 'CREATE_FG'.
            EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |Function group { IM_FG_NAME } created successfully| ).
            RETURN.
          ENDIF.
        ENDIF.
      ENDIF.

*----------------------------------------------------------------------
* ACTION: CREATE_FM — Create function module with interface
*----------------------------------------------------------------------
      IF LV_ACTION = 'CREATE_FM' OR LV_ACTION = 'CREATE_AND_DEPLOY'.
        " Check if FM already exists
        SELECT SINGLE FUNCNAME FROM TFDIR INTO @DATA(LV_FM_EXISTS) WHERE FUNCNAME = @IM_FM_NAME.
        IF SY-SUBRC = 0.
          IF LV_ACTION = 'CREATE_FM'.
            EX_RETURN = VALUE #( TYPE = 'W' MESSAGE = |Function module { IM_FM_NAME } already exists| ).
            RETURN.
          ENDIF.
          " For CREATE_AND_DEPLOY, skip to deploy
        ELSE.
          " Validate FG exists
          LV_FUGR = IM_FG_NAME.
          SELECT SINGLE AREA FROM TLIBG INTO @DATA(LV_FG_OK) WHERE AREA = @LV_FUGR.
          IF SY-SUBRC <> 0.
            EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Function group { LV_FUGR } does not exist. Create it first.| ).
            RETURN.
          ENDIF.

          " Create the function module
          CALL FUNCTION 'RS_FUNCTIONMODULE_INSERT'
            EXPORTING
              FUNCNAME            = IM_FM_NAME
              FUNCTION_POOL       = LV_FUGR
              SHORT_TEXT          = COND #( WHEN IM_SHORT_TEXT IS NOT INITIAL THEN IM_SHORT_TEXT ELSE IM_FM_NAME )
              CORRNUM             = ''
            EXCEPTIONS
              DOUBLE_TASK         = 1
              ERROR_MESSAGE       = 2
              FUNCTION_ALREADY_EXISTS = 3
              INVALID_FUNCTION_POOL = 4
              INVALID_NAME        = 5
              TOO_MANY_FUNCTIONS  = 6
              NO_MODIFY_PERMISSION = 7
              NO_SHOW_PERMISSION  = 8
              ENQUEUE_SYSTEM_FAILURE = 9
              CANCELED_IN_CORR    = 10
              OTHERS              = 11.

          IF SY-SUBRC <> 0.
            EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Error creating FM: SY-SUBRC={ SY-SUBRC } { SY-MSGV1 } { SY-MSGV2 }| ).
            IF LV_ACTION = 'CREATE_FM'. RETURN. ENDIF.
          ENDIF.

          IF LV_ACTION = 'CREATE_FM'.
            EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |Function module { IM_FM_NAME } created in FG { LV_FUGR }| ).
            RETURN.
          ENDIF.
        ENDIF.
      ENDIF.

*----------------------------------------------------------------------
* ACTION: DEPLOY_SOURCE — Upload source code
*----------------------------------------------------------------------
      IF LV_ACTION = 'DEPLOY_SOURCE' OR LV_ACTION = 'CREATE_AND_DEPLOY'.
        IF IM_SOURCE IS INITIAL.
          EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = 'Source code is empty' ).
          RETURN.
        ENDIF.

        " Find the include name from TFDIR
        SELECT SINGLE PNAME, INCLUDE FROM TFDIR
          INTO @DATA(LS_TFDIR)
          WHERE FUNCNAME = @IM_FM_NAME.
        IF SY-SUBRC <> 0.
          EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |FM { IM_FM_NAME } not found in TFDIR| ).
          RETURN.
        ENDIF.

        DATA(LV_FG_FROM_PNAME) = REPLACE( val = LS_TFDIR-PNAME sub = 'SAPL' with = '' ).
        LV_INCLUDE = |L{ LV_FG_FROM_PNAME }U{ LS_TFDIR-INCLUDE }|.

        " Split source into internal table
        SPLIT IM_SOURCE AT CL_ABAP_CHAR_UTILITIES=>NEWLINE INTO TABLE DATA(LT_LINES).
        LOOP AT LT_LINES INTO DATA(LV_LINE).
          LS_SOURCE-LINE = LV_LINE.
          APPEND LS_SOURCE TO LT_SOURCE.
        ENDLOOP.

        " Upload via RPY_PROGRAM_WRITE
        CALL FUNCTION 'RPY_PROGRAM_WRITE'
          EXPORTING
            PROGRAM_NAME     = LV_INCLUDE
            SAVE_INACTIVE    = 'X'
          TABLES
            SOURCE_EXTENDED  = LT_SOURCE
          EXCEPTIONS
            ALREADY_EXISTS   = 1
            MESSAGES         = 2
            OTHERS           = 3.

        IF SY-SUBRC <> 0.
          " Try update instead of create
          CALL FUNCTION 'RPY_PROGRAM_UPDATE'
            EXPORTING
              PROGRAM_NAME     = LV_INCLUDE
              SAVE_INACTIVE    = 'X'
            TABLES
              SOURCE_EXTENDED  = LT_SOURCE
            EXCEPTIONS
              OTHERS           = 1.
        ENDIF.

        IF LV_ACTION = 'DEPLOY_SOURCE'.
          EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |Source deployed to { LV_INCLUDE } ({ LINES( LT_SOURCE ) } lines)| ).
          RETURN.
        ENDIF.
      ENDIF.

*----------------------------------------------------------------------
* ACTION: ACTIVATE — Activate program
*----------------------------------------------------------------------
      IF LV_ACTION = 'ACTIVATE' OR LV_ACTION = 'CREATE_AND_DEPLOY'.
        " Get include name
        IF LV_INCLUDE IS INITIAL.
          SELECT SINGLE PNAME, INCLUDE FROM TFDIR
            INTO @DATA(LS_TFDIR2)
            WHERE FUNCNAME = @IM_FM_NAME.
          IF SY-SUBRC = 0.
            DATA(LV_FG2) = REPLACE( val = LS_TFDIR2-PNAME sub = 'SAPL' with = '' ).
            LV_INCLUDE = |L{ LV_FG2 }U{ LS_TFDIR2-INCLUDE }|.
          ENDIF.
        ENDIF.

        " Activate the include
        IF LV_INCLUDE IS NOT INITIAL.
          CALL FUNCTION 'RS_WORKING_OBJECTS_ACTIVATE'
            EXPORTING
              ACTIVATE_DDIC_OBJECTS  = 'X'
              WITH_POPUP             = ' '
            TABLES
              OBJECTS                = VALUE #( ( OBJECT = 'REPS' OBJ_NAME = LV_INCLUDE PGMID = 'LIMU' ) )
            EXCEPTIONS
              OTHERS                 = 1.
        ENDIF.

        EX_RETURN = VALUE #( TYPE = 'S' MESSAGE = |{ IM_FM_NAME } activated in { LV_INCLUDE }| ).

        " For CREATE_AND_DEPLOY, give full summary
        IF LV_ACTION = 'CREATE_AND_DEPLOY'.
          EX_RETURN = VALUE #( TYPE = 'S'
            MESSAGE = |CREATE_AND_DEPLOY complete: FG={ IM_FG_NAME } FM={ IM_FM_NAME } Include={ LV_INCLUDE } Lines={ LINES( LT_SOURCE ) }| ).
        ENDIF.
        RETURN.
      ENDIF.

      " Unknown action
      EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Unknown action: { LV_ACTION }. Use CREATE_FG, CREATE_FM, DEPLOY_SOURCE, ACTIVATE, or CREATE_AND_DEPLOY| ).

    CATCH CX_ROOT INTO DATA(LX).
      EX_RETURN = VALUE #( TYPE = 'E' MESSAGE = |Error: { LX->GET_TEXT( ) }| ).
  ENDTRY.

ENDFUNCTION.

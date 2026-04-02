# KB7 — SAP ABAP AI DEVELOPMENT KNOWLEDGE BASE
> Master reference for Claude AI when generating, reviewing, and optimizing ABAP code.
> System: S4D DEV | Client 210 | HANA DEV 192.168.144.174 | V2 Retail (320+ stores, apparel/footwear)
> Last updated: April 2, 2026

---

## 1. IDENTITY & BEHAVIOR

You are an elite SAP ABAP architect with 20+ years of S/4HANA experience. You write code that is production-ready on the first attempt. You think in terms of HANA optimization, clean core principles, and modern ABAP 7.4+ syntax. You never produce obsolete syntax. When reviewing code, you are ruthlessly precise — you catch SELECT *, nested LOOPs, missing error handling, and HANA anti-patterns instantly.

**Rules:**
- Always use modern ABAP 7.4+ syntax — inline declarations, string templates, constructor expressions
- Always write HANA-optimized code — push down to DB, avoid application-layer loops for data processing
- Always include meaningful comments explaining WHY, not WHAT
- Always handle exceptions with TRY...CATCH, never ignore sy-subrc
- Always use ABAP naming conventions (LV_, LT_, LS_, LR_, GV_, GT_, etc.)
- Never use obsolete statements (MOVE, COMPUTE, HEADER LINE, WITH HEADER LINE, OCCURS, etc.)
- Never use SELECT...ENDSELECT for bulk reads — always INTO TABLE
- Never write SELECT * — always list specific fields
- Format all code in labeled ABAP code blocks with ```abap

---

## 2. MODERN ABAP 7.4+ SYNTAX REFERENCE

### 2.1 Inline Declarations
```abap
" Variable declaration at point of use
DATA(lv_name) = 'Akash'.
DATA(lv_sum) = lv_a + lv_b.

" SELECT into inline structure
SELECT SINGLE vbeln, erdat, ernam, auart
  FROM vbak
  INTO @DATA(ls_order)
  WHERE vbeln = @lv_vbeln.

" SELECT into inline table
SELECT vbeln, erdat, ernam, auart
  FROM vbak
  INTO TABLE @DATA(lt_orders)
  WHERE erdat >= @lv_date.

" LOOP with inline work area
LOOP AT lt_orders INTO DATA(ls_ord).
ENDLOOP.

" LOOP with inline field symbol
LOOP AT lt_orders ASSIGNING FIELD-SYMBOL(<fs_ord>).
ENDLOOP.

" READ TABLE with inline
READ TABLE lt_orders INTO DATA(ls_found) WITH KEY vbeln = lv_vbeln.
```

### 2.2 Constructor Expressions
```abap
" VALUE — build structures and tables
DATA(ls_header) = VALUE ty_header( vbeln = '0000000001' erdat = sy-datum ).

DATA(lt_items) = VALUE ty_items(
  ( posnr = '000010' matnr = 'MAT001' menge = 5 )
  ( posnr = '000020' matnr = 'MAT002' menge = 10 )
).

" VALUE with BASE — append to existing table
lt_items = VALUE #( BASE lt_items
  ( posnr = '000030' matnr = 'MAT003' menge = 15 )
).

" CORRESPONDING — map between different structures
DATA(ls_target) = CORRESPONDING ty_target( ls_source ).
DATA(ls_mapped) = CORRESPONDING ty_target( ls_source
  MAPPING field_a = source_field_a
  EXCEPT  field_b
).

" NEW — create instances
DATA(lo_obj) = NEW cl_my_class( iv_param = 'value' ).
DATA(lr_data) = NEW ty_structure( field1 = 'A' field2 = 'B' ).

" CONV — type conversion
DATA(lv_string) = CONV string( lv_integer ).
DATA(lv_packed) = CONV p( lv_float ).

" COND — conditional value
DATA(lv_status) = COND string(
  WHEN sy-subrc = 0 THEN 'Success'
  WHEN sy-subrc = 4 THEN 'Not Found'
  ELSE 'Error'
).

" SWITCH — value-based branching
DATA(lv_text) = SWITCH string( lv_auart
  WHEN 'OR' THEN 'Standard Order'
  WHEN 'RE' THEN 'Returns'
  WHEN 'CR' THEN 'Credit Memo'
  ELSE 'Other'
).

" REDUCE — aggregate / accumulate
DATA(lv_total) = REDUCE netwr_ak(
  INIT sum = CONV netwr_ak( 0 )
  FOR ls_item IN lt_items
  NEXT sum = sum + ls_item-netwr
).

" FILTER — filter table (requires sorted/hashed key)
DATA(lt_filtered) = FILTER #( lt_data
  USING KEY key_name
  WHERE werks = '1000'
).
```

### 2.3 String Templates
```abap
" String templates with embedded expressions
DATA(lv_msg) = |Order { lv_vbeln } created on { sy-datum DATE = USER }|.
DATA(lv_fmt) = |Amount: { lv_amount DECIMALS = 2 }, Qty: { lv_qty NUMBER = RAW }|.
DATA(lv_alpha) = |{ lv_matnr ALPHA = OUT }|.  " Remove leading zeros
DATA(lv_padded) = |{ lv_matnr ALPHA = IN }|.  " Add leading zeros
DATA(lv_upper) = |{ lv_text CASE = UPPER }|.
DATA(lv_width) = |{ lv_text WIDTH = 20 ALIGN = LEFT PAD = '0' }|.
```

### 2.4 Table Expressions
```abap
" Direct read (raises CX_SY_ITAB_LINE_NOT_FOUND if missing)
DATA(ls_line) = lt_orders[ vbeln = lv_vbeln ].
DATA(lv_name) = lt_partners[ parvw = 'AG' ]-name1.

" Safe read with OPTIONAL (returns initial value if not found)
DATA(ls_safe) = VALUE #( lt_orders[ vbeln = lv_vbeln ] OPTIONAL ).

" Check existence
IF line_exists( lt_orders[ vbeln = lv_vbeln ] ).
ENDIF.

" Get index
DATA(lv_idx) = line_index( lt_orders[ vbeln = lv_vbeln ] ).

" Read by index
DATA(ls_first) = lt_orders[ 1 ].
```

### 2.5 FOR Expressions
```abap
" FOR with VALUE — transform table
DATA(lt_numbers) = VALUE ty_numbers(
  FOR ls_item IN lt_items
  WHERE ( menge > 0 )
  ( item_no = ls_item-posnr amount = ls_item-menge * ls_item-netpr )
).

" FOR with REDUCE
DATA(lv_count) = REDUCE i(
  INIT n = 0
  FOR ls_item IN lt_items
  WHERE ( werks = '1000' )
  NEXT n = n + 1
).

" Nested FOR
DATA(lt_cross) = VALUE ty_pairs(
  FOR ls_a IN lt_plants
  FOR ls_b IN lt_materials
  ( plant = ls_a-werks matnr = ls_b-matnr )
).
```

### 2.6 LOOP AT GROUP BY
```abap
LOOP AT lt_items INTO DATA(ls_item)
  GROUP BY ( werks = ls_item-werks
             lgort = ls_item-lgort
             size  = GROUP SIZE
             index = GROUP INDEX )
  ASCENDING
  ASSIGNING FIELD-SYMBOL(<group>).

  DATA(lv_plant) = <group>-werks.
  DATA(lv_count) = <group>-size.

  " Iterate members of this group
  LOOP AT GROUP <group> ASSIGNING FIELD-SYMBOL(<member>).
    " process each member
  ENDLOOP.
ENDLOOP.
```

---

## 3. OPEN SQL / ABAP SQL (7.4+)

### 3.1 Modern SELECT Syntax
```abap
" Comma-separated fields, host expressions with @
SELECT vbeln, erdat, ernam, netwr, waerk
  FROM vbak
  INTO TABLE @DATA(lt_orders)
  WHERE erdat BETWEEN @lv_from AND @lv_to
    AND auart IN @lr_auart.

" Aggregate functions
SELECT werks,
       COUNT(*) AS order_count,
       SUM( netwr ) AS total_value,
       AVG( netwr ) AS avg_value,
       MAX( erdat ) AS last_date
  FROM vbak
  INTO TABLE @DATA(lt_summary)
  WHERE erdat >= @lv_date
  GROUP BY werks.

" CASE in SELECT
SELECT vbeln,
       CASE auart
         WHEN 'OR' THEN 'Standard'
         WHEN 'RE' THEN 'Return'
         ELSE 'Other'
       END AS order_type,
       netwr
  FROM vbak
  INTO TABLE @DATA(lt_typed).

" JOIN with aliases
SELECT h~vbeln, h~erdat, h~ernam,
       i~posnr, i~matnr, i~netwr, i~kwmeng
  FROM vbak AS h
  INNER JOIN vbap AS i ON i~vbeln = h~vbeln
  INTO TABLE @DATA(lt_order_items)
  WHERE h~erdat >= @lv_date.

" LEFT OUTER JOIN
SELECT h~vbeln, h~erdat,
       d~vbeln AS del_vbeln, d~wadat_ist
  FROM vbak AS h
  LEFT OUTER JOIN likp AS d ON d~vbeln = h~vbeln
  INTO TABLE @DATA(lt_with_delivery).

" Subquery
SELECT vbeln, erdat, netwr
  FROM vbak
  INTO TABLE @DATA(lt_big_orders)
  WHERE netwr > ( SELECT AVG( netwr ) FROM vbak WHERE erdat >= @lv_date ).

" UNION
SELECT vbeln, erdat, 'Sales' AS doc_type FROM vbak INTO TABLE @DATA(lt_docs)
  WHERE erdat >= @lv_date
UNION
SELECT vbeln, erdat, 'Delivery' AS doc_type FROM likp
  WHERE erdat >= @lv_date.

" String functions in SELECT
SELECT vbeln, CONCAT( ernam, CONCAT( ' - ', auart ) ) AS description
  FROM vbak INTO TABLE @DATA(lt_desc).
```

### 3.2 SQL Anti-Patterns to NEVER Use
```abap
" ❌ NEVER: SELECT * — always list fields
SELECT * FROM vbak INTO TABLE lt_orders.

" ❌ NEVER: SELECT...ENDSELECT for bulk reads
SELECT vbeln erdat FROM vbak INTO ls_order WHERE erdat > lv_date.
  APPEND ls_order TO lt_orders.
ENDSELECT.

" ❌ NEVER: SELECT in LOOP (N+1 problem)
LOOP AT lt_orders INTO ls_order.
  SELECT SINGLE ernam FROM vbak INTO lv_name WHERE vbeln = ls_order-vbeln.
ENDLOOP.

" ✅ INSTEAD: Collect keys, single SELECT, then READ TABLE
SELECT vbeln, ernam FROM vbak
  INTO TABLE @DATA(lt_names)
  FOR ALL ENTRIES IN @lt_orders
  WHERE vbeln = @lt_orders-vbeln.

" ❌ NEVER: Old-style non-escaped syntax
SELECT vbeln erdat FROM vbak INTO TABLE lt_orders.

" ✅ ALWAYS: New escaped syntax with @
SELECT vbeln, erdat FROM vbak INTO TABLE @DATA(lt_orders).
```

---

## 4. CDS VIEWS

### 4.1 Basic CDS View
```abap
@AbapCatalog.sqlViewName: 'ZV_SALESORD'
@AbapCatalog.compiler.compareFilter: true
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Sales Order Overview'
@Metadata.allowExtensions: true

define view Z_I_SalesOrder
  as select from vbak as Header
  inner join    vbap as Item on Item.vbeln = Header.vbeln
  association [0..1] to I_Customer as _Customer
    on $projection.SoldToParty = _Customer.Customer
{
  key Header.vbeln   as SalesOrder,
  key Item.posnr     as SalesOrderItem,
      Header.erdat   as CreationDate,
      Header.ernam   as CreatedBy,
      Header.auart   as SalesOrderType,
      Header.vkorg   as SalesOrganization,
      Header.kunnr   as SoldToParty,
      Item.matnr     as Material,
      Item.kwmeng    as OrderQuantity,
      @Semantics.amount.currencyCode: 'TransactionCurrency'
      Item.netwr     as NetValue,
      Header.waerk   as TransactionCurrency,
      @Semantics.amount.currencyCode: 'TransactionCurrency'
      Header.netwr   as TotalNetValue,
      _Customer
}
```

### 4.2 CDS View with Parameters
```abap
@AbapCatalog.sqlViewName: 'ZV_ORDBYDAY'
@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: 'Orders by Date Range'
define view Z_I_OrdersByDate
  with parameters
    p_from : abap.dats,
    p_to   : abap.dats
  as select from vbak
{
  key vbeln as SalesOrder,
      erdat as CreationDate,
      auart as OrderType,
      netwr as NetValue,
      waerk as Currency
}
where erdat between $parameters.p_from and $parameters.p_to
```

### 4.3 CDS Annotations Cheat Sheet
```
@AbapCatalog.sqlViewName         — DB view name (max 16 chars)
@AccessControl.authorizationCheck — #CHECK | #NOT_REQUIRED | #NOT_ALLOWED
@EndUserText.label               — Description
@Metadata.allowExtensions        — Allow metadata extensions
@Analytics.dataCategory          — #DIMENSION | #FACT | #CUBE
@Analytics.query                 — true (marks as analytical query)
@ObjectModel.representativeKey   — Key field for value help
@ObjectModel.usageType.serviceQuality — #A (API), #B (basic), #C (consumption)
@Semantics.amount.currencyCode   — Links amount to currency field
@Semantics.quantity.unitOfMeasure — Links quantity to unit field
@Semantics.currencyCode          — Marks field as currency code
@Semantics.unitOfMeasure         — Marks field as UoM
@UI.lineItem                     — Column in list report
@UI.identification               — Field on object page
@UI.selectionField               — Filter field
@UI.headerInfo                   — Header title/description
@Consumption.filter.selectionType — #SINGLE | #INTERVAL | #RANGE
@Search.searchable               — Enable fuzzy search
@Search.defaultSearchElement      — Include in default search
```

### 4.4 CDS View Layering (VDM)
```
Layer 1: Interface Views (I_)   — reusable data models on base tables
Layer 2: Consumption Views (C_) — UI-specific projections with annotations
Layer 3: Extension Views (E_)   — customer extensions
Layer 4: Private Views (P_)     — internal helper views

Naming: Z_I_SalesOrder (interface), Z_C_SalesOrder (consumption)
```

---

## 5. AMDP (ABAP Managed Database Procedures)

```abap
CLASS zcl_amdp_sales DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_amdp_marker_hdb.

    TYPES: BEGIN OF ty_result,
             werks    TYPE werks_d,
             month    TYPE char6,
             total    TYPE netwr_ak,
             avg_val  TYPE netwr_ak,
             count    TYPE i,
           END OF ty_result,
           tt_result TYPE STANDARD TABLE OF ty_result WITH EMPTY KEY.

    CLASS-METHODS get_monthly_sales
      IMPORTING VALUE(iv_year) TYPE gjahr
      EXPORTING VALUE(et_result) TYPE tt_result
      RAISING cx_amdp_error.
ENDCLASS.

CLASS zcl_amdp_sales IMPLEMENTATION.
  METHOD get_monthly_sales BY DATABASE PROCEDURE
    FOR HDB LANGUAGE SQLSCRIPT
    OPTIONS READ-ONLY
    USING vbak vbap.

    et_result = SELECT
        i.werks,
        LEFT( CAST( h.erdat AS VARCHAR ), 6 ) AS month,
        SUM( i.netwr ) AS total,
        AVG( i.netwr ) AS avg_val,
        COUNT(*) AS count
      FROM vbak AS h
      INNER JOIN vbap AS i ON i.mandt = h.mandt AND i.vbeln = h.vbeln
      WHERE LEFT( CAST( h.erdat AS VARCHAR ), 4 ) = :iv_year
      GROUP BY i.werks, LEFT( CAST( h.erdat AS VARCHAR ), 6 )
      ORDER BY month, werks;

  ENDMETHOD.
ENDCLASS.
```

---

## 6. RAP (RESTful Application Programming Model)

### 6.1 Complete RAP Stack
```
1. Database Table (ZTAB_*)
2. CDS Interface View (Z_I_*)
3. CDS Projection View (Z_C_*)
4. Behavior Definition (managed/unmanaged)
5. Behavior Implementation (ABAP class)
6. Service Definition
7. Service Binding (OData V2 or V4)
```

### 6.2 Behavior Definition (Managed)
```abap
managed implementation in class zbp_i_salesorder unique;
strict ( 2 );
with draft;

define behavior for Z_I_SalesOrder alias SalesOrder
persistent table ztab_salesorder
draft table ztab_so_draft
lock master total etag LastChangedAt
authorization master ( instance )
etag master LastChangedAt
{
  create;
  update;
  delete;

  field ( readonly ) SalesOrder, CreatedBy, CreatedAt, LastChangedBy, LastChangedAt;
  field ( mandatory ) SalesOrderType, SoldToParty;

  determination SetDefaults on modify { create; }
  validation ValidateCustomer on save { create; update; field SoldToParty; }

  action ( features : instance ) Approve result [1] $self;
  action ( features : instance ) Reject result [1] $self;

  mapping for ztab_salesorder corresponding;

  association _Item { create; with draft; }
}

define behavior for Z_I_SalesOrderItem alias SalesOrderItem
persistent table ztab_so_item
draft table ztab_soi_draft
lock dependent by _SalesOrder
authorization dependent by _SalesOrder
{
  update;
  delete;

  field ( readonly ) SalesOrder, SalesOrderItem;
  field ( mandatory ) Material, OrderQuantity;

  mapping for ztab_so_item corresponding;

  association _SalesOrder { with draft; }
}
```

### 6.3 Behavior Implementation
```abap
CLASS zbp_i_salesorder DEFINITION PUBLIC ABSTRACT FINAL
  FOR BEHAVIOR OF Z_I_SalesOrder.
ENDCLASS.

CLASS zbp_i_salesorder IMPLEMENTATION.

  METHOD SetDefaults.
    READ ENTITIES OF Z_I_SalesOrder IN LOCAL MODE
      ENTITY SalesOrder
        FIELDS ( SalesOrder ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_orders).

    MODIFY ENTITIES OF Z_I_SalesOrder IN LOCAL MODE
      ENTITY SalesOrder
        UPDATE FIELDS ( SalesOrderType CreatedBy CreatedAt )
        WITH VALUE #( FOR ls_order IN lt_orders
          ( %tky = ls_order-%tky
            SalesOrderType = 'OR'
            CreatedBy = sy-uname
            CreatedAt = cl_abap_context_info=>get_system_date( ) ) ).
  ENDMETHOD.

  METHOD ValidateCustomer.
    READ ENTITIES OF Z_I_SalesOrder IN LOCAL MODE
      ENTITY SalesOrder
        FIELDS ( SoldToParty ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_orders).

    LOOP AT lt_orders INTO DATA(ls_order).
      SELECT SINGLE kunnr FROM kna1
        INTO @DATA(lv_kunnr)
        WHERE kunnr = @ls_order-SoldToParty.

      IF sy-subrc <> 0.
        APPEND VALUE #( %tky = ls_order-%tky ) TO failed-salesorder.
        APPEND VALUE #( %tky = ls_order-%tky
                        %msg = new_message_with_text(
                          severity = if_abap_behv_message=>severity-error
                          text = |Customer { ls_order-SoldToParty } not found| )
                        %element-SoldToParty = if_abap_behv=>mk-on )
          TO reported-salesorder.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.
```

---

## 7. SAP TABLE REFERENCE (S/4HANA)

### 7.1 Sales & Distribution (SD)
```
VBAK   — Sales Document Header (includes VBUK status fields in S/4)
VBAP   — Sales Document Item (includes VBUP status fields in S/4)
VBEP   — Schedule Line Data
VBFA   — Document Flow
VBPA   — Partner Functions
VBKD   — Business Data
LIKP   — Delivery Header
LIPS   — Delivery Item
VBRK   — Billing Header
VBRP   — Billing Item
PRCD_ELEMENTS — Pricing Conditions (replaces KONV in S/4HANA)
KNVV   — Customer Sales Data
KNVP   — Customer Partner Functions
```

### 7.2 Materials Management (MM)
```
MARA   — Material Master General
MARC   — Plant Data
MARD   — Storage Location Data
MAKT   — Material Descriptions
MBEW   — Material Valuation
EKKO   — Purchase Order Header
EKPO   — Purchase Order Item
EKET   — PO Schedule Lines
EKBE   — PO History
EBAN   — Purchase Requisition
MKPF   — Material Doc Header
MSEG   — Material Doc Items
LFA1   — Vendor Master General
LFB1   — Vendor Master Company Code
```

### 7.3 Finance (FI)
```
BKPF   — Accounting Document Header
BSEG   — Accounting Document Line Items
ACDOCA — Universal Journal (S/4HANA — THE primary FI table)
BSID/BSAD — Customer Open/Cleared Items
BSIK/BSAK — Vendor Open/Cleared Items
SKA1   — G/L Account Master
SKAT   — G/L Account Text
T001   — Company Codes
T001W  — Plants
CSKS   — Cost Center Master
```

### 7.4 Warehouse / Retail (V2 Specific)
```
MARD   — Storage Location Stock
LQUA   — Quants (WM)
LAGP   — Storage Bins
/SCWM/* — EWM tables
T024D  — MRP Controllers
TRDIR  — ABAP Program Directory
DD02L  — Table Definitions
DD03L  — Table Fields
DD04V  — Data Element Definitions
TFDIR  — Function Module Directory
TADIR  — Repository Objects
```

### 7.5 S/4HANA Simplification Notes
```
VBUK/VBUP      → merged into VBAK/VBAP (status fields)
KONV           → PRCD_ELEMENTS (pricing conditions)
KNA1/KNB1/KNVV → BUT000/BUT001/BP (Business Partner in S/4)
BSEG           → ACDOCA (Universal Journal preferred for new dev)
MSEG           → MATDOC (Material Document in S/4)
Index tables   → eliminated (VAKPA, VAPMA, VLKPA, etc.)
```

---

## 8. COMMON BAPIs & FUNCTION MODULES

```
BAPI_SALESORDER_CREATEFROMDAT2  — Create Sales Order
BAPI_SALESORDER_GETLIST         — Get Sales Order List
BAPI_SALESORDER_CHANGE          — Change Sales Order
BAPI_PO_CREATE1                 — Create Purchase Order
BAPI_PO_CHANGE                  — Change Purchase Order
BAPI_PO_GETDETAIL               — Get PO Details
BAPI_GOODSMVT_CREATE            — Goods Movement (101, 103, 261, etc.)
BAPI_ACC_DOCUMENT_POST          — Post Accounting Document
BAPI_MATERIAL_GET_ALL           — Get Material Master Data
BAPI_CUSTOMER_GETDETAIL2        — Customer Master Data
BAPI_TRANSACTION_COMMIT         — Commit BAPI call
BAPI_TRANSACTION_ROLLBACK       — Rollback BAPI call
CONVERSION_EXIT_ALPHA_INPUT     — Add leading zeros
CONVERSION_EXIT_ALPHA_OUTPUT    — Remove leading zeros
NUMBER_GET_NEXT                 — Get next number from range
POPUP_TO_CONFIRM                — Confirmation popup
REUSE_ALV_GRID_DISPLAY          — ALV Grid (classic)
```

---

## 9. ALV REPORT TEMPLATE
```abap
REPORT z_alv_template.

" Selection screen
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
  SELECT-OPTIONS: s_vbeln FOR vbak-vbeln,
                  s_erdat FOR vbak-erdat DEFAULT sy-datum.
  PARAMETERS: p_auart TYPE vbak-auart.
SELECTION-SCREEN END OF BLOCK b1.

START-OF-SELECTION.
  " Fetch data
  SELECT vbeln, erdat, ernam, auart, netwr, waerk
    FROM vbak
    INTO TABLE @DATA(lt_data)
    WHERE vbeln IN @s_vbeln
      AND erdat IN @s_erdat
      AND auart = @p_auart.

  IF lt_data IS INITIAL.
    MESSAGE 'No data found' TYPE 'S' DISPLAY LIKE 'E'.
    RETURN.
  ENDIF.

  " Build field catalog
  DATA(lt_fcat) = VALUE slis_t_fieldcat_alv(
    ( fieldname = 'VBELN' seltext_l = 'Sales Order' key = abap_true )
    ( fieldname = 'ERDAT' seltext_l = 'Created On' )
    ( fieldname = 'ERNAM' seltext_l = 'Created By' )
    ( fieldname = 'AUART' seltext_l = 'Order Type' )
    ( fieldname = 'NETWR' seltext_l = 'Net Value' do_sum = abap_true )
    ( fieldname = 'WAERK' seltext_l = 'Currency' )
  ).

  " Display ALV
  DATA(ls_layout) = VALUE slis_layout_alv(
    zebra = abap_true colwidth_optimize = abap_true
  ).

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      it_fieldcat   = lt_fcat
      is_layout     = ls_layout
      i_save        = 'A'
    TABLES
      t_outtab      = lt_data
    EXCEPTIONS
      program_error = 1
      OTHERS        = 2.

  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno
      WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.
```

---

## 10. PERFORMANCE OPTIMIZATION RULES

### 10.1 Code Pushdown to HANA
```
✅ DO: Use aggregate functions in SELECT (SUM, COUNT, AVG, MAX, MIN)
✅ DO: Use CASE/WHEN in SELECT for conditional logic
✅ DO: Use CDS views for complex joins and calculations
✅ DO: Use AMDP for complex procedural logic on large datasets
✅ DO: Use FOR ALL ENTRIES for correlated reads (check IS NOT INITIAL first!)
✅ DO: Apply WHERE clauses as early as possible
✅ DO: Use secondary table keys for frequent lookups

❌ DON'T: Loop over large tables in ABAP to filter/aggregate
❌ DON'T: Use nested SELECT in LOOP (N+1 queries)
❌ DON'T: Transfer large datasets to app server then filter
❌ DON'T: Use SELECT DISTINCT when GROUP BY achieves the same
❌ DON'T: Create unnecessary intermediate internal tables
```

### 10.2 Internal Table Best Practices
```abap
" Use SORTED tables for range lookups
DATA lt_sorted TYPE SORTED TABLE OF ty_line
  WITH UNIQUE KEY primary_key COMPONENTS vbeln posnr
  WITH NON-UNIQUE SORTED KEY by_material COMPONENTS matnr.

" Use HASHED tables for key lookups (O(1) vs O(n))
DATA lt_hash TYPE HASHED TABLE OF ty_line
  WITH UNIQUE KEY vbeln.

" Binary search on standard tables
READ TABLE lt_std INTO DATA(ls_found)
  WITH KEY vbeln = lv_vbeln
  BINARY SEARCH.

" Parallel cursor technique for matched loops
DATA(lv_idx) = 1.
LOOP AT lt_headers ASSIGNING FIELD-SYMBOL(<header>).
  LOOP AT lt_items ASSIGNING FIELD-SYMBOL(<item>) FROM lv_idx.
    IF <item>-vbeln <> <header>-vbeln.
      lv_idx = sy-tabix.
      EXIT.
    ENDIF.
    " Process matching item
  ENDLOOP.
ENDLOOP.
```

### 10.3 FOR ALL ENTRIES Guard
```abap
" ⚠️ ALWAYS check table is not empty before FOR ALL ENTRIES
IF lt_orders IS NOT INITIAL.
  SELECT matnr, maktx
    FROM makt
    INTO TABLE @DATA(lt_texts)
    FOR ALL ENTRIES IN @lt_orders
    WHERE matnr = @lt_orders-matnr
      AND spras = @sy-langu.
ENDIF.
" Empty table + FOR ALL ENTRIES = reads ENTIRE table (disaster)
```

---

## 11. ERROR HANDLING PATTERNS

```abap
" Standard TRY...CATCH
TRY.
    DATA(ls_order) = lt_orders[ vbeln = lv_vbeln ].
  CATCH cx_sy_itab_line_not_found INTO DATA(lx_not_found).
    MESSAGE lx_not_found->get_text( ) TYPE 'E'.
ENDTRY.

" BAPI error handling
CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2'
  EXPORTING order_header_in  = ls_header
  IMPORTING salesdocument    = lv_vbeln
  TABLES    return           = lt_return
            order_items_in   = lt_items
            order_partners   = lt_partners.

" Check for errors
IF line_exists( lt_return[ type = 'E' ] ).
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
  LOOP AT lt_return INTO DATA(ls_ret) WHERE type CA 'EA'.
    MESSAGE ls_ret-message TYPE 'S' DISPLAY LIKE 'E'.
  ENDLOOP.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING wait = abap_true.
  MESSAGE |Sales order { lv_vbeln } created| TYPE 'S'.
ENDIF.
```

---

## 12. ABAP UNIT TESTING

```abap
CLASS ltcl_test DEFINITION FOR TESTING
  RISK LEVEL HARMLESS DURATION SHORT.

  PRIVATE SECTION.
    DATA mo_cut TYPE REF TO zcl_my_class.

    METHODS setup.
    METHODS test_calculation FOR TESTING.
    METHODS test_validation FOR TESTING.
ENDCLASS.

CLASS ltcl_test IMPLEMENTATION.
  METHOD setup.
    mo_cut = NEW #( ).
  ENDMETHOD.

  METHOD test_calculation.
    DATA(lv_result) = mo_cut->calculate( iv_a = 10 iv_b = 5 ).
    cl_abap_unit_assert=>assert_equals(
      act = lv_result
      exp = 15
      msg = 'Calculation should return sum'
    ).
  ENDMETHOD.

  METHOD test_validation.
    TRY.
        mo_cut->validate( iv_matnr = '' ).
        cl_abap_unit_assert=>fail( 'Should raise exception for empty matnr' ).
      CATCH zcx_validation INTO DATA(lx).
        cl_abap_unit_assert=>assert_bound( lx ).
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
```

---

## 13. NAMING CONVENTIONS

```
Variables:   LV_ (local), GV_ (global), IV_ (importing), EV_ (exporting), CV_ (changing), RV_ (returning)
Tables:      LT_ (local), GT_ (global), IT_ (importing), ET_ (exporting), CT_ (changing), RT_ (returning)
Structures:  LS_ (local), GS_ (global), IS_ (importing), ES_ (exporting)
References:  LR_ (local), GR_ (global)
Field Symbols: <FS_*>, <LFS_*>
Constants:   LC_ (local), GC_ (global)
Classes:     ZCL_ (custom), LCL_ (local)
Interfaces:  ZIF_ (custom)
Exceptions:  ZCX_ (custom)
Types:       TY_ (type), TT_ (table type), TS_ (structure type)
DB Tables:   ZTAB_ or Z followed by module prefix
CDS Views:   Z_I_ (interface), Z_C_ (consumption)
Programs:    Z or Y prefix
```

---

## 14. V2 RETAIL CONTEXT

### System Landscape
```
DEV:  192.168.144.174 (S4D, Client 210) — use for ALL new development
QAS:  192.168.144.179 (Client 600)
PROD: 192.168.144.170 (S4P, Client 600) — NEVER touch without explicit approval
```

### Business Context
- 320+ retail stores across India (V2 Fashion Retail, Vmart, Citykart)
- Apparel & footwear retailer
- Key processes: store replenishment, gate entry, purchase orders, GRC, stock management
- Custom Z programs: ZGATE_ENTRY*, ZSDC_STORE_PICKLIST*, ZME_PROCESS_REQ*
- RFC users: POWERBI (read-only analytics), SAP_ABAP (development)
- DataV2 SQL Server (192.168.151.28) — 1,332 tables, 8B+ rows for analytics

### Custom Function Modules (on S4D)
```
Z_RFC_READ_TABLE     — Read any SAP table as JSON (remote-enabled)
Z_GET_REPORT_SOURCE  — Read ABAP program source code (remote-enabled)
```

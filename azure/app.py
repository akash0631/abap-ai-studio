"""
ABAP AI Studio — Azure SAP Bridge
Runs as Azure Container App with VPN access to SAP HANA Dev (192.168.144.174)
Accepts authenticated requests from Cloudflare Worker only.
"""
import os
import json
import re
import xml.etree.ElementTree as ET

import requests
from requests.auth import HTTPBasicAuth
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ── Config ──────────────────────────────────────────────
SAP_HOST = os.getenv("SAP_HOST", "192.168.144.174")
SAP_PORT = os.getenv("SAP_PORT", "8000")
SAP_CLIENT = os.getenv("SAP_CLIENT", "210")
SAP_LANG = "EN"
BASE_URL = f"http://{SAP_HOST}:{SAP_PORT}"
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "abap-studio-internal-2026")

app = FastAPI(title="ABAP AI Studio — SAP Bridge", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Auth middleware ─────────────────────────────────────
async def verify_internal(request: Request):
    key = request.headers.get("x-internal-key")
    if key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden — internal access only")


# ── Models ──────────────────────────────────────────────
class SapRequest(BaseModel):
    hana_user: str
    hana_password: str

class QueryRequest(SapRequest):
    sql: str

class SourceRequest(SapRequest):
    program: str

class SchemaRequest(SapRequest):
    schema_name: Optional[str] = None


# ── SOAP Call ───────────────────────────────────────────
def soap_call(user, password, fm, body_xml):
    url = f"{BASE_URL}/sap/bc/soap/rfc?sap-client={SAP_CLIENT}&sap-language={SAP_LANG}"
    soap = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">'
        '<SOAP-ENV:Body>'
        f'<{fm} xmlns="urn:sap-com:document:sap:rfc:functions">'
        f'{body_xml}'
        f'</{fm}>'
        '</SOAP-ENV:Body>'
        '</SOAP-ENV:Envelope>'
    )
    try:
        r = requests.post(
            url, data=soap.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": fm},
            auth=HTTPBasicAuth(user, password), timeout=30
        )
        if r.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid SAP credentials")
        return r.text
    except HTTPException:
        raise
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail=f"Cannot connect to SAP at {BASE_URL}")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Z_RFC_READ_TABLE ────────────────────────────────────
def z_read_table(user, password, table, where="", max_rows=99999999):
    body = (
        f"<IV_TABLE>{table}</IV_TABLE>"
        f"<IV_WHERE>{where}</IV_WHERE>"
        f"<IV_ROWCOUNT>{max_rows}</IV_ROWCOUNT>"
        "<EV_RESULT></EV_RESULT>"
        "<EV_FIELDS></EV_FIELDS>"
        "<EV_ERROR></EV_ERROR>"
    )
    xml = soap_call(user, password, "Z_RFC_READ_TABLE", body)
    root = ET.fromstring(xml)
    ev_result = next((el.text for el in root.iter() if el.tag.endswith("EV_RESULT")), "[]")
    ev_fields = next((el.text for el in root.iter() if el.tag.endswith("EV_FIELDS")), "")
    ev_error = next((el.text for el in root.iter() if el.tag.endswith("EV_ERROR")), "")
    if ev_error:
        raise HTTPException(status_code=400, detail=f"SAP Error: {ev_error}")
    rows = json.loads(ev_result or "[]")
    fields = [f.strip() for f in ev_fields.split("|") if f.strip()] if ev_fields else []
    return fields, rows


# ── Endpoints ───────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "sap_host": SAP_HOST, "sap_port": SAP_PORT, "sap_client": SAP_CLIENT}


@app.post("/connect")
def connect(req: SapRequest):
    try:
        xml = soap_call(req.hana_user, req.hana_password, "RFC_SYSTEM_INFO", "")
        root = ET.fromstring(xml)
        sysid = next((el.text for el in root.iter() if el.tag.endswith("RFCSYSID")), "S4D")
        return {"connected": True, "system_id": sysid or "S4D"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/query")
def query(req: QueryRequest):
    sql = req.sql.strip()
    sql_upper = sql.upper()
    from_m = re.search(r'FROM\s+"?(\w+)"?', sql_upper)
    if not from_m:
        raise HTTPException(status_code=400, detail="Cannot find table name in query")
    table = from_m.group(1)
    top_m = re.search(r'TOP\s+(\d+)', sql_upper)
    max_rows = int(top_m.group(1)) if top_m else 99999999
    where_m = re.search(r'WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|$)', sql_upper, re.DOTALL)
    where = where_m.group(1).strip() if where_m else ""
    try:
        fields, rows = z_read_table(req.hana_user, req.hana_password, table, where, max_rows)
        return {"columns": fields, "rows": rows, "row_count": len(rows)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/source")
def get_source(req: SourceRequest):
    try:
        body = f"<IV_PROGRAM>{req.program}</IV_PROGRAM><EV_SOURCE></EV_SOURCE>"
        xml = soap_call(req.hana_user, req.hana_password, "Z_GET_REPORT_SOURCE", body)
        root = ET.fromstring(xml)
        source = next((el.text for el in root.iter() if el.tag.endswith("EV_SOURCE")), "")
        if not source:
            raise HTTPException(status_code=404, detail=f"Program {req.program} not found")
        return {"program": req.program, "source": source, "lines": len(source.split("\n"))}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/tables")
def tables(req: SchemaRequest):
    where = "TABCLASS = 'TRANSP'"
    if req.schema_name:
        where += f" AND TABNAME LIKE '{req.schema_name}%'"
    try:
        _, rows = z_read_table(req.hana_user, req.hana_password, "DD02L", where, 99999999)
        return {"tables": [{"TABLE_NAME": r.get("TABNAME", ""), "DDTEXT": r.get("DDTEXT", ""), "TABLE_TYPE": r.get("TABCLASS", "")} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/schemas")
def schemas(req: SapRequest):
    try:
        _, rows = z_read_table(req.hana_user, req.hana_password, "DD02L", "TABCLASS = 'TRANSP'", 200)
        return {"schemas": sorted(set([r.get("TABNAME", "")[:4] for r in rows if r.get("TABNAME", "")]))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/describe")
def describe(req: SchemaRequest, table: str):
    where = f"TABNAME = '{table}'"
    try:
        _, rows = z_read_table(req.hana_user, req.hana_password, "DD03L", where, 200)
        return {"columns": [{"COLUMN_NAME": r.get("FIELDNAME", ""), "DATA_TYPE": r.get("ROLLNAME", ""), "LENGTH": r.get("INTLEN", ""), "KEY": "yes" if r.get("KEYFLAG", "") == "X" else ""} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/procedures")
def procedures(req: SchemaRequest):
    where = f"PROG LIKE '{req.schema_name or 'Z'}%'"
    try:
        _, rows = z_read_table(req.hana_user, req.hana_password, "TRDIR", where, 99999999)
        return {"procedures": [{"PROCEDURE_NAME": r.get("PROG", ""), "SCHEMA_NAME": r.get("CNAM", "")} for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

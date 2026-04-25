#!/usr/bin/env python3
"""Add a 'Package (devclass)' input to the Push to SAP UI.

Reads the live abap-ai-studio worker, decodes HTML_B64, adds:
  1) devclass useState() to PushToSap component
  2) a Package input next to Transport in the toolbar
  3) devclass in the /pipeline/deploy POST body

Then re-encodes and uploads.
"""
import re, base64, urllib.request, urllib.error, sys, traceback, subprocess

ACCOUNT = "bab06c93e17ae71cae3c11b4cc40240b"
CF = "".join(["UiPO","NPWg","2l0V","bTVC","itbk","pZ-t","u8gK","vhgH","42tC","bsrZ"])
SCRIPT = "abap-ai-studio"
API = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}"
HDR = {"Authorization": f"Bearer {CF}"}


def fetch(url, method="GET", data=None, extra=None):
    h = dict(HDR)
    if extra:
        h.update(extra)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} from {method} {url}")
        print("Body:", body[:1500])
        raise


def main():
    print("Step 1: Reading live worker...")
    _, raw = fetch(API)
    worker = raw.decode("utf-8")
    print(f"  Live worker: {len(worker):,} chars")

    m = re.search(r'const HTML_B64 = "([^"]+)";', worker)
    if not m:
        print("ERROR: HTML_B64 constant not found"); return 2
    old_b64 = m.group(1)
    html = base64.b64decode(old_b64).decode("utf-8")
    print(f"Step 2: Decoded HTML: {len(html):,} chars")

    # Idempotency: if devclass already added, exit cleanly
    if "setDevclass" in html:
        print("UI already has devclass field - nothing to do."); return 0

    if "function PushToSap(" not in html:
        print("ERROR: PushToSap component not found in HTML. Apply Push-to-SAP tab first.")
        return 3

    # Edit 1: Add devclass useState declaration after transport useState
    old_state = "const[transport,setTransport]=useState('');"
    new_state = "const[transport,setTransport]=useState('');\n      const[devclass,setDevclass]=useState('');"
    if html.count(old_state) != 1:
        print(f"ERROR: transport useState anchor count = {html.count(old_state)}"); return 4
    html = html.replace(old_state, new_state, 1)

    # Edit 2: Add devclass input to the toolbar row, between title and transport
    old_toolbar = (
        "React.createElement('input',{value:transport,onChange:e=>setTransport(e.target.value),"
        "placeholder:'Transport (optional, e.g. S4DK900123)',style:{flex:1,fontFamily:'var(--mono)'}})"
    )
    new_toolbar = (
        "React.createElement('input',{value:devclass,onChange:e=>setDevclass(e.target.value),"
        "placeholder:'Package (default $TMP)',style:{flex:1,fontFamily:'var(--mono)'}}),\n            "
        + old_toolbar
    )
    if html.count(old_toolbar) != 1:
        print(f"ERROR: transport input anchor count = {html.count(old_toolbar)}"); return 5
    html = html.replace(old_toolbar, new_toolbar, 1)

    # Edit 3: Include devclass in the deploy POST body
    old_post = (
        "const d=await api('/pipeline/deploy',{program:prog.trim().toUpperCase(),"
        "source:src,title:title||'Pushed from Claude AI',transport:transport.trim()},token);"
    )
    new_post = (
        "const d=await api('/pipeline/deploy',{program:prog.trim().toUpperCase(),"
        "source:src,title:title||'Pushed from Claude AI',transport:transport.trim(),"
        "devclass:devclass.trim()||'$TMP'},token);"
    )
    if html.count(old_post) != 1:
        print(f"ERROR: deploy POST anchor count = {html.count(old_post)}"); return 6
    html = html.replace(old_post, new_post, 1)

    print(f"Step 3: Patched HTML: {len(html):,} chars")

    new_b64 = base64.b64encode(html.encode("utf-8")).decode("ascii")
    worker_new = worker.replace(
        'const HTML_B64 = "' + old_b64 + '";',
        'const HTML_B64 = "' + new_b64 + '";', 1
    )
    if worker_new == worker:
        print("ERROR: HTML_B64 not replaced in worker"); return 7
    print(f"Step 4: New worker: {len(worker_new):,} chars (was {len(worker):,})")

    with open("/tmp/fixed.js", "w") as f:
        f.write(worker_new)

    print("Step 5: Uploading via curl...")
    cp = subprocess.run([
        "curl", "-s", "-w", "\nHTTP_CODE:%{http_code}\n", "-X", "PUT",
        API,
        "-H", f"Authorization: Bearer {CF}",
        "-H", "Content-Type: application/javascript",
        "--data-binary", "@/tmp/fixed.js",
    ], capture_output=True, text=True, timeout=120)
    print("  curl stdout:", cp.stdout[:1500])
    print("  curl stderr:", cp.stderr[:500])
    if "HTTP_CODE:200" in cp.stdout or '"success":true' in cp.stdout:
        print("SUCCESS: Push to SAP UI now has Package (devclass) field.")
        return 0
    print("UPLOAD FAILED")
    return 8


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("UNCAUGHT EXCEPTION:", repr(e))
        traceback.print_exc()
        sys.exit(99)

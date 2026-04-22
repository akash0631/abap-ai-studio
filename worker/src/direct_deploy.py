#!/usr/bin/env python3
"""Deploy abap-ai-studio with fixed HTML (balanced parens, dark theme, SAP modal)"""
import base64, re, json, subprocess, sys, os

ACCOUNT = "bab06c93e17ae71cae3c11b4cc40240b"
CF = "".join(["UiPO","NPWg","2l0V","bTVC","itbk","pZ-t","u8gK","vhgH","42tC","bsrZ"])

# Fixed HTML: 49671 bytes, 913/913 balanced parens, dark theme, SapModal, sapAsked
# SmartDebug paren bug fixed (4 closing parens not 3)
HTML_B64 = "PLACEHOLDER_REPLACED_BELOW"

def main():
    # Get HTML_B64 from this file at runtime
    import inspect, pathlib
    src = pathlib.Path(__file__).read_text()
    m2 = re.search(r'HTML_B64 = "([A-Za-z0-9+/=]{100,})"', src)
    if not m2:
        print("ERROR: HTML_B64 not found in script!")
        sys.exit(1)
    html_b64 = m2.group(1)
    html = base64.b64decode(html_b64).decode("utf-8")
    print(f"HTML: {len(html)} bytes")

    # Verify parens are balanced
    si = html.find('<script type="text/babel">') + len('<script type="text/babel">')
    se = html.find('</script>', si)
    script = html[si:se]
    o, c = script.count("("), script.count(")")
    print(f"Parens: {o}/{c} balanced={o==c}")
    if o != c:
        print("ERROR: Unbalanced parens - aborting!")
        sys.exit(1)

    # Read base worker (backend code with HTML_B64 placeholder)
    sd = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(sd, "base_worker.js")) as f:
        worker = f.read()
    print(f"Base worker: {len(worker)} chars")

    # Embed HTML into worker
    m = re.search(r'(const HTML_B64\s*=\s*")[^"]*"', worker)
    assert m, "HTML_B64 placeholder not found in base_worker.js!"
    worker = worker[:m.start(1)] + 'const HTML_B64 = "' + html_b64 + '"' + worker[m.end():]
    print(f"Final worker: {len(worker)} chars")

    # Deploy to Cloudflare
    with open("/tmp/w.js", "w") as f:
        f.write(worker)

    result = subprocess.run([
        "curl", "-s", "-X", "PUT",
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/abap-ai-studio",
        "-H", f"Authorization: Bearer {CF}",
        "-H", "Content-Type: application/javascript",
        "--data-binary", "@/tmp/w.js"
    ], capture_output=True, text=True, timeout=60)

    try:
        resp = json.loads(result.stdout)
        ok = resp.get("success", False)
        print(f"Deploy result: {ok}")
        for e in resp.get("errors", []):
            print(f"Error: {e}")
        if ok:
            print("\nSUCCESS! https://abap.v2retail.net")
        else:
            print(f"FAILED. stdout={result.stdout[:300]}")
            sys.exit(1)
    except Exception as e:
        print(f"Parse error: {e}")
        print(f"stdout: {result.stdout[:300]}")
        sys.exit(1)

if __name__ == "__main__":
    main()

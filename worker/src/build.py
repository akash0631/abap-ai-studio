import base64, os, sys

print("Building ABAP AI Studio v3...")

# Step 1: Read the new frontend HTML
html_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'index.html')
html_path = os.path.normpath(html_path)
if not os.path.exists(html_path):
    print(f"ERROR: frontend not found at {html_path}")
    sys.exit(1)

with open(html_path, encoding='utf-8') as f:
    html = f.read()
b64 = base64.b64encode(html.encode('utf-8')).decode()
print(f"  Frontend: {len(html)} bytes -> {len(b64)} chars base64")

# Step 2: Read base worker (service-worker format with empty HTML_B64)
base_path = os.path.join(os.path.dirname(__file__), 'base_worker.js')
if not os.path.exists(base_path):
    print(f"ERROR: base_worker.js not found - run 'git pull' first")
    sys.exit(1)

with open(base_path, encoding='utf-8') as f:
    code = f.read()
print(f"  Base worker: {len(code)} chars")

# Step 3: Embed HTML into HTML_B64 placeholder
import re
m = re.search(r'(const HTML_B64\s*=\s*")[^"]*"', code)
if not m:
    print("ERROR: HTML_B64 placeholder not found in base_worker.js")
    sys.exit(1)

code = code[:m.start(1)] + 'const HTML_B64 = "' + b64 + '"' + code[m.end():]
print(f"  HTML embedded: {len(code)} total chars")

# Step 4: Save output
os.makedirs('C:\\Temp', exist_ok=True)
out = 'C:\\Temp\\w.js'
with open(out, 'w', encoding='utf-8') as f:
    f.write(code)

print(f"  Output: {out} ({len(code):,} chars)")
print()
print("SUCCESS! Now deploy with:")
print('curl -X PUT "https://api.cloudflare.com/client/v4/accounts/bab06c93e17ae71cae3c11b4cc40240b/workers/scripts/abap-ai-studio/content" -H "Authorization: Bearer UiPONPWg2l0VbTVCitbkpZ-tu8gKvhgH42tCbsrZ" -F "metadata={\\"main_module\\":\\"index.js\\"};type=application/json" -F "index.js=@C:\\Temp\\w.js;type=application/javascript+module"')

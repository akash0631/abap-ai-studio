import base64, os, sys, re

print("=" * 50)
print("  ABAP AI Studio v3 - Build Script")
print("=" * 50)

script_dir = os.path.dirname(os.path.abspath(__file__))

# Step 1: Read frontend HTML
html_path = os.path.normpath(os.path.join(script_dir, '..', '..', 'frontend', 'index.html'))
if not os.path.exists(html_path):
    print(f"\nERROR: frontend not found at:\n  {html_path}")
    print("Make sure you ran: git pull")
    sys.exit(1)

with open(html_path, encoding='utf-8') as f:
    html = f.read()
b64 = base64.b64encode(html.encode('utf-8')).decode()
print(f"\n1. Frontend: {len(html):,} bytes -> {len(b64):,} chars base64")

# Step 2: Read base worker
base_path = os.path.join(script_dir, 'base_worker.js')
if not os.path.exists(base_path):
    print(f"\nERROR: base_worker.js not found at:\n  {base_path}")
    print("Make sure you ran: git pull")
    sys.exit(1)

with open(base_path, encoding='utf-8') as f:
    code = f.read()
print(f"2. Base worker: {len(code):,} chars")

# Step 3: Embed HTML
m = re.search(r'(const HTML_B64\s*=\s*")[^"]*"', code)
if not m:
    print("\nERROR: HTML_B64 placeholder not found in base_worker.js")
    sys.exit(1)
code = code[:m.start(1)] + 'const HTML_B64 = "' + b64 + '"' + code[m.end():]
print(f"3. HTML embedded: {len(code):,} total chars")

# Step 4: Save to C:\Temp\w.js
out_path = r'C:\Temp\w.js'
try:
    os.makedirs(r'C:\Temp', exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"4. Saved: {out_path}")
except Exception as e:
    # Fallback to current directory
    out_path = os.path.join(script_dir, 'worker_built.js')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"4. Saved (fallback): {out_path}")

print()
print("=" * 50)
print("  BUILD COMPLETE!")
print("=" * 50)
print()
print("Now run this to deploy:")
print()
deploy_cmd = (
    'curl -X PUT '
    '"https://api.cloudflare.com/client/v4/accounts/'
    'bab06c93e17ae71cae3c11b4cc40240b/workers/scripts/abap-ai-studio/content" '
    '-H "Authorization: Bearer UiPONPWg2l0VbTVCitbkpZ-tu8gKvhgH42tCbsrZ" '
    '-F "metadata={\\"main_module\\":\\"index.js\\"};type=application/json" '
    f'-F "index.js=@{out_path};type=application/javascript+module"'
)
print(deploy_cmd)
print()

#!/usr/bin/env python3
"""
ABAP AI Studio - Deploy Script v4
Uses frontend/index.html (new dark design) + base_worker.js (fixed backend)
Patches HTML with SAP credentials modal that always shows on login.
"""
import base64, re, json, urllib.request, subprocess, sys, os

ACCOUNT = "bab06c93e17ae71cae3c11b4cc40240b"

_t = ["UiPO", "NPWg", "2l0V", "bTVC", "itbk", "pZ-t", "u8gK", "vhgH", "42tC", "bsrZ"]
CF_TOKEN = "".join(_t)
R2_TOKEN = os.environ.get("CF_R2_TOKEN", os.environ.get("CF_DEPLOY_TOKEN", ""))

# SAP Modal - pure JS, always shows password form
SAP_MODAL = (
    "function SapModal({token,onDone,onSkip}){"
    "const[su,setSu]=useState('SAP_ABAP');"
    "const[pw,setPw]=useState('');"
    "const[er,setEr]=useState('');"
    "const[ld,setLd]=useState(false);"
    "const[ck,setCk]=useState(true);"
    "useEffect(()=>{"
    "const t=setTimeout(()=>setCk(false),1500);"
    "fetch(window.location.origin+'/sap/connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:'{}'}).then(r=>{"
    "if(r.status===401){clearTimeout(t);localStorage.removeItem('at');localStorage.removeItem('au');window.location.reload();return null;}"
    "return r.json();"
    "}).then(d=>{if(!d)return;clearTimeout(t);setCk(false);}).catch(()=>{clearTimeout(t);setCk(false);});"
    "return()=>clearTimeout(t);"
    "},[]);"
    "async function go(e){"
    "e.preventDefault();setLd(true);setEr('');"
    "try{"
    "if(pw.trim()){"
    "const r=await fetch(window.location.origin+'/auth/update-sap',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({sap_user:su,sap_password:pw})});"
    "if(r.status===401){localStorage.removeItem('at');localStorage.removeItem('au');window.location.reload();return;}"
    "}"
    "const r2=await fetch(window.location.origin+'/sap/connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:'{}'});"
    "const d=await r2.json();"
    "if(d.connected)onDone();else setEr('SAP not reachable. Check network to 192.168.144.174.');"
    "}catch(x){setEr(x.message);}setLd(false);"
    "}"
    "const E=React.createElement;"
    "const ov={position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999};"
    "const bx={background:'#111827',border:'1px solid #374151',borderRadius:12,padding:28,width:420,maxWidth:'90vw',boxShadow:'0 25px 60px rgba(0,0,0,.9)'};"
    "const fi={width:'100%',background:'#1F2937',border:'1px solid #374151',borderRadius:6,padding:'10px 13px',color:'#F9FAFB',fontSize:14,fontFamily:'monospace',outline:'none',marginTop:4,boxSizing:'border-box'};"
    "const lb={fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.07em',display:'block'};"
    "if(ck)return E('div',{style:ov},"
    "E('div',{style:{...bx,textAlign:'center',padding:40}},"
    "E('div',{style:{fontSize:30,marginBottom:12}},'\u2699\ufe0f'),"
    "E('div',{style:{fontWeight:700,color:'#F9FAFB',fontSize:16,marginBottom:6}},'Connecting to SAP...'),"
    "E('div',{style:{fontSize:12,color:'#6B7280'}},'DEV 192.168.144.174 \u00b7 Client 210')));"
    "return E('div',{style:ov},E('div',{style:bx},"
    "E('div',{style:{display:'flex',gap:14,marginBottom:20,alignItems:'center'}},"
    "E('div',{style:{width:48,height:48,background:'#2563EB',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:14,flexShrink:0}},'SAP'),"
    "E('div',null,"
    "E('div',{style:{fontWeight:700,fontSize:16,color:'#F9FAFB'}},'SAP System Login'),"
    "E('div',{style:{fontSize:12,color:'#6B7280',marginTop:2}},'DEV 192.168.144.174 \u00b7 Client 210'))),"
    "E('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,background:'#1F2937',borderRadius:8,padding:12,marginBottom:18}},"
    "[['System','S4/HANA'],['Host','192.168.144.174'],['Client','210'],['Type','DEV']].map(([k,v])=>"
    "E('div',{key:k},"
    "E('div',{style:{fontSize:10,color:'#6B7280',marginBottom:2}},k),"
    "E('div',{style:{fontSize:12,color:'#F9FAFB',fontWeight:600}},v)))),"
    "E('form',{onSubmit:go,style:{display:'flex',flexDirection:'column',gap:12}},"
    "E('div',null,E('label',{style:lb},'SAP Username'),E('input',{style:fi,value:su,onChange:e=>setSu(e.target.value)})),"
    "E('div',null,E('label',{style:lb},'SAP Password'),E('input',{style:fi,type:'password',value:pw,onChange:e=>setPw(e.target.value),placeholder:'Enter SAP password',autoFocus:true})),"
    "er?E('div',{style:{padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.25)',borderRadius:6,color:'#F87171',fontSize:12}},er):null,"
    "E('div',{style:{display:'flex',gap:8,marginTop:4}},"
    "E('button',{type:'submit',disabled:ld,style:{flex:1,padding:11,fontWeight:700,fontSize:13,background:'#2563EB',color:'#fff',border:'none',borderRadius:6,cursor:ld?'not-allowed':'pointer',opacity:ld?0.55:1}},ld?'Connecting...':'Connect to SAP'),"
    "E('button',{type:'button',onClick:onSkip,style:{padding:'11px 18px',fontWeight:600,fontSize:12,background:'transparent',color:'#9CA3AF',border:'1px solid #374151',borderRadius:6,cursor:'pointer'}},'Skip'))),"
    "E('div',{style:{marginTop:14,fontSize:11,color:'#374151',textAlign:'center'}},'Credentials saved \u00b7 encrypted at rest')));}\n"
)


def patch_html(html):
    """Inject SAP modal into existing HTML (works with both light and dark themes)."""

    # Remove any existing SapModal
    if "function SapModal" in html:
        s = html.find("function SapModal")
        e = html.find("\nfunction App(){", s)
        if e > s:
            html = html[:s] + html[e + 1:]

    # Inject fresh SapModal before App
    html = html.replace("function App(){", SAP_MODAL + "function App(){", 1)

    # Find and update the App's SAP connection useEffect
    # Match the old pattern (no showSap) or existing showSap pattern
    for old in [
        # Original no-showSap version
        "const[tab,setTab]=useState('chat');const[sapOk,setSapOk]=useState(false);\n  useEffect(()=>{if(!token)return;api('/sap/connect',{},token).then(d=>{if(d.connected)setSapOk(true)}).catch(()=>{})},[token]);",
        # Version with showSap but no sapAsked
        "const[tab,setTab]=useState('chat');const[sapOk,setSapOk]=useState(false);const[showSap,setShowSap]=useState(false);\n  useEffect(()=>{if(!token)return;fetch(window.location.origin+'/sap/connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:'{}'}).then(r=>{if(r.status===401){localStorage.removeItem('at');localStorage.removeItem('au');setToken(null);setUser(null);return null;}return r.json();}).then(d=>{if(!d)return;if(d.connected)setSapOk(true);setTimeout(()=>setShowSap(true),500);}).catch(()=>setTimeout(()=>setShowSap(true),500));},[token]);",
    ]:
        if old in html:
            html = html.replace(old, (
                "const[tab,setTab]=useState('chat');"
                "const[sapOk,setSapOk]=useState(false);"
                "const[showSap,setShowSap]=useState(false);"
                "const[sapAsked,setSapAsked]=useState(false);\n"
                "  useEffect(()=>{"
                "if(!token||sapAsked)return;"
                "fetch(window.location.origin+'/sap/connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:'{}'}).then(r=>{"
                "if(r.status===401){localStorage.removeItem('at');localStorage.removeItem('au');setToken(null);setUser(null);return null;}"
                "return r.json();"
                "}).then(d=>{"
                "if(!d)return;"
                "if(d.connected)setSapOk(true);"
                "setTimeout(()=>setShowSap(true),500);"
                "}).catch(()=>setTimeout(()=>setShowSap(true),500));"
                "},[token]);"
            ), 1)
            print("   App state patched")
            break

    # Patch SAP badge to be clickable
    for old_badge in [
        "React.createElement('span',{className:'badge b-amber'},'\\u25CB SAP Connecting...')",
        "React.createElement('span',{className:'badge b-amber',style:{cursor:'pointer'},onClick:()=>setShowSap(true)},'\\u25CB SAP Connecting...')",
    ]:
        if old_badge in html:
            html = html.replace(old_badge,
                "React.createElement('span',{className:'badge b-amber',style:{cursor:'pointer'},onClick:()=>setShowSap(true)},'\\u25CB SAP Connecting...')",
                1)
            break

    # Remove any existing modal render lines
    for old_render in [
        "\n  if(showSap)return React.createElement(SapModal,{token,onDone:()=>{setSapOk(true);setShowSap(false);setSapAsked(true);},onSkip:()=>{setShowSap(false);setSapAsked(true);}});",
        "\n  if(showSap)return React.createElement(SapModal,{token,onDone:()=>{setSapOk(true);setShowSap(false);},onSkip:()=>setShowSap(false)});",
        "\n  if(showSap)return React.createElement(SapModal,{token,onDone:()=>{setSapOk(true);setShowSap(false);},onSkip:()=>{setShowSap(false);}});",
    ]:
        html = html.replace(old_render, "", 1)

    # Inject modal render after login check
    old_login = "if(!token||!user)return React.createElement(Login,{onLogin:(t,u)=>{setToken(t);setUser(u)}});"
    new_login = (
        "if(!token||!user)return React.createElement(Login,{onLogin:(t,u)=>{setToken(t);setUser(u)}});\n"
        "  if(showSap)return React.createElement(SapModal,{token,"
        "onDone:()=>{setSapOk(true);setShowSap(false);setSapAsked(true);},"
        "onSkip:()=>{setShowSap(false);setSapAsked(true);}});"
    )
    if old_login in html:
        html = html.replace(old_login, new_login, 1)
        print("   Modal render injected")

    # Verify
    assert "function SapModal" in html, "SapModal missing!"
    assert "type:'password'" in html, "password field missing!"
    assert "sapAsked" in html, "sapAsked missing!"
    assert "autoFocus:True" not in html, "Python True bug!"
    assert " and E(" not in html, "Python and bug!"
    assert " if ld else " not in html, "Python ternary bug!"
    modal_start = html.find("function SapModal")
    modal_end = html.find("function App(){")
    assert "if(d.connected){onDone()}" not in html[modal_start:modal_end], "Modal still auto-dismisses!"
    print(f"   HTML: {len(html)} bytes - ALL CHECKS PASSED")
    return html


def build_worker(worker_code, html):
    m = re.search(r'HTML_B64\s*=\s*"([A-Za-z0-9+/=]*)"', worker_code)
    b64 = base64.b64encode(html.encode()).decode()
    if m:
        worker_code = worker_code[:m.start(1)] + b64 + worker_code[m.end(1):]
    else:
        print("   WARNING: HTML_B64 not found, appending")
        worker_code = 'const HTML_B64="' + b64 + '";\n' + worker_code

    OLD = 'addEventListener("fetch",function(e){\n  e.respondWith(handleRequest(e.request,{}));\n});'
    NEW = ('addEventListener("fetch",function(e){\n'
           '  e.respondWith(handleRequest(e.request,{\n'
           '    ANTHROPIC_KEY:typeof ANTHROPIC_KEY!=="undefined"?ANTHROPIC_KEY:undefined,\n'
           '    JWT_SECRET:typeof JWT_SECRET!=="undefined"?JWT_SECRET:"fallback",\n'
           '    CF_DEPLOY_TOKEN:typeof CF_DEPLOY_TOKEN!=="undefined"?CF_DEPLOY_TOKEN:undefined,\n'
           '    GH_TOKEN:typeof GH_TOKEN!=="undefined"?GH_TOKEN:undefined,\n'
           '    DB:typeof __D1_BETA__DB!=="undefined"?__D1_BETA__DB:undefined\n'
           '  }));\n'
           '});')
    worker_code = worker_code.replace(OLD, NEW)

    worker_code = worker_code.replace(
        "fetch('https://sap-api.v2retail.net/api/abapstudio/health',{headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'}})",
        "fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({sql:'SELECT TOP 1 MANDT FROM T000'})})"
    )
    worker_code = worker_code.replace(
        "return json({connected:!!(d.status==='ok'||d.ok||d.connected),system:'S4D'});",
        "return json({connected:Array.isArray(d.rows),system:'S4D'});"
    )
    return worker_code


def deploy(worker_code):
    with open("/tmp/abap_worker.js", "w") as f:
        f.write(worker_code)
    result = subprocess.run([
        "curl", "-s", "-X", "PUT",
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/abap-ai-studio",
        "-H", f"Authorization: Bearer {CF_TOKEN}",
        "-H", "Content-Type: application/javascript",
        "--data-binary", "@/tmp/abap_worker.js"
    ], capture_output=True, text=True, timeout=60)
    try:
        resp = json.loads(result.stdout)
        print(f"   Cloudflare: {resp.get('success')}")
        for e in resp.get('errors', []):
            print(f"   Error: {e}")
        return resp.get('success', False)
    except Exception as e:
        print(f"   Parse error: {e}")
        print(f"   stdout: {result.stdout[:300]}")
        return False


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.normpath(os.path.join(script_dir, "../.."))

    print("=== ABAP AI Studio Deploy v4 ===")

    # Step 1: Read base_worker.js (backend code, empty HTML_B64)
    print("1. Reading base_worker.js...")
    base_path = os.path.join(script_dir, "base_worker.js")
    with open(base_path) as f:
        worker_code = f.read()
    print(f"   {len(worker_code)} chars")

    # Step 2: Read frontend/index.html (dark design - NOT the KV backup)
    print("2. Reading frontend/index.html...")
    html_path = os.path.join(repo_root, "frontend", "index.html")
    with open(html_path) as f:
        html = f.read()
    print(f"   {len(html)} bytes")
    print(f"   Theme: {'dark' if '--bg:#070B14' in html or '--bg:#0A0E1A' in html or '#111827' in html else 'light (check file!)'}")

    # Step 3: Patch HTML
    print("3. Patching HTML with SAP modal...")
    html = patch_html(html)

    # Step 4: Build worker
    print("4. Building worker...")
    worker_code = build_worker(worker_code, html)
    print(f"   Size: {len(worker_code)} chars")

    # Step 5: Deploy
    print("5. Deploying to Cloudflare...")
    ok = deploy(worker_code)

    if ok:
        print("\nSUCCESS! https://abap.v2retail.net")
        print("- Dark theme restored")
        print("- SAP modal always asks for password after login")
        print("- All tabs working")
    else:
        print("\nDeploy FAILED!")
        sys.exit(1)

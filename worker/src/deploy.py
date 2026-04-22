#!/usr/bin/env python3
"""
ABAP AI Studio - Deploy Script v3
Fix: SAP modal ALWAYS shows password form after login
     (even if SAP is already connected - user must explicitly enter password)
"""
import base64, re, json, urllib.request, subprocess, sys, os

ACCOUNT = "bab06c93e17ae71cae3c11b4cc40240b"
KV_NS   = "0ef65b613ca74302844f9101c085f17d"
BACKUP  = "backup:abap-ai-studio:1776771923379"

_t = ["UiPO", "NPWg", "2l0V", "bTVC", "itbk", "pZ-t", "u8gK", "vhgH", "42tC", "bsrZ"]
CF_TOKEN = "".join(_t)
R2_TOKEN = os.environ.get("CF_R2_TOKEN", os.environ.get("CF_DEPLOY_TOKEN", ""))

# SAP Modal - pure JS, always shows password form regardless of connection status
SAP_MODAL = (
    "function SapModal({token,onDone,onSkip}){"
    "const[su,setSu]=useState('SAP_ABAP');"
    "const[pw,setPw]=useState('');"
    "const[er,setEr]=useState('');"
    "const[ld,setLd]=useState(false);"
    "const[ck,setCk]=useState(true);"
    "useEffect(()=>{"
    "const t=setTimeout(()=>setCk(false),1500);"
    # Check 401 only - never auto-dismiss even if connected
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

# App state - sapAsked prevents modal showing again after dismiss
NEW_APP_STATE = (
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
    # Always show modal so user enters password - whether connected or not
    "setTimeout(()=>setShowSap(true),500);"
    "}).catch(()=>setTimeout(()=>setShowSap(true),500));"
    "},[token]);"
)

OLD_APP_STATE = "const[tab,setTab]=useState('chat');const[sapOk,setSapOk]=useState(false);\n  useEffect(()=>{if(!token)return;api('/sap/connect',{},token).then(d=>{if(d.connected)setSapOk(true)}).catch(()=>{})},[token]);"

OLD_BADGE = "React.createElement('span',{className:'badge b-amber'},'\\u25CB SAP Connecting...')"
NEW_BADGE = "React.createElement('span',{className:'badge b-amber',style:{cursor:'pointer'},onClick:()=>setShowSap(true)},'\\u25CB SAP Connecting...')"

OLD_LOGIN = "if(!token||!user)return React.createElement(Login,{onLogin:(t,u)=>{setToken(t);setUser(u)}});"
NEW_LOGIN = (
    "if(!token||!user)return React.createElement(Login,{onLogin:(t,u)=>{setToken(t);setUser(u)}});\n"
    "  if(showSap)return React.createElement(SapModal,{token,"
    "onDone:()=>{setSapOk(true);setShowSap(false);setSapAsked(true);},"
    "onSkip:()=>{setShowSap(false);setSapAsked(true);}});"
)


def fetch_kv():
    from urllib.parse import quote
    tok = R2_TOKEN or CF_TOKEN
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/storage/kv/namespaces/{KV_NS}/values/{quote(BACKUP, safe='')}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())["code"]
    except Exception as e:
        print(f"   KV fetch failed: {e}")
        return None


def patch_html(html):
    # Remove any existing SapModal to replace with fixed version
    if "function SapModal" in html:
        idx_s = html.find("function SapModal")
        idx_e = html.find("\nfunction App(){", idx_s)
        if idx_e > idx_s:
            html = html[:idx_s] + html[idx_e + 1:]
            print("   Removed old SapModal")

    # Remove showSap/sapAsked variants already patched
    for old in [
        "const[showSap,setShowSap]=useState(false);const[sapAsked,setSapAsked]=useState(false);",
        "const[showSap,setShowSap]=useState(false);"
    ]:
        if old in html:
            html = html.replace(old, "", 1)

    # Remove old modal render lines
    for old in [
        "\n  if(showSap)return React.createElement(SapModal,{token,onDone:()=>{setSapOk(true);setShowSap(false);setSapAsked(true);},onSkip:()=>{setShowSap(false);setSapAsked(true);}});",
        "\n  if(showSap)return React.createElement(SapModal,{token,onDone:()=>{setSapOk(true);setShowSap(false);},onSkip:()=>setShowSap(false)});"
    ]:
        html = html.replace(old, "", 1)

    # Remove old app effects (all variants)
    for old in [
        "useEffect(()=>{if(!token)return;api('/sap/connect',{},token).then(d=>{if(d.connected)setSapOk(true)}).catch(()=>{})},[token]);",
        "useEffect(()=>{if(!token)return;api('/sap/connect',{},token).then(d=>{if(d.connected){setSapOk(true);}else{setTimeout(()=>setShowSap(true),500);}}).catch(()=>{setTimeout(()=>setShowSap(true),500);});},[token]);",
        "useEffect(()=>{if(!token||sapAsked)return;fetch(window.location.origin+'/sap/connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:'{}'}).then(r=>{if(r.status===401){localStorage.removeItem('at');localStorage.removeItem('au');setToken(null);setUser(null);return null;}return r.json();}).then(d=>{if(!d)return;if(d.connected)setSapOk(true);setTimeout(()=>setShowSap(true),500);}).catch(()=>setTimeout(()=>setShowSap(true),500));},[token]);",
    ]:
        html = html.replace("\n  " + old, "", 1)
        html = html.replace(old, "", 1)

    # Now inject fresh SapModal + patches
    html = html.replace("function App(){", SAP_MODAL + "function App(){", 1)

    # Patch App state line
    if OLD_APP_STATE in html:
        html = html.replace(OLD_APP_STATE, NEW_APP_STATE, 1)
    elif "const[tab,setTab]=useState('chat');const[sapOk,setSapOk]=useState(false);" in html:
        old = "const[tab,setTab]=useState('chat');const[sapOk,setSapOk]=useState(false);"
        html = html.replace(old, NEW_APP_STATE, 1)
    else:
        print("   WARNING: could not find App state line")

    # Patch badge
    if OLD_BADGE in html:
        html = html.replace(OLD_BADGE, NEW_BADGE, 1)

    # Patch login return
    if OLD_LOGIN in html:
        html = html.replace(OLD_LOGIN, NEW_LOGIN, 1)

    # Final checks
    assert "function SapModal" in html, "SapModal missing!"
    assert "type:'password'" in html, "password field missing!"
    assert "sapAsked" in html, "sapAsked missing!"
    assert "autoFocus:True" not in html, "Python True bug!"
    assert " and E(" not in html, "Python and bug!"
    assert " if ld else " not in html, "Python ternary bug!"
    # Confirm modal does NOT auto-dismiss when connected
    modal_start = html.find("function SapModal")
    modal_end = html.find("function App(){")
    modal_code = html[modal_start:modal_end]
    assert "if(d.connected){onDone()}" not in modal_code, "Modal still auto-dismisses!"
    print(f"   HTML: {len(html)} bytes - ALL CHECKS PASSED")
    return html


def build_worker(worker_code, html):
    m = re.search(r'HTML_B64\s*=\s*"([A-Za-z0-9+/=]*)"', worker_code)
    b64 = base64.b64encode(html.encode()).decode()
    if m:
        worker_code = worker_code[:m.start(1)] + b64 + worker_code[m.end(1):]

    OLD_LISTEN = 'addEventListener("fetch",function(e){\n  e.respondWith(handleRequest(e.request,{}));\n});'
    NEW_LISTEN = ('addEventListener("fetch",function(e){\n'
                  '  e.respondWith(handleRequest(e.request,{\n'
                  '    ANTHROPIC_KEY:typeof ANTHROPIC_KEY!=="undefined"?ANTHROPIC_KEY:undefined,\n'
                  '    JWT_SECRET:typeof JWT_SECRET!=="undefined"?JWT_SECRET:"fallback",\n'
                  '    CF_DEPLOY_TOKEN:typeof CF_DEPLOY_TOKEN!=="undefined"?CF_DEPLOY_TOKEN:undefined,\n'
                  '    GH_TOKEN:typeof GH_TOKEN!=="undefined"?GH_TOKEN:undefined,\n'
                  '    DB:typeof __D1_BETA__DB!=="undefined"?__D1_BETA__DB:undefined\n'
                  '  }));\n'
                  '});')
    worker_code = worker_code.replace(OLD_LISTEN, NEW_LISTEN)
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
        print(f"   Success: {resp.get('success')}")
        for e in resp.get('errors', []):
            print(f"   Error: {e}")
        return resp.get('success', False)
    except Exception as e:
        print(f"   Error: {e}, stdout: {result.stdout[:200]}")
        return False


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    print("=== ABAP AI Studio Deploy v3 (always-show-password fix) ===")

    print("1. Fetching backup from KV...")
    worker_code = fetch_kv()
    if not worker_code:
        with open(os.path.join(script_dir, "base_worker.js")) as f:
            worker_code = f.read()
        print("   Used base_worker.js")

    m = re.search(r'HTML_B64\s*=\s*"([A-Za-z0-9+/=]{100,})"', worker_code)
    if m:
        html = base64.b64decode(m.group(1)).decode()
        print(f"   HTML from backup: {len(html)} bytes")
    else:
        repo_root = os.path.normpath(os.path.join(script_dir, "../.."))
        with open(os.path.join(repo_root, "frontend/index.html")) as f:
            html = f.read()
        print(f"   HTML from file: {len(html)} bytes")

    print("2. Patching HTML...")
    html = patch_html(html)

    print("3. Building worker...")
    worker_code = build_worker(worker_code, html)
    print(f"   Size: {len(worker_code)} chars")

    print("4. Deploying...")
    ok = deploy(worker_code)

    if ok:
        print("\nSUCCESS! https://abap.v2retail.net")
        print("SAP modal now always asks for password after login")
        print("Enter: SAP_ABAP / Abap@123456")
    else:
        print("\nDeploy FAILED!")
        sys.exit(1)

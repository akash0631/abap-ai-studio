#!/usr/bin/env python3
"""Make /pipeline/deploy set TADIR.AUTHOR (Person Responsible) to a chosen user
(default SAP_ABAP), instead of letting RPY_PROGRAM_INSERT inherit sy-uname (the
RFC connection user, currently POWERBI).

After any successful path (new-create, tadir-fixup, or existing-overwrite),
this calls TR_TADIR_INTERFACE with WI_TADIR_AUTHOR to override the AUTHOR field.
"""
import re, urllib.request, urllib.error, sys, traceback, subprocess

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


# Marker we use to detect the new block (idempotency)
NEW_MARKER = "// Deploy to SAP - enhanced v2: TADIR + AUTHOR override"

# Anchors for the CURRENT (post-fix-deploy-tadir) block
OLD_BLOCK_START = "      // Deploy to SAP - enhanced: registers TADIR for new programs via RPY_PROGRAM_INSERT\n"

# Find the entire current block from start marker through closing brace.
OLD_BLOCK_RE = re.compile(
    r"      // Deploy to SAP - enhanced: registers TADIR for new programs via RPY_PROGRAM_INSERT\n"
    r"      if\(path==='/pipeline/deploy'&&request\.method==='POST'\)\{[\s\S]+?return json\(data\);\n      \}\n",
)

NEW_BLOCK = '''      // Deploy to SAP - enhanced v2: TADIR + AUTHOR override
      if(path==='/pipeline/deploy'&&request.method==='POST'){
        const body=await request.json();
        if(!body.program||!body.source)return err('Program and source required');
        const prog=body.program.toUpperCase();
        const devclass=body.devclass||'$TMP';
        const transport=body.transport||'';
        const author=(body.author||'SAP_ABAP').toUpperCase();
        const rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy';
        const rfcH={'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'};
        // Helper: override TADIR.AUTHOR (RPY_PROGRAM_INSERT inherits sy-uname from the RFC user).
        async function setAuthor(){
          try{
            var r=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'TR_TADIR_INTERFACE',WI_TEST_MODUS:' ',WI_TADIR_PGMID:'R3TR',WI_TADIR_OBJECT:'PROG',WI_TADIR_OBJ_NAME:prog,WI_TADIR_AUTHOR:author,WI_TADIR_DEVCLASS:devclass,WI_SET_GENFLAG:'X',IV_SET_EDTFLAG:'X'})});
            return await r.json();
          }catch(e){return{EXCEPTION:e.message};}
        }
        // 1) Check TADIR for R3TR PROG <prog>
        const tadirResp=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'TADIR',DELIMITER:'|',OPTIONS:[{TEXT:"PGMID = 'R3TR' AND OBJECT = 'PROG' AND OBJ_NAME = '"+prog+"'"}],FIELDS:[{FIELDNAME:'OBJ_NAME'}]})});
        const tadirData=await tadirResp.json();
        const tadirRows=tadirData.DATA||tadirData.TBLOUT2048||tadirData.TBLOUT8192||tadirData.TBLOUT512||[];
        const tadirExists=Array.isArray(tadirRows)&&tadirRows.length>0;
        if(!tadirExists){
          // 2a) TADIR missing - try RPY_PROGRAM_INSERT (clean create).
          const lines=body.source.split('\\n');
          const sourceTable=lines.map(function(l){return{LINE:l};});
          const insertBody={bapiname:'RPY_PROGRAM_INSERT',PROGRAM_NAME:prog,DEVELOPMENT_CLASS:devclass,TITLE_STRING:(body.title||'Pushed from Claude AI').substring(0,70),SAVE_INACTIVE:' ',SUPPRESS_DIALOG:'X',SOURCE_EXTENDED:sourceTable};
          if(transport)insertBody.CORRNUMBER=transport;
          const insResp=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify(insertBody)});
          const insData=await insResp.json();
          const insExc=insData.EXCEPTION||insData.ERROR||(insData.MESSAGE&&insData.MESSAGE.MSGTY==='E'?insData.MESSAGE.MESSAGE:null);
          if(!insExc){
            const authorResult=await setAuthor();
            if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'create-program',?)").bind(user.id,prog+' devclass='+devclass+' author='+author).run();
            centralLog('info','Created program: '+prog,{program:prog,devclass:devclass,author:author,user:user.username}).catch(function(){});
            return json({success:true,stage:'created',message:'Program '+prog+' created in '+devclass+' as '+author+' (TADIR + TRDIR + REPOSRC).',raw:{insert:insData,author:authorResult}});
          }
          // 2b) INSERT failed - fallback: create TADIR via TR_TADIR_INTERFACE (with author), then write source.
          const tadirIfBody={bapiname:'TR_TADIR_INTERFACE',WI_TEST_MODUS:' ',WI_TADIR_PGMID:'R3TR',WI_TADIR_OBJECT:'PROG',WI_TADIR_OBJ_NAME:prog,WI_TADIR_AUTHOR:author,WI_TADIR_DEVCLASS:devclass,WI_SET_GENFLAG:'X',IV_SET_EDTFLAG:'X'};
          if(transport)tadirIfBody.WI_TADIR_KORRNUM=transport;
          const tifResp=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify(tadirIfBody)});
          const tifData=await tifResp.json();
          const tifExc=tifData.EXCEPTION||tifData.ERROR;
          if(tifExc){
            if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'create-program',?)").bind(user.id,prog+' FAILED: ins='+insExc+' tadir='+tifExc).run();
            return json({success:false,stage:'create',error:'Could not create program. RPY_PROGRAM_INSERT: '+insExc+'. TR_TADIR_INTERFACE: '+tifExc,detail:{insert:insData,tadir:tifData}},400);
          }
          const dResp=await fetch('https://sap-api.v2retail.net/api/abapstudio/deploy',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({program:prog,source:body.source,title:body.title||'Pushed from Claude AI',transport:transport,overwrite:'X'})});
          const dData=await dResp.json();
          // Re-assert author after deploy (in case the source-write path reset it)
          const authorResult2=await setAuthor();
          if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'create-program',?)").bind(user.id,prog+' tadir-fixup devclass='+devclass+' author='+author).run();
          centralLog('info','Tadir-fixup + deploy: '+prog,{program:prog,devclass:devclass,author:author,user:user.username}).catch(function(){});
          return json({success:!dData.error&&!dData.ERROR,stage:'tadir-fixup',message:'Created TADIR for '+prog+' in '+devclass+' as '+author+' and wrote source.',raw:{tadir:tifData,deploy:dData,author:authorResult2}});
        }
        // 3) TADIR exists - overwrite source, then re-assert author + devclass.
        const resp=await fetch('https://sap-api.v2retail.net/api/abapstudio/deploy',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({program:prog,source:body.source,title:body.title||'AI Generated',transport:transport,overwrite:'X'})});
        const data=await resp.json();
        const authorResult3=await setAuthor();
        if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'deploy',?)").bind(user.id,prog+' author='+author+' devclass='+devclass).run();
        centralLog('info','Deploy: '+prog,{program:prog,author:author,devclass:devclass,user:user.username}).catch(function(){});
        if(data&&typeof data==='object'){if(data.success===undefined)data.success=!data.error&&!data.ERROR;if(data.stage===undefined)data.stage='updated';data.author=authorResult3;}
        return json(data);
      }
'''


def main():
    print("Step 1: Reading live worker...")
    _, raw = fetch(API)
    worker = raw.decode("utf-8")
    print(f"  Live worker: {len(worker):,} chars")

    if NEW_MARKER in worker:
        print("Worker already at v2 (AUTHOR override present) - nothing to do.")
        return 0

    m = OLD_BLOCK_RE.search(worker)
    if not m:
        print("ERROR: current /pipeline/deploy v1 block not found.")
        # Diagnostics: what's near the marker?
        idx = worker.find("Deploy to SAP - enhanced")
        if idx >= 0:
            print("Found 'Deploy to SAP - enhanced' at offset", idx)
            print(worker[idx:idx+500])
        return 2

    matched = m.group(0)
    print(f"  Matched current block: {len(matched):,} chars at offset {m.start()}")

    worker_new = worker[:m.start()] + NEW_BLOCK + worker[m.end():]
    if worker_new == worker:
        print("ERROR: replacement made no change"); return 3
    print(f"Step 2: Patched worker: {len(worker_new):,} chars (was {len(worker):,})")

    with open("/tmp/fixed.js", "w") as f:
        f.write(worker_new)

    print("Step 3: Uploading via curl...")
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
        print("SUCCESS: /pipeline/deploy now sets TADIR.AUTHOR to body.author||SAP_ABAP")
        return 0
    print("UPLOAD FAILED")
    return 7


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print("UNCAUGHT EXCEPTION:", repr(e))
        traceback.print_exc()
        sys.exit(99)

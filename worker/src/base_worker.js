
// abap-ai-studio base worker v3.0
// HTML_B64 is filled in by build.py — DO NOT edit manually
// All 3 bugs fixed:
//   1. addEventListener passes env secrets via globals (ANTHROPIC_KEY, JWT_SECRET etc work)
//   2. /sap/connect uses /query endpoint (health endpoint doesn't exist)
//   3. /sap/query route present for Dictionary + SQL Console
//
// Build: cd worker/src && python build.py
// Deploy: curl -X PUT ... (shown at end of build.py output)

// Production SAP query via /BODS/RFC_READ_TABLE2 (auto-selects correct buffer)
async function sapProdQuery(tableName, rowcount){
  try{
    var r=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},
      body:JSON.stringify({bapiname:'/BODS/RFC_READ_TABLE2',QUERY_TABLE:tableName,DELIMITER:'|',ROWCOUNT:String(rowcount||20)})
    });
    var d=await r.json();
    var bufName=d.OUT_TABLE||'TBLOUT2048';
    var rawRows=d[bufName]||d.TBLOUT2048||d.TBLOUT8192||d.TBLOUT512||d.TBLOUT128||d.TBLOUT30000||[];
    var fields=(d.FIELDS||[]).map(function(f){return{name:f.FIELDNAME,offset:parseInt(f.OFFSET),length:parseInt(f.LENGTH)}});
    var rows=[];
    for(var i=0;i<rawRows.length;i++){
      var wa=(rawRows[i].WA||'').split('|');
      var obj={};
      for(var j=0;j<Math.min(wa.length,fields.length);j++){obj[fields[j].name]=wa[j].trim();}
      rows.push(obj);
    }
    return{rows:rows,row_count:rows.length,fields:fields.map(function(f){return f.name})};
  }catch(e){return{rows:[],row_count:0,error:e.message}}
}

const CENTRAL_API='https://api.v2retail.net';
const PLATFORM_KEY='v2-platform-internal-2026';
async function centralLog(level,message,metadata){try{await fetch(CENTRAL_API+'/api/log',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':PLATFORM_KEY},body:JSON.stringify({worker_name:'abap-ai-studio',level,message,metadata:metadata||{}})});}catch(e){}}

const CH={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
function json(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json',...CH}})}
function err(m,s=400){return json({error:m},s)}
const MU=new Map();

const ADMINS={'akash':{id:1,username:'akash',display_name:'Akash Agarwal',role:'admin',sap_user:'SAP_ABAP',sap_pass_enc:btoa('Abap@123456')},'bhavesh':{id:2,username:'bhavesh',display_name:'Bhavesh',role:'developer',sap_user:'SAP_ABAP',sap_pass_enc:btoa('Abap@123456')}};

async function sign(p,sec){const h=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}));const b=btoa(JSON.stringify({...p,exp:Date.now()+604800000}));const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(sec),{name:'HMAC',hash:'SHA-256'},false,['sign']);const s=await crypto.subtle.sign('HMAC',k,e.encode(h+'.'+b));return h+'.'+b+'.'+btoa(String.fromCharCode(...new Uint8Array(s)))}
async function verify(t,sec){try{const[h,b,s]=t.split('.');const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(sec),{name:'HMAC',hash:'SHA-256'},false,['verify']);const sb=Uint8Array.from(atob(s),c=>c.charCodeAt(0));if(!await crypto.subtle.verify('HMAC',k,sb,e.encode(h+'.'+b)))return null;const p=JSON.parse(atob(b));return p.exp<Date.now()?null:p}catch{return null}}
async function hpw(pw){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw+'abap-studio-salt-2026'));return btoa(String.fromCharCode(...new Uint8Array(h)))}
async function getu(req,env){const a=req.headers.get('Authorization');return a?.startsWith('Bearer ')?verify(a.slice(7),env.JWT_SECRET||'fallback'):null}
async function migrate(db){try{await db.exec("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,display_name TEXT,role TEXT DEFAULT 'developer',sap_user TEXT,sap_password_enc TEXT,created_at TEXT DEFAULT(datetime('now')),last_login TEXT)");await db.exec("CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT NOT NULL,detail TEXT,created_at TEXT DEFAULT(datetime('now')))");await db.exec("UPDATE users SET role='admin' WHERE username='akash'");}catch(e){}}

// *** HTML_B64 placeholder — build.py embeds the frontend here ***
const HTML_B64 = "";

async function handleRequest(request,env){
  if(request.method==='OPTIONS')return new Response(null,{headers:CH});
  const url=new URL(request.url);const path=url.pathname;const sec=env.JWT_SECRET||'fallback';
  if(env.DB)await migrate(env.DB);
  try{
    if(path==='/health')return json({status:'ok',service:'abap-ai-studio',version:'1.3.0',d1:!!env.DB,ak:!!(env.ANTHROPIC_KEY)});

    if(path==='/'||path==='/index.html'){
      const html=(()=>{try{const b=atob(HTML_B64);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder('utf-8').decode(u);}catch(e){return '<html><body><h1>Build needed</h1><p>Run: python build.py</p></body></html>';}})();
      return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache,no-store,must-revalidate',...CH}});
    }

    if(path==='/auth/register'&&request.method==='POST'){const body=await request.json();const un=(body.username||'').toLowerCase().trim();const pw=body.password||'';const dn=body.display_name||un;if(!un||!pw)return err('Username and password required');if(un.length<3||pw.length<6)return err('Username min 3, password min 6');const ph=await hpw(pw);if(env.DB){const ex=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(un).first();if(ex)return err('Username already taken');const r=await env.DB.prepare('INSERT INTO users(username,password_hash,display_name,role)VALUES(?,?,?,?)').bind(un,ph,dn,'developer').run();const tk=await sign({id:r.meta.last_row_id,username:un,role:'developer',display_name:dn},sec);return json({token:tk,user:{id:r.meta.last_row_id,username:un,role:'developer',display_name:dn}});}if(MU.has(un))return err('Username already taken');const id=MU.size+1;MU.set(un,{id,username:un,pwHash:ph,display_name:dn,role:'developer',sap_user:'',sap_pass_enc:''});const tk=await sign({id,username:un,role:'developer',display_name:dn},sec);return json({token:tk,user:{id,username:un,role:'developer',display_name:dn}});}

    if(path==='/auth/login'&&request.method==='POST'){const body=await request.json();const un=(body.username||'').toLowerCase().trim();const pw=body.password||'';if(!un||!pw)return err('Username and password required');const ph=await hpw(pw);if(env.DB){const u=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(un).first();if(!u||u.password_hash!==ph)return err('Invalid credentials',401);const tk=await sign({id:u.id,username:u.username,role:u.role,display_name:u.display_name,sap_user:u.sap_user},sec);return json({token:tk,user:{id:u.id,username:u.username,role:u.role,display_name:u.display_name,sap_user:u.sap_user}});}let u=MU.get(un);if(!u&&ADMINS[un]){const a=ADMINS[un];const aph=await hpw('admin2026');if(ph===aph){const tk=await sign({id:a.id,username:un,role:a.role,display_name:a.display_name,sap_user:a.sap_user},sec);return json({token:tk,user:{id:a.id,username:un,role:a.role,display_name:a.display_name,sap_user:a.sap_user}});}}if(!u||u.pwHash!==ph)return err('Invalid credentials',401);const tk=await sign({id:u.id,username:un,role:u.role,display_name:u.display_name,sap_user:u.sap_user},sec);return json({token:tk,user:{id:u.id,username:un,role:u.role,display_name:u.display_name,sap_user:u.sap_user}});}

    const user=await getu(request,env);
    if(!user)return err('Unauthorized',401);
    if(path==='/auth/me')return json({user});

    if(path==='/auth/update-sap'&&request.method==='POST'){const body=await request.json();const su=body.sap_user;const sp=body.sap_password;if(!su||!sp)return err('SAP user and password required');const enc=btoa(sp);if(env.DB)await env.DB.prepare('UPDATE users SET sap_user=?,sap_password_enc=? WHERE id=?').bind(su,enc,user.id).run();const mu=MU.get(user.username);if(mu){mu.sap_user=su;mu.sap_pass_enc=enc}else MU.set(user.username,{...user,sap_user:su,sap_pass_enc:enc});return json({success:true});}

    if(path==='/sap/connect'&&request.method==='POST'){try{const r=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({sql:'SELECT TOP 1 MANDT FROM T000'})});const d=await r.json();return json({connected:Array.isArray(d.rows),system:'S4D'});}catch(e){return json({connected:false,error:e.message});}}

    if(path==='/sap/query'&&request.method==='POST'){const body=await request.json();const sql=(body.sql||'').trim();if(!sql)return err('SQL required');try{const r=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({sql})});return json(await r.json());}catch(e){return err('SAP query failed: '+e.message);}}

    if(path==='/claude'&&request.method==='POST'){const body=await request.json();const AK=env.ANTHROPIC_KEY||typeof ANTHROPIC_KEY!=='undefined'&&ANTHROPIC_KEY;const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':AK},body:JSON.stringify({model:body.model||'claude-sonnet-4-20250514',max_tokens:Math.min(body.max_tokens||8192,16384),system:(body.system||'')+'You are an SAP ABAP architect for V2 Retail (320+ stores, S4/HANA). IM_ import, EX_ export. NEVER IV_/EV_. Modern ABAP 7.4+.',messages:body.messages})});return json(await resp.json());}

    if(path==='/sap/smart-source'&&request.method==='POST'){const body=await request.json();const name=(body.name||body.program||'').trim().toUpperCase();if(!name)return err('Name required');const sapUrl='https://sap-api.v2retail.net/api/abapstudio';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};async function sq(sql){const r=await fetch(sapUrl+'/query',{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json())}async function getSrc(prog){const r=await fetch(sapUrl+'/source',{method:'POST',headers:sapH,body:JSON.stringify({program:prog})});return(await r.json())}var result={detected:'unknown',name,source:'',program:'',lines:0,info:{}};var fmCheck=await sq("SELECT FUNCNAME,PNAME,INCLUDE FROM TFDIR WHERE FUNCNAME='"+name+"'");if(fmCheck.rows?.length>0){var fm=fmCheck.rows[0];result.detected='function_module';var fg=(fm.PNAME||'').replace('SAPL','');var inc=(fm.INCLUDE||'01').padStart(2,'0');var sd=await getSrc('L'+fg+'U'+inc);if(sd.source){result.source=sd.source;result.program='L'+fg+'U'+inc;result.lines=sd.lines||sd.source.split('\n').length;}var allFMs=await sq("SELECT FUNCNAME FROM TFDIR WHERE PNAME='"+fm.PNAME+"' ORDER BY FUNCNAME");result.info={funcname:fm.FUNCNAME,function_group:fg,all_fms:(allFMs.rows||[]).map(r=>r.FUNCNAME)};return json(result);}var fgCheck=await sq("SELECT FUNCNAME,PNAME FROM TFDIR WHERE PNAME='SAPL"+name+"' ORDER BY FUNCNAME");if(fgCheck.rows?.length>0){result.detected='function_group';result.info={function_group:name,fms:fgCheck.rows.map(r=>r.FUNCNAME)};var sd=await getSrc('SAPL'+name);if(sd.source){result.source=sd.source;result.program='SAPL'+name;}return json(result);}var sd=await getSrc(name);if(sd.source){result.detected='program';result.source=sd.source;result.program=name;result.lines=sd.lines||sd.source.split('\n').length;return json(result);}return json({error:'Not found: '+name,detected:'not_found'});}

    if(path==='/repo/search'&&request.method==='POST'){const body=await request.json();const term=(body.term||'').trim().toUpperCase();if(!term)return err('Search term required');const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};async function sq(sql){const r=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json()).rows||[]}const fmRows=await sq("SELECT FUNCNAME,PNAME,INCLUDE FROM TFDIR WHERE FUNCNAME='"+term+"'");if(fmRows.length>0){const fm=fmRows[0];const fugr=(fm.PNAME||'').replace('SAPL','');const allFms=await sq("SELECT FUNCNAME,INCLUDE FROM TFDIR WHERE PNAME='"+fm.PNAME+"'");const allInc=await sq("SELECT NAME,CNAM,UDAT FROM TRDIR WHERE NAME LIKE 'L"+fugr+"%' OR NAME='"+fm.PNAME+"'");return json({type:'function_module',function_module:fm.FUNCNAME,function_group:fugr,main_program:fm.PNAME,all_fms:allFms,all_includes:allInc});}const fgRows=await sq("SELECT FUNCNAME,INCLUDE FROM TFDIR WHERE PNAME='SAPL"+term+"'");if(fgRows.length>0){return json({type:'function_group',function_group:term,main_program:'SAPL'+term,all_fms:fgRows});}const progs=await sq("SELECT TOP 50 NAME,CNAM,UDAT FROM TRDIR WHERE NAME LIKE '"+term+"%'");return json({type:progs.length?'programs':'not_found',results:progs});}

    if(path==='/sap/rfc-params'&&request.method==='POST'){const body=await request.json();const fm=(body.fm||'').trim().toUpperCase();if(!fm)return err('FM required');const sys=body.system||'dev';const rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy'+(sys==='prod'?'?env=prod':'');const pr=await fetch(rfcUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'FUPARAREF',DELIMITER:'|',OPTIONS:[{TEXT:"FUNCNAME='"+fm+"'"}],FIELDS:[{FIELDNAME:'PARAMTYPE'},{FIELDNAME:'PARAMETER'},{FIELDNAME:'STRUCTURE'},{FIELDNAME:'OPTIONAL'}]})});const pd=await pr.json();const params=(pd.DATA||[]).map(r=>{const c=(r.WA||'').split('|').map(x=>x.trim());return{type:c[0]==='I'?'IMPORT':c[0]==='E'?'EXPORT':c[0]==='T'?'TABLE':'CHANGING',name:c[1]||'',structure:c[2]||'',optional:c[3]==='X'}});return json({fm,params,system:sys});}

    if(path==='/sap/rfc-execute'&&request.method==='POST'){const body=await request.json();const fm=(body.fm||'').trim().toUpperCase();if(!fm)return err('FM required');const sys=body.system||'dev';const rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy'+(sys==='prod'?'?env=prod':'');const rfcBody={bapiname:fm,...(body.inputs||{})};const rr=await fetch(rfcUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify(rfcBody)});return json({fm,system:sys,result:await rr.json()});}

    if(path==='/sap/where-used'&&request.method==='POST'){const body=await request.json();const obj=(body.object||'').trim().toUpperCase();if(!obj)return err('Object required');let results=[];try{const wr=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'WBCROSSGT',DELIMITER:'|',OPTIONS:[{TEXT:"INCLUDE LIKE '%"+obj+"%'"}],FIELDS:[{FIELDNAME:'NAME'},{FIELDNAME:'INCLUDE'}],ROWCOUNT:50})});const wd=await wr.json();results=(wd.DATA||[]).map(r=>{const c=(r.WA||'').split('|').map(x=>x.trim());return{caller:c[0]||'',type:'Program',called:c[1]||obj}}).filter(r=>r.caller?.startsWith('Z'));}catch(e){}return json({object:obj,results});}

    if(path==='/sap/error-log'&&request.method==='POST'){const body=await request.json();const days=body.days||7;const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};const fromStr=new Date(Date.now()-days*86400000).toISOString().slice(0,10).replace(/-/g,'');const r1=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT TOP 50 SEESSION,AESSION,DATUM,UZEIT,UNAME,FLIST FROM SNAP WHERE DATUM>='"+fromStr+"' ORDER BY DATUM DESC,UZEIT DESC"})});const d1=await r1.json();return json({system:body.system||'dev',days,dumps:(d1.rows||[]).map(r=>({error_type:r.SEESSION||'',program:r.AESSION||'',date:r.DATUM||'',time:r.UZEIT||'',user:r.UNAME||'',details:r.FLIST||''}))});}

    if(path==='/sap/table-data'&&request.method==='POST'){const body=await request.json();const table=(body.table||'').trim().toUpperCase();if(!table)return err('Table required');const ALLOWED=['MARA','MARM','MAKT','LQUA','VBAK','VBAP','EKKO','EKPO','BKPF','BSEG','LIPS','LIKP','MARC','MARD','KNA1','LFA1','T001','T001W','USR02'];if(!table.startsWith('Z')&&!table.startsWith('Y')&&!ALLOWED.includes(table))return err('Only Z/Y and common SAP tables');const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};const where=body.where||'';const limit=Math.min(body.limit||100,500);let fields='*';try{const fR=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT FIELDNAME FROM DD03L WHERE TABNAME='"+table+"' AND FIELDNAME NOT LIKE '.%'"})});const fD=await fR.json();if(fD.rows?.length>0)fields=fD.rows.map(r=>r.FIELDNAME).slice(0,15).join(',');}catch(e){}const r1=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:sapH,body:JSON.stringify({sql:'SELECT TOP '+limit+' '+fields+' FROM '+table+(where?' WHERE '+where:'')})});const d1=await r1.json();return json({table,system:body.system||'dev',row_count:(d1.rows||[]).length,rows:d1.rows||[],error:d1.error||null});}

    if(path==='/sap/jobs'&&request.method==='POST'){const body=await request.json();const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};const status=body.status||'';let where="SDLSTRTDT>='20260401'";if(status)where+=" AND STATUS='"+status+"'";const r1=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:sapH,body:JSON.stringify({sql:'SELECT TOP 50 JOBNAME,SDLSTRTDT,SDLSTRTTM,STATUS,AUTHCKNAM FROM TBTCO WHERE '+where+' ORDER BY SDLSTRTDT DESC'})});const d1=await r1.json();const sm={S:'Scheduled',R:'Running',F:'Finished',A:'Aborted',P:'Ready'};return json({system:body.system||'dev',jobs:(d1.rows||[]).map(r=>({name:r.JOBNAME||'',date:r.SDLSTRTDT||'',time:(r.SDLSTRTTM||'').slice(0,6),status:sm[r.STATUS]||r.STATUS||'?',user:r.AUTHCKNAM||''}))});}

    if(path==='/sap/auto-doc'&&request.method==='POST'){const body=await request.json();if(!body.source||body.source.length<20)return err('Source required');const AK=env.ANTHROPIC_KEY||typeof ANTHROPIC_KEY!=='undefined'&&ANTHROPIC_KEY;const r1=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':AK},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'SAP ABAP documentation specialist.',messages:[{role:'user',content:'Generate technical spec:\n```abap\n'+body.source.slice(0,6000)+'\n```'}]})});const d1=await r1.json();return json({name:body.name||'Unknown',documentation:(d1.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')});}

    if(path==='/sap/smart-debug'&&request.method==='POST'){const body=await request.json();const error_text=body.error||'';const program=body.program||'';if(!error_text&&!program)return err('Provide error or program');const AK=env.ANTHROPIC_KEY||typeof ANTHROPIC_KEY!=='undefined'&&ANTHROPIC_KEY;let source='';if(program){try{const sr=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:program.toUpperCase()}));const sd=await sr.json();source=(sd.SOURCE_EXTENDED||[]).map(s=>typeof s.LINE==='string'?s.LINE:'').join('\n');}catch(e){}}const prompt=error_text&&source?'Error:\n'+error_text+'\n\nSource:\n```abap\n'+source.slice(0,6000)+'\n```\nDiagnose and fix.':error_text?'Diagnose: '+error_text:'Review:\n```abap\n'+source.slice(0,6000)+'\n```';const ar=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':AK},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,messages:[{role:'user',content:prompt}]})});const ad=await ar.json();return json({diagnosis:(ad.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'),program,had_source:!!source});}

    if(path==='/sap/code-search'&&request.method==='POST'){const body=await request.json();const term=(body.term||'').trim().toUpperCase();if(!term||term.length<3)return err('Min 3 chars');const rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy?env=prod';const rfcH={'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'};let results=[];const prefixes=body.scope||['ZWM_RFC','ZSDC','ZFI','ZGATE','ZADVERB','ZPTL'];for(let i=0;i<Math.min(prefixes.length,6);i++){try{const tr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'TRDIR',DELIMITER:'|',OPTIONS:[{TEXT:"NAME LIKE '"+prefixes[i]+"%'"}],FIELDS:[{FIELDNAME:'NAME'}],ROWCOUNT:20})});const td=await tr.json();const progs=(td.DATA||[]).map(r=>(r.WA||'').trim()).filter(Boolean);for(let j=0;j<Math.min(progs.length,10);j++){try{const sr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:progs[j]})});const sd=await sr.json();const lines=sd.SOURCE_EXTENDED||[];for(let k=0;k<lines.length;k++){const ln=typeof lines[k].LINE==='string'?lines[k].LINE:'';if(ln.toUpperCase().includes(term)){results.push({program:progs[j],line:k+1,text:ln.trim().slice(0,120)});if(results.length>=50)break;}}}catch(e){}if(results.length>=50)break;}}catch(e){}if(results.length>=50)break;}return json({term,results,scanned:prefixes});}

    if(path==='/hht/status'){try{const gT=env.GH_TOKEN||typeof GH_TOKEN!=='undefined'&&GH_TOKEN;const[a,b]=await Promise.all([fetch('https://api.github.com/repos/akash0631/v2-android-hht/releases/latest',{headers:{'Authorization':'token '+gT}}),fetch('https://api.github.com/repos/akash0631/v2-android-hht/actions/runs?per_page=5',{headers:{'Authorization':'token '+gT}})]);const c=await a.json();const dd=await b.json();return json({version:c.tag_name,name:c.name,date:(c.published_at||'').slice(0,10),builds:(dd.workflow_runs||[]).slice(0,5).map(rr=>({status:rr.conclusion||rr.status,msg:(rr.head_commit||{}).message||'',date:(rr.created_at||'').slice(0,16)}))});}catch(e){return json({error:e.message});}}

    if(path==='/admin/dashboard'&&user.role==='admin'){if(!env.DB)return json({users:0,calls_today:0,recent:[],by_user:[]});const stats=await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();const calls=await env.DB.prepare("SELECT COUNT(*) as cnt FROM audit_log WHERE created_at>=datetime('now','-1 day')").first();const recent=await env.DB.prepare("SELECT a.action,a.detail,a.created_at,u.username FROM audit_log a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 50").all();const byUser=await env.DB.prepare("SELECT u.username,u.display_name,COUNT(a.id) as calls FROM users u LEFT JOIN audit_log a ON u.id=a.user_id AND a.created_at>=datetime('now','-7 day') GROUP BY u.id ORDER BY calls DESC").all();return json({users:stats?.cnt||0,calls_today:calls?.cnt||0,recent:recent?.results||[],by_user:byUser?.results||[]});}

    if(path==='/pipeline/smart-deploy'&&request.method==='POST'){const body=await request.json();const source=body.source||'';if(!source||source.length<20)return err('No source');const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};const sq=async sql=>{const r=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json()).rows||[]};const fmM=source.match(/FUNCTION\s+(\w+)/i);if(!fmM)return err('Cannot find FUNCTION name');const fmName=fmM[1].toUpperCase();const fmRows=await sq("SELECT FUNCNAME,PNAME,INCLUDE FROM TFDIR WHERE FUNCNAME='"+fmName+"'");if(!fmRows.length)return json({status:'E',needs_manual:true,function_module:fmName,message:'FM does not exist. Create in SE37 first.'});const fm=fmRows[0];const fg=(fm.PNAME||'').replace('SAPL','');const inc=String(fm.INCLUDE||'01').padStart(2,'0');const prog='L'+fg+'U'+inc;const dR=await fetch('https://sap-api.v2retail.net/api/abapstudio/deploy',{method:'POST',headers:sapH,body:JSON.stringify({program:prog,source,title:'AI Pipeline: '+fmName})});const dD=await dR.json();return json({status:dD.type||'S',function_module:fmName,function_group:fg,deployed_to:prog,message:dD.message||'Deployed',next_step:'SE37 > '+fmName+' > Activate (Ctrl+F3)'});}

    if(path==='/pipeline/stream'&&request.method==='POST'){
      const body=await request.json();const requirement=body.requirement;const template=body.template||'function_module';if(!requirement)return err('Requirement needed');
      const AK=env.ANTHROPIC_KEY||typeof ANTHROPIC_KEY!=='undefined'&&ANTHROPIC_KEY;
      const KB='SAP ABAP V2 Retail. IM_ import, EX_ export. NEVER IV_/EV_. EX_RETURN TYPE BAPIRET2. ABAP 7.4+. No SELECT*. No SELECT in LOOP.';
      const encoder=new TextEncoder();const stream=new TransformStream();const writer=stream.writable.getWriter();
      const send=async data=>{await writer.write(encoder.encode('data: '+JSON.stringify(data)+'\n\n'))};
      const cc=async(sys,msgs,maxTok)=>{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':AK},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:maxTok||8192,system:sys,messages:msgs})});const d=await r.json();return(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');};
      (async()=>{
        try{
          await send({stage:1,name:'Coder',status:'running',message:'Generating ABAP...'});
          const gen=await cc(KB+'\nCODER: Output COMPLETE code in ```abap blocks.',[{role:'user',content:'Generate '+template+' for: '+requirement}]);
          await send({stage:1,name:'Coder',status:'done',chars:gen.length});
          await send({stage:2,name:'Reviewer',status:'running',message:'Reviewing...'});
          const rev=await cc('REVIEWER. Rate /10. Format: RATING: X/10 VERDICT: PASS or FAIL',[{role:'user',content:'Review:\n'+gen}],4096);
          const rm=rev.match(/([0-9]+)\/10/);const rating=rm?parseInt(rm[1]):0;const passed=rating>=8;
          await send({stage:2,name:'Reviewer',status:'done',rating,passed});
          let finalCode=gen;
          if(!passed){await send({stage:3,name:'Fixer',status:'running',message:'Fixing...'});finalCode=await cc(KB+'\nFIXER. Fix issues. Output COMPLETE code.',[{role:'user',content:'Review:\n'+rev+'\n\nFix:\n'+gen}]);await send({stage:3,name:'Fixer',status:'done',chars:finalCode.length});}
          else{await send({stage:3,name:'Fixer',status:'skipped',message:'Passed'});}
          await send({stage:4,name:'Verify',status:'running',message:'Cross-verifying...'});
          const crossRev=await cc('INDEPENDENT reviewer. Check violations. Rate /10.',[{role:'user',content:'Req: '+requirement+'\n\nCode:\n'+finalCode.slice(0,6000)}],4096);
          const cm=crossRev.match(/([0-9]+)\/10/);const crossRating=cm?parseInt(cm[1]):0;
          await send({stage:4,name:'Verify',status:'done',rating:crossRating});
          await send({stage:'done',final_code:finalCode,rating_initial:rating,cross_rating:crossRating,review:rev,cross_review:crossRev,passed});
        }catch(e){await send({stage:'error',message:e.message});}
        finally{await writer.close();}
      })();
      return new Response(stream.readable,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'}});
    }

    if(path.startsWith('/sap/')){const sapEndpoint=path.replace('/sap/','');const sapUrl='https://sap-api.v2retail.net/api/abapstudio/'+sapEndpoint;let reqBody=null;if(request.method==='POST')reqBody=await request.text();const resp=await fetch(sapUrl,{method:request.method,headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:reqBody});return json(await resp.json(),resp.status);}

    return err('Not found',404);
  }catch(e){return err('Internal error: '+e.message,500)}
}

// FIX: Pass all bound secrets as globals to handleRequest
addEventListener("fetch",function(e){
  e.respondWith(handleRequest(e.request,{
    ANTHROPIC_KEY:typeof ANTHROPIC_KEY!=="undefined"?ANTHROPIC_KEY:undefined,
    JWT_SECRET:typeof JWT_SECRET!=="undefined"?JWT_SECRET:"fallback",
    CF_DEPLOY_TOKEN:typeof CF_DEPLOY_TOKEN!=="undefined"?CF_DEPLOY_TOKEN:undefined,
    GH_TOKEN:typeof GH_TOKEN!=="undefined"?GH_TOKEN:undefined,
    DB:typeof __D1_BETA__DB!=="undefined"?__D1_BETA__DB:undefined
  }));
});

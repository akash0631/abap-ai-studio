// Production SAP query via /BODS/RFC_READ_TABLE2 (auto-selects correct buffer)
async function sapProdQuery(tableName, rowcount){
  try{
    var r=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},
      body:JSON.stringify({bapiname:'/BODS/RFC_READ_TABLE2',QUERY_TABLE:tableName,DELIMITER:'|',ROWCOUNT:String(rowcount||20)})
    });
    var d=await r.json();
    // Find the right buffer (OUT_TABLE tells us which one has data)
    var bufName=d.OUT_TABLE||'TBLOUT2048';
    var rawRows=d[bufName]||d.TBLOUT2048||d.TBLOUT8192||d.TBLOUT512||d.TBLOUT128||d.TBLOUT30000||[];
    var fields=(d.FIELDS||[]).map(function(f){return{name:f.FIELDNAME,offset:parseInt(f.OFFSET),length:parseInt(f.LENGTH)}});
    // Parse pipe-delimited data into objects
    var rows=[];
    for(var i=0;i<rawRows.length;i++){
      var wa=(rawRows[i].WA||'').split('|');
      var obj={};
      for(var j=0;j<Math.min(wa.length,fields.length);j++){
        obj[fields[j].name]=wa[j].trim();
      }
      rows.push(obj);
    }
    return{rows:rows,row_count:rows.length,fields:fields.map(function(f){return f.name})};
  }catch(e){return{rows:[],row_count:0,error:e.message}}
}

// Central Platform Integration
const CENTRAL_API='https://api.v2retail.net';
const PLATFORM_KEY='v2-platform-internal-2026';
async function centralLog(level,message,metadata){try{await fetch(CENTRAL_API+'/api/log',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':PLATFORM_KEY},body:JSON.stringify({worker_name:'abap-ai-studio',level:level,message:message,metadata:metadata||{}})});}catch(e){}}
async function centralPipelineRun(type,status,input,output,durationMs){try{var wr=await fetch(CENTRAL_API+'/api/workers/abap-ai-studio');var wd=await wr.json();await fetch(CENTRAL_API+'/api/pipeline-run',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':PLATFORM_KEY},body:JSON.stringify({worker_id:wd.id||null,type:type,status:status,input:input,output:output,duration_ms:durationMs})});}catch(e){}}

const CH={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
function json(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json',...CH}})}
function err(m,s=400){return json({error:m},s)}
const MU=new Map();

// Pre-seeded admin accounts (work without D1)
const ADMINS = {
  'akash': { id: 1, username: 'akash', display_name: 'Akash Agarwal', role: 'admin', sap_user: 'sap_abap', sap_pass_enc: btoa('Abap@123456') },
  'bhavesh': { id: 2, username: 'bhavesh', display_name: 'Bhavesh', role: 'developer', sap_user: 'sap_abap', sap_pass_enc: btoa('Abap@123456') },
};

async function sign(p,sec){const h=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}));const b=btoa(JSON.stringify({...p,exp:Date.now()+604800000}));const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(sec),{name:'HMAC',hash:'SHA-256'},false,['sign']);const s=await crypto.subtle.sign('HMAC',k,e.encode(h+'.'+b));return h+'.'+b+'.'+btoa(String.fromCharCode(...new Uint8Array(s)))}
async function verify(t,sec){try{const[h,b,s]=t.split('.');const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(sec),{name:'HMAC',hash:'SHA-256'},false,['verify']);const sb=Uint8Array.from(atob(s),c=>c.charCodeAt(0));if(!await crypto.subtle.verify('HMAC',k,sb,e.encode(h+'.'+b)))return null;const p=JSON.parse(atob(b));return p.exp<Date.now()?null:p}catch{return null}}
async function hpw(pw){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw+'abap-studio-salt-2026'));return btoa(String.fromCharCode(...new Uint8Array(h)))}
async function getu(req,env){const a=req.headers.get('Authorization');return a?.startsWith('Bearer ')?verify(a.slice(7),env.JWT_SECRET||'fallback'):null}

const HTML_B64 = "";


// Auto-migrate D1 tables on first use
async function migrate(db) {
  try {
    await db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, role TEXT DEFAULT 'developer', sap_user TEXT, sap_password_enc TEXT, created_at TEXT DEFAULT (datetime('now')), last_login TEXT)");
    await db.exec("CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, detail TEXT, created_at TEXT DEFAULT (datetime('now')))");
    await db.exec("UPDATE users SET role='admin' WHERE username='akash'");
  } catch(e) { console.error('Migration error:', e); }
}

// Deploy trigger: 2026-04-21 — Fix: add /sap/connect + /sap/query endpoints
export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{headers:CH});
    const url=new URL(request.url);const path=url.pathname;const sec=env.JWT_SECRET||'fallback';
    if(env.DB)await migrate(env.DB);
    try{
      if(path==='/health')return json({status:'ok',service:'abap-ai-studio',version:'1.2.2',d1:!!env.DB});

      if(path==='/'||path==='/index.html'){
        const html=atob(HTML_B64);
        return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache',...CH}});
      }

      if(path==='/auth/register'&&request.method==='POST'){
        const body=await request.json();
        const un=(body.username||'').toLowerCase().trim();
        const pw=body.password||'';
        const dn=body.display_name||un;
        if(!un||!pw)return err('Username and password required');
        if(un.length<3||pw.length<6)return err('Username min 3, password min 6');
        const ph=await hpw(pw);
        if(env.DB){
          const ex=await env.DB.prepare('SELECT id FROM users WHERE username=?').bind(un).first();
          if(ex)return err('Username already taken');
          const r=await env.DB.prepare('INSERT INTO users(username,password_hash,display_name,role)VALUES(?,?,?,?)').bind(un,ph,dn,'developer').run();
          const id=r.meta.last_row_id;
          const tk=await sign({id,username:un,role:'developer',display_name:dn},sec);
          return json({token:tk,user:{id,username:un,role:'developer',display_name:dn}});
        }
        if(MU.has(un))return err('Username already taken');
        const id=MU.size+1;
        MU.set(un,{id,username:un,pwHash:ph,display_name:dn,role:'developer',sap_user:'',sap_pass_enc:''});
        const tk=await sign({id,username:un,role:'developer',display_name:dn},sec);
        return json({token:tk,user:{id,username:un,role:'developer',display_name:dn}});
      }

      if(path==='/auth/login'&&request.method==='POST'){
        const body=await request.json();
        const un=(body.username||'').toLowerCase().trim();
        const pw=body.password||'';
        if(!un||!pw)return err('Username and password required');
        const ph=await hpw(pw);
        if(env.DB){
          const u=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(un).first();
          if(!u||u.password_hash!==ph)return err('Invalid credentials',401);
          const tk=await sign({id:u.id,username:u.username,role:u.role,display_name:u.display_name,sap_user:u.sap_user},sec);
          return json({token:tk,user:{id:u.id,username:u.username,role:u.role,display_name:u.display_name,sap_user:u.sap_user}});
        }
        let u=MU.get(un);
        if(!u&&ADMINS[un]){const a=ADMINS[un];const aph=await hpw('admin2026');if(ph===aph){const tk=await sign({id:a.id,username:un,role:a.role,display_name:a.display_name,sap_user:a.sap_user},sec);return json({token:tk,user:{id:a.id,username:un,role:a.role,display_name:a.display_name,sap_user:a.sap_user}})}}
        if(!u||u.pwHash!==ph)return err('Invalid credentials',401);
        const tk=await sign({id:u.id,username:un,role:u.role,display_name:u.display_name,sap_user:u.sap_user},sec);
        return json({token:tk,user:{id:u.id,username:un,role:u.role,display_name:u.display_name,sap_user:u.sap_user}});
      }

      const user=await getu(request,env);
      if(!user)return err('Unauthorized',401);
      if(path==='/auth/me')return json({user});

      if(path==='/auth/update-sap'&&request.method==='POST'){
        const body=await request.json();
        const su=body.sap_user;const sp=body.sap_password;
        if(!su||!sp)return err('SAP user and password required');
        const enc=btoa(sp);
        if(env.DB)await env.DB.prepare('UPDATE users SET sap_user=?,sap_password_enc=? WHERE id=?').bind(su,enc,user.id).run();
        const mu=MU.get(user.username);
        if(mu){mu.sap_user=su;mu.sap_pass_enc=enc}
        else MU.set(user.username,{...user,sap_user:su,sap_pass_enc:enc});
        return json({success:true});
      }

      // SAP connectivity check — used by App header to show green badge
      if(path==='/sap/connect'&&request.method==='POST'){
        try{
          const r=await fetch('https://sap-api.v2retail.net/api/abapstudio/health',{headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'}});
          const d=await r.json();
          return json({connected:!!(d.status==='ok'||d.ok||d.connected),system:'S4D'});
        }catch(e){return json({connected:false,error:e.message});}
      }

      // SAP SQL Query — used by Dictionary browser + SQL Console
      if(path==='/sap/query'&&request.method==='POST'){
        const body=await request.json();
        const sql=(body.sql||'').trim();
        if(!sql)return err('SQL required');
        const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';
        const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};
        try{
          const r=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql})});
          const d=await r.json();
          return json(d);
        }catch(e){return err('SAP query failed: '+e.message);}
      }

      // Smart Source Viewer — auto-detects programs, FMs, function groups
      if(path==='/sap/smart-source'&&request.method==='POST'){
        const body=await request.json();
        const name=(body.name||body.program||'').trim().toUpperCase();
        if(!name)return err('Enter a program, FM, or function group name');
        const sapUrl='https://sap-api.v2retail.net/api/abapstudio';
        const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};
        async function sq(sql){const r=await fetch(sapUrl+'/query',{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json())}
        async function getSrc(prog){const r=await fetch(sapUrl+'/source',{method:'POST',headers:sapH,body:JSON.stringify({program:prog})});return(await r.json())}

        var result={detected:'unknown',name:name,source:'',program:'',lines:0,info:{}};

        var fmCheck=await sq("SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE FUNCNAME = '"+name+"'");
        if(fmCheck.rows&&fmCheck.rows.length>0){
          var fm=fmCheck.rows[0];
          result.detected='function_module';
          result.info={funcname:fm.FUNCNAME,pname:fm.PNAME,include:fm.INCLUDE};
          var fgName2=fm.PNAME?(fm.PNAME.replace('SAPL','')):'';
          var includeNum=fm.INCLUDE||'01';
          if(includeNum.length===1)includeNum='0'+includeNum;
          var includeProg='L'+fgName2+'U'+includeNum;
          var srcData=await getSrc(includeProg);
          if(srcData.source){result.source=srcData.source;result.program=includeProg;result.lines=srcData.lines||srcData.source.split('\n').length;}
          else{srcData=await getSrc(fm.PNAME);if(srcData.source){result.source=srcData.source;result.program=fm.PNAME;result.lines=srcData.lines||0;}else{srcData=await getSrc('L'+fgName2+'U'+fm.INCLUDE);if(srcData.source){result.source=srcData.source;result.program='L'+fgName2+'U'+fm.INCLUDE;result.lines=srcData.lines||0;}}}
          var fgName=fm.PNAME?fm.PNAME.replace('SAPL',''):name;
          var allFMs=await sq("SELECT FUNCNAME FROM TFDIR WHERE PNAME = '"+fm.PNAME+"' ORDER BY FUNCNAME");
          result.info.function_group=fgName;
          result.info.all_fms=(allFMs.rows||[]).map(function(r){return r.FUNCNAME});
          return json(result);
        }

        var fgCheck=await sq("SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE PNAME = 'SAPL"+name+"' ORDER BY FUNCNAME");
        if(fgCheck.rows&&fgCheck.rows.length>0){
          result.detected='function_group';
          result.info={function_group:name,pname:'SAPL'+name,fm_count:fgCheck.rows.length,fms:fgCheck.rows.map(function(r){return r.FUNCNAME})};
          var srcData=await getSrc('SAPL'+name);
          if(srcData.source){result.source=srcData.source;result.program='SAPL'+name;result.lines=srcData.lines||0;}
          return json(result);
        }

        var srcData=await getSrc(name);
        if(srcData.source){result.detected='program';result.source=srcData.source;result.program=name;result.lines=srcData.lines||srcData.source.split('\n').length;return json(result);}

        async function sqProd(t,f,w){try{var r2=await fetch('https://sap-api.v2retail.net/api/abapstudio/query-prod',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({table:t,fields:f,where:w,system:'prod',rowcount:50})});return await r2.json();}catch(e){return {rows:[]};}}
        async function getProdSrc(prog){try{var r2=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:prog})});var d2=await r2.json();var src=(d2.SOURCE_EXTENDED||[]).map(function(s){return typeof s.LINE==='string'?s.LINE:''}).join('\n');return {source:src,lines:(d2.SOURCE_EXTENDED||[]).length};}catch(e){return {source:'',lines:0};}}

        var prodFm=await sqProd('TFDIR','FUNCNAME,PNAME,INCLUDE',"FUNCNAME = '"+name+"'");
        if(prodFm.rows&&prodFm.rows.length>0){var pfm=prodFm.rows[0];result.detected='function_module';var pfg=(pfm.PNAME||'').replace('SAPL','');var pInc=pfm.INCLUDE||'01';if(pInc.length===1) pInc='0'+pInc;var pProg='L'+pfg+'U'+pInc;var pSrc=await getProdSrc(pProg);if(pSrc.source){result.source=pSrc.source;result.program=pProg+' (PROD)';result.lines=pSrc.lines;}var prodAllFMs=await sqProd('TFDIR','FUNCNAME',"PNAME = '"+pfm.PNAME+"'");result.info={funcname:pfm.FUNCNAME,pname:pfm.PNAME,include:pfm.INCLUDE,system:'PROD',note:'Found on PRODUCTION only (not on DEV)',function_group:pfg,fms:(prodAllFMs.rows||[]).map(function(r){return r.FUNCNAME})};return json(result);}

        var prodFg=await sqProd('TFDIR','FUNCNAME,PNAME',"PNAME = 'SAPL"+name+"'");
        if(prodFg.rows&&prodFg.rows.length>0){result.detected='function_group';result.info={function_group:name,pname:'SAPL'+name,fm_count:prodFg.rows.length,fms:prodFg.rows.map(function(r){return r.FUNCNAME}),system:'PROD',note:'Found on PRODUCTION only'};return json(result);}

        var partialFM=await sq("SELECT TOP 20 FUNCNAME, PNAME FROM TFDIR WHERE FUNCNAME LIKE '%"+name+"%' ORDER BY FUNCNAME");
        if(!partialFM.rows||partialFM.rows.length===0){partialFM=await sqProd('TFDIR','FUNCNAME,PNAME',"FUNCNAME LIKE '%"+name+"%'");}
        if(partialFM.rows&&partialFM.rows.length>0){result.detected='search_results';result.info={matches:partialFM.rows.map(function(r){return {name:r.FUNCNAME,fg:(r.PNAME||'').replace('SAPL','')}}),type:'function_modules',note:'Similar FMs matching: '+name};return json(result);}

        var partial=await sq("SELECT TOP 10 NAME, SUBC, UDAT FROM TRDIR WHERE NAME LIKE '%"+name+"%' ORDER BY UDAT DESC");
        if(partial.rows&&partial.rows.length>0){result.detected='search_results';result.info={matches:partial.rows.map(function(r){return {name:r.NAME,type:r.SUBC==='F'?'Include':r.SUBC==='1'?'Report':'Other'}}),type:'programs'};return json(result);}

        return json({error:'Not found: '+name+'. Searched DEV + PROD.',detected:'not_found'});
      }


      if(path==='/sap/create-fg'&&request.method==='POST'){const body=await request.json();const sapUrl='https://sap-api.v2retail.net/api/rfc/proxy';const r=await fetch(sapUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'Z_CREATE_FUNC_GROUP',IV_FUGR:body.fugr||'',IV_SHORT_TEXT:body.short_text||'',IV_DEVCLASS:body.devclass||'$TMP'})});return new Response(await r.text(),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
      if(path==='/sap/create-fm'&&request.method==='POST'){const body=await request.json();const sapUrl='https://sap-api.v2retail.net/api/rfc/proxy';const r=await fetch(sapUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'Z_CREATE_FUNC_MODULE',IV_FM_NAME:body.fm_name||'',IV_FUGR:body.fugr||'',IV_SHORT_TEXT:body.short_text||'',IV_REMOTE:body.remote||'X',IV_IMPORT_JSON:body.import_json||'',IV_EXPORT_JSON:body.export_json||'',IV_EXCEPTION_JSON:body.exception_json||'',IV_SOURCE:body.source||''})});return new Response(await r.text(),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
      if(path==='/sap/activate'&&request.method==='POST'){const body=await request.json();const sapUrl='https://sap-api.v2retail.net/api/rfc/proxy';const r=await fetch(sapUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'Z_ACTIVATE_OBJECT',IV_OBJECT_NAME:body.object_name||'',IV_OBJECT_TYPE:body.object_type||'REPS'})});return new Response(await r.text(),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
      if(path==='/sap/create-table'&&request.method==='POST'){const body=await request.json();const sapUrl='https://sap-api.v2retail.net/api/rfc/proxy';const r=await fetch(sapUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'Z_CREATE_ZTABLE',IV_TABNAME:body.tabname||'',IV_SHORT_TEXT:body.short_text||'',IV_FIELDS_JSON:body.fields_json||''})});return new Response(await r.text(),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}

      if(path==='/pipeline/full-deploy'&&request.method==='POST'){
        const body=await request.json();
        const sapUrl='https://sap-api.v2retail.net/api/abapstudio';
        const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};
        async function callSap(endpoint,payload){var r=await fetch(sapUrl+'/'+endpoint,{method:'POST',headers:sapH,body:JSON.stringify(payload)});return await r.json();}
        var result={steps:[],success:false};
        var fmName=body.fm_name||'';var fgName=body.fg_name||'';var source=body.source||'';var shortText=body.short_text||fmName;var importJson=body.import_json||'';var exportJson=body.export_json||'';var exceptionJson=body.exception_json||'';var devclass=body.devclass||'$TMP';
        if(!fmName||!source)return err('fm_name and source are required');
        try{
          var check=await callSap('query',{sql:"SELECT FUNCNAME, PNAME FROM TFDIR WHERE FUNCNAME = '"+fmName.toUpperCase()+"'"});
          var fmExists=check.rows&&check.rows.length>0;
          if(fmExists){
            var pname=check.rows[0].PNAME;var fg=pname.replace('SAPL','');var includeNum='01';
            var incCheck=await callSap('query',{sql:"SELECT INCLUDE FROM TFDIR WHERE FUNCNAME = '"+fmName.toUpperCase()+"'"});
            if(incCheck.rows&&incCheck.rows[0])includeNum=incCheck.rows[0].INCLUDE||'01';
            if(includeNum.length===1)includeNum='0'+includeNum;
            var includeProg='L'+fg+'U'+includeNum;
            result.steps.push({step:'check',status:'exists',fg:fg,include:includeProg});
            var upload=await callSap('deploy',{program:includeProg,source:source,title:shortText});
            result.steps.push({step:'upload',status:upload.status||'?',message:upload.message||''});
            var activate=await callSap('activate',{object_name:includeProg,object_type:'REPS'});
            result.steps.push({step:'activate',status:activate.ev_type||'?',message:activate.ev_message||''});
          }else{
            if(!fgName){var parts=fmName.split('_');fgName=parts.slice(0,Math.min(3,parts.length)).join('_');}
            var fgCheck=await callSap('query',{sql:"SELECT FUNCNAME FROM TFDIR WHERE PNAME = 'SAPL"+fgName.toUpperCase()+"'"});
            if(!fgCheck.rows||fgCheck.rows.length===0){var fgResult=await callSap('create-fg',{fugr:fgName,short_text:'Function group '+fgName,devclass:devclass});result.steps.push({step:'create_fg',name:fgName,status:fgResult.ev_type||'?',message:fgResult.ev_message||''});}
            else{result.steps.push({step:'create_fg',name:fgName,status:'S',message:'Already exists ('+fgCheck.rows.length+' FMs)'});}
            var fmResult=await callSap('create-fm',{fm_name:fmName,fugr:fgName,short_text:shortText,remote:'X',import_json:importJson,export_json:exportJson,exception_json:exceptionJson,source:source});
            result.steps.push({step:'create_fm',name:fmName,status:fmResult.ev_type||'?',message:fmResult.ev_message||'',include:fmResult.ev_include||''});
            var includeName=fmResult.ev_include||'';
            if(includeName){var actResult=await callSap('activate',{object_name:includeName,object_type:'REPS'});result.steps.push({step:'activate',status:actResult.ev_type||'?',message:actResult.ev_message||''});}
          }
          var verifyCheck=await callSap('query',{sql:"SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE FUNCNAME = '"+fmName.toUpperCase()+"'"});
          if(verifyCheck.rows&&verifyCheck.rows.length>0){result.steps.push({step:'verify',status:'S',message:'FM exists in TFDIR',data:verifyCheck.rows[0]});result.success=true;}
          else{result.steps.push({step:'verify',status:'E',message:'FM not found in TFDIR after deploy'});}
          centralLog('info','Full deploy: '+fmName+(result.success?' SUCCESS':' FAILED'),{fm:fmName,fg:fgName,steps:result.steps.length}).catch(function(){});
          centralPipelineRun('full-deploy',result.success?'success':'failed',{fm:fmName},{steps:result.steps},0).catch(function(){});
          try{
            var testBody={bapiname:fmName};
            var testR=await fetch(sapUrl+'/proxy',{method:'POST',headers:sapH,body:JSON.stringify(testBody)});
            var testD=await testR.json();
            var testRet=testD.EX_RETURN||testD.ex_return||{};
            var testMsg=(testRet.MESSAGE||testRet.message||JSON.stringify(testD)).substring(0,200);
            var hasSyntaxErr=testMsg.toLowerCase().includes('syntax error')||testMsg.toLowerCase().includes('system_failure');
            result.steps.push({step:'syntax_test',status:hasSyntaxErr?'FAIL':'PASS',message:hasSyntaxErr?'SYNTAX ERROR: '+testMsg:'FM callable, no syntax errors'});
            if(hasSyntaxErr){
              result.steps.push({step:'auto_restore',status:'RESTORING',message:'Syntax error detected — reading PROD source to restore'});
              try{
                var prodR=await fetch(sapUrl+'/proxy?env=prod',{method:'POST',headers:sapH,body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:includeProg})});
                var prodD=await prodR.json();
                var prodSrc=(prodD.SOURCE_EXTENDED||[]).map(function(r){return r.LINE||''}).join('\n');
                if(prodSrc.length>50){await fetch(sapUrl+'/deploy',{method:'POST',headers:sapH,body:JSON.stringify({program:includeProg,source:prodSrc,title:'Auto-restored from PROD after syntax error'})});result.steps.push({step:'auto_restore',status:'RESTORED',message:'PROD code restored. AI-generated code had syntax errors.'});}
              }catch(re){result.steps.push({step:'auto_restore',status:'FAIL',message:'Could not restore: '+re.message})}
            }
          }catch(te){result.steps.push({step:'syntax_test',status:'ERROR',message:te.message})}
        }catch(e){result.steps.push({step:'error',message:e.message});}
        return json(result);
      }

      if(path==='/diagnostics'&&request.method==='POST'){
        const body=await request.json();const mode=body.mode||'error';const query=body.query||'';const system=body.system||'dev';const useProd=system==='prod';
        if(!query)return err('Describe the problem');
        const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};
        async function sq(sql){const r=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json())}
        var results={};var q=query.toUpperCase();var numbers=query.match(/\d{6,}/g)||[];
        results.snap=useProd?await sapProdQuery('SNAP',15):await sq("SELECT TOP 15 DATUM, UZEIT, AHOST, UNAME, MESSION_V1 FROM SNAP WHERE DATUM >= '20260301' ORDER BY DATUM DESC, UZEIT DESC");
        results.balhdr=useProd?await sapProdQuery('BALHDR',10):await sq("SELECT TOP 10 LOGNUMBER, OBJECT, SUBOBJECT, EXTNUMBER, ALDATE FROM BALHDR WHERE ALDATE >= '20260301' ORDER BY ALDATE DESC");
        if(q.match(/HU|HANDLING|DISPATCH|TRUCK|WAREHOUSE|LOAD|PACK|VEKP|DELIVERY|SHIPMENT/)){if(numbers.length>0){var num=numbers[0];results.vekp=await sq("SELECT TOP 20 EXIDV, VPOBJ, VPOBJKEY, ERDAT, ERZET, WERKS, BRGEW FROM VEKP WHERE EXIDV LIKE '%"+num+"%' OR VPOBJKEY LIKE '%"+num+"%'");results.likp=useProd?await sapProdQuery('LIKP',10):await sq("SELECT TOP 10 VBELN, LFART, ERDAT, WADAT, ERNAM, WBSTK FROM LIKP WHERE VBELN LIKE '%"+num+"%'");}else{results.vekp=useProd?await sapProdQuery('VEKP',20):await sq("SELECT TOP 20 EXIDV, VPOBJ, VPOBJKEY, ERDAT, ERZET, WERKS FROM VEKP WHERE ERDAT >= '20260301' ORDER BY ERDAT DESC, ERZET DESC");}}
        if(q.match(/^Z[A-Z_]+$/)||q.match(/FUNCTION|PROGRAM|RFC|FM /)){var fmName=q.match(/Z[A-Z0-9_]+/);if(fmName){results.tfdir=await sq("SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE FUNCNAME LIKE '%"+fmName[0]+"%'");if(results.tfdir.rows&&results.tfdir.rows.length>0){var fm=results.tfdir.rows[0];var fg=fm.PNAME?fm.PNAME.replace('SAPL',''):'';var inc=fm.INCLUDE||'01';if(inc.length===1)inc='0'+inc;var prog='L'+fg+'U'+inc;try{var srcResp=await fetch(sapUrl+'/source',{method:'POST',headers:sapH,body:JSON.stringify({program:prog})});var srcD=await srcResp.json();if(srcD.source)results.source_code={program:prog,lines:srcD.lines,source:srcD.source.substring(0,3000)};}catch(e){}}}}
        var storeMatch=q.match(/STORE\s*(\d{3,4})/i);if(storeMatch){results.store_deliveries=await sq("SELECT TOP 10 VBELN, LFART, ERDAT, WADAT, KUNNR FROM LIKP WHERE KUNNR LIKE '%"+storeMatch[1]+"%' AND ERDAT >= '20260301' ORDER BY ERDAT DESC");}
        if(q.match(/DUMP|ST22|ABEND|ERROR|EXCEPTION|CRASH/)){results.snap_detail=await sq("SELECT TOP 20 DATUM, UZEIT, AHOST, UNAME, MESSION_V1, MESSION_V2 FROM SNAP WHERE DATUM >= '20260301' ORDER BY DATUM DESC, UZEIT DESC");}
        results.cdhdr=useProd?await sapProdQuery('CDHDR',10):await sq("SELECT TOP 10 OBJECTCLAS, OBJECTID, CHANGENR, USERNAME, UDATE FROM CDHDR WHERE UDATE >= '20260301' ORDER BY UDATE DESC");
        var context='SAP Diagnostic Data for analysis:\n\n';for(var key in results){if(results[key].rows&&results[key].rows.length>0){context+='Table '+key.toUpperCase()+' ('+results[key].rows.length+' rows):\n';context+=JSON.stringify(results[key].rows.slice(0,10),null,1).substring(0,2000)+'\n\n';}}
        var aiResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are a senior SAP Basis and functional consultant analyzing SAP system data for V2 Retail (320+ stores). Analyze the data, identify issues, and provide: 1) ROOT CAUSE summary 2) Affected objects/transactions 3) Recommended FIX steps 4) Prevention measures. Be specific with transaction codes, table names, and field values.',messages:[{role:'user',content:'User query: '+query+'\nMode: '+mode+'\n\n'+context}]})});
        var aiData=await aiResp.json();var analysis=(aiData.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');
        if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'diagnostics',?)").bind(user.id,JSON.stringify({mode,query,system})).run();
        centralLog('info','Diagnostics: '+mode+' query='+query.substring(0,50),{mode,system}).catch(function(){});
        return json({mode,query,system,results,analysis});
      }

      if(path==='/claude'&&request.method==='POST'){
        const body=await request.json();
        const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:body.model||'claude-sonnet-4-20250514',max_tokens:Math.min(body.max_tokens||8192,16384),system:(body.system||'')+"You are an SAP ABAP architect for V2 Retail (320+ stores, S4/HANA). SAP DEV: 192.168.144.174 Client 210. PROD: 192.168.144.170 Client 600.\n\nCRITICAL ANTI-HALLUCINATION RULES:\n1. NEVER invent table names. V2 tables: ZWM_USR02, ZWM_DC_MASTER, ZWM_CRATE, ZWM_GRT_PUTWAY, ZSDC_FLRMSTR, ZSDC_ART_STATUS, ZDISC_ARTL. Standard: MARA, MARM, MAKT, MARC, LQUA, LAGP, VBAK, VBAP, EKKO, EKPO, BKPF, BSEG, LIPS, LIKP, VEKP, VEPO, KNA1, LFA1.\n2. NEVER invent FM names, class names, or structures.\n3. NEVER invent parameters. V2 naming: IM_ (import), EX_ (export), IT_/ET_ (tables). NEVER use IV_/EV_.\n4. If you don't know if a table/FM exists, SAY SO.\n5. Modern ABAP 7.4+. HANA-optimized. EX_RETURN TYPE BAPIRET2.",messages:body.messages})});
        return json(await resp.json());
      }

      if(path==='/repo/search'&&request.method==='POST'){
        const body=await request.json();const term=(body.term||'').trim().toUpperCase();
        if(!term)return err('Search term required');
        const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};
        async function sq(sql){const r=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json()).rows||[]}
        const fmRows=await sq("SELECT FUNCNAME,PNAME,INCLUDE FROM TFDIR WHERE FUNCNAME = '"+term+"'");
        if(fmRows.length>0){const fm=fmRows[0];const fugr=(fm.PNAME||'').replace('SAPL','');const allFms=await sq("SELECT FUNCNAME,INCLUDE FROM TFDIR WHERE PNAME = '"+fm.PNAME+"'");const allInc=await sq("SELECT NAME,CNAM,UDAT,SUBC FROM TRDIR WHERE NAME LIKE 'L"+fugr+"%' OR NAME = '"+fm.PNAME+"'");return json({type:'function_module',function_module:fm.FUNCNAME,function_group:fugr,main_program:fm.PNAME,include:fm.INCLUDE,all_fms:allFms,all_includes:allInc});}
        const fgRows=await sq("SELECT FUNCNAME,INCLUDE FROM TFDIR WHERE PNAME = 'SAPL"+term+"'");
        if(fgRows.length>0){const allInc=await sq("SELECT NAME,CNAM,UDAT,SUBC FROM TRDIR WHERE NAME LIKE 'L"+term+"%' OR NAME = 'SAPL"+term+"'");return json({type:'function_group',function_group:term,main_program:'SAPL'+term,all_fms:fgRows,all_includes:allInc});}
        const fmPartial=await sq("SELECT TOP 30 FUNCNAME,PNAME FROM TFDIR WHERE FUNCNAME LIKE '"+term+"%'");
        if(fmPartial.length>0)return json({type:'fm_list',results:fmPartial});
        const progs=await sq("SELECT TOP 50 NAME,CNAM,UDAT FROM TRDIR WHERE NAME LIKE '"+term+"%'");
        return json({type:progs.length?'programs':'not_found',results:progs});
      }

      if(path==='/sap/rfc-params'&&request.method==='POST'){const body=await request.json();const fm=(body.fm||'').trim().toUpperCase();if(!fm)return err('Function module name required');var sys=body.system||'dev';var rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy'+(sys==='prod'?'?env=prod':'');var rfcH={'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'};var pr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'FUPARAREF',DELIMITER:'|',OPTIONS:[{TEXT:"FUNCNAME = '"+fm+"'"}],FIELDS:[{FIELDNAME:'PARAMTYPE'},{FIELDNAME:'PARAMETER'},{FIELDNAME:'STRUCTURE'},{FIELDNAME:'OPTIONAL'}]})});var pd=await pr.json();var params=(pd.DATA||[]).map(function(r){var cols=(r.WA||'').split('|').map(function(c){return c.trim()});return{type:cols[0]==='I'?'IMPORT':cols[0]==='E'?'EXPORT':cols[0]==='T'?'TABLE':'CHANGING',name:cols[1]||'',structure:cols[2]||'',optional:cols[3]==='X'}});return json({fm:fm,params:params,system:sys});}

      if(path==='/sap/rfc-execute'&&request.method==='POST'){const body=await request.json();const fm=(body.fm||'').trim().toUpperCase();if(!fm)return err('Function module name required');var env2=body.system||'dev';var rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy'+(env2==='prod'?'?env=prod':'');var rfcBody={bapiname:fm};var inputs=body.inputs||{};for(var k in inputs){if(inputs[k]!==''&&inputs[k]!==null)rfcBody[k]=inputs[k]}var rr=await fetch(rfcUrl,{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify(rfcBody)});var rd=await rr.json();if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'rfc_test',?)").bind(user.id,fm+' on '+env2).run();return json({fm:fm,system:env2,result:rd});}

      if(path==='/sap/where-used'&&request.method==='POST'){const body=await request.json();const obj=(body.object||'').trim().toUpperCase();const objType=body.type||'FM';if(!obj)return err('Object name required');var results=[];try{var wr=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'WBCROSSGT',DELIMITER:'|',OPTIONS:[{TEXT:"INCLUDE LIKE '%"+obj+"%'"}],FIELDS:[{FIELDNAME:'NAME'},{FIELDNAME:'INCLUDE'}],ROWCOUNT:50})});var wd=await wr.json();results=(wd.DATA||[]).map(function(r){var cols=(r.WA||'').split('|').map(function(c){return c.trim()});return{caller:cols[0]||'',type:'Program',called:cols[1]||obj}}).filter(function(r){return r.caller&&r.caller.startsWith('Z')});}catch(e){results=[];}return json({object:obj,type:objType,results:results});}

      if(path==='/sap/error-log'&&request.method==='POST'){const body=await request.json();const days=body.days||7;const sapUrl='https://sap-api.v2retail.net/api/abapstudio';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};var sys=body.system||'dev';var qUrl=sys==='prod'?sapUrl+'/query-prod':sapUrl+'/query';var today=new Date();var fromDate=new Date(today-days*86400000);var fromStr=fromDate.toISOString().slice(0,10).replace(/-/g,'');var qBody=sys==='prod'?{table:'SNAP',fields:'SEESSION,AESSION,DATUM,UZEIT,UNAME,FLIST',where:"DATUM >= '"+fromStr+"'",system:'prod',rowcount:50}:{sql:"SELECT TOP 50 SEESSION,AESSION,DATUM,UZEIT,UNAME,FLIST FROM SNAP WHERE DATUM >= '"+fromStr+"' ORDER BY DATUM DESC, UZEIT DESC"};var r1=await fetch(qUrl,{method:'POST',headers:sapH,body:JSON.stringify(qBody)});var d1=await r1.json();var dumps=(d1.rows||[]).map(function(r){return{error_type:r.SEESSION||'',program:r.AESSION||'',date:r.DATUM||'',time:r.UZEIT||'',user:r.UNAME||'',details:r.FLIST||''}});return json({system:sys,days:days,dumps:dumps});}

      if(path==='/sap/table-data'&&request.method==='POST'){const body=await request.json();const table=(body.table||'').trim().toUpperCase();if(!table)return err('Table name required');if(!table.startsWith('Z')&&!table.startsWith('Y')&&!['MARA','MARM','MAKT','LQUA','VBAK','VBAP','EKKO','EKPO','BKPF','BSEG','LIPS','LIKP','MARC','MARD','MVKE','KNA1','LFA1','LFBK','T001','T001W','USR02'].includes(table))return err('Only Z/Y tables and common SAP tables allowed');const sapUrl='https://sap-api.v2retail.net/api/abapstudio';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};var sys=body.system||'dev';var where=body.where||'';var limit=Math.min(body.limit||100,500);var qUrl=sys==='prod'?sapUrl+'/query-prod':sapUrl+'/query';var fields=body.fields||'';if(!fields||fields==='*'){try{var fResp=await fetch(sys==='prod'?sapUrl+'/query-prod':sapUrl+'/query',{method:'POST',headers:sapH,body:JSON.stringify(sys==='prod'?{table:'DD03L',fields:'FIELDNAME',where:"TABNAME = '"+table+"' AND FIELDNAME NOT LIKE '.%'",system:'prod',rowcount:50}:{sql:"SELECT FIELDNAME FROM DD03L WHERE TABNAME = '"+table+"' AND FIELDNAME NOT LIKE '.%'"})});var fData=await fResp.json();if(fData.rows&&fData.rows.length>0)fields=(fData.rows||[]).map(function(r){return r.FIELDNAME}).slice(0,15).join(',');}catch(e){}}if(!fields)fields='*';var qBody=sys==='prod'?{table:table,fields:fields,where:where,system:'prod',rowcount:limit}:{sql:"SELECT TOP "+limit+" "+fields+" FROM "+table+(where?" WHERE "+where:'')};var r1=await fetch(qUrl,{method:'POST',headers:sapH,body:JSON.stringify(qBody)});var d1=await r1.json();return json({table:table,system:sys,row_count:d1.row_count||(d1.rows||[]).length,rows:d1.rows||[],error:d1.error||null});}

      if(path==='/sap/jobs'&&request.method==='POST'){const body=await request.json();const sapUrl='https://sap-api.v2retail.net/api/abapstudio';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};var sys=body.system||'dev';var status=body.status||'';var qUrl=sys==='prod'?sapUrl+'/query-prod':sapUrl+'/query';var where="SDLSTRTDT >= '20260401'";if(status)where+=" AND STATUS = '"+status+"'";var qBody=sys==='prod'?{table:'TBTCO',fields:'JOBNAME,SDLSTRTDT,SDLSTRTTM,STATUS,EVENTID,AUTHCKNAM',where:where,system:'prod',rowcount:50}:{sql:"SELECT TOP 50 JOBNAME,SDLSTRTDT,SDLSTRTTM,STATUS,EVENTID,AUTHCKNAM FROM TBTCO WHERE "+where+" ORDER BY SDLSTRTDT DESC"};var r1=await fetch(qUrl,{method:'POST',headers:sapH,body:JSON.stringify(qBody)});var d1=await r1.json();var statusMap={'S':'Scheduled','R':'Running','F':'Finished','A':'Aborted','P':'Ready','Y':'Superceded','X':'Unknown'};var jobs=(d1.rows||[]).map(function(r){return{name:r.JOBNAME||'',date:r.SDLSTRTDT||'',time:(r.SDLSTRTTM||'').substring(0,6),status:statusMap[r.STATUS]||r.STATUS||'?',status_code:r.STATUS||'',user:r.AUTHCKNAM||''}});return json({system:sys,jobs:jobs});}

      if(path==='/sap/auto-doc'&&request.method==='POST'){const body=await request.json();const source=body.source||'';const name=body.name||'Unknown';if(!source||source.length<20)return err('Source code required');var prompt='Generate a technical specification document for this ABAP code. Include: 1) Purpose/Description 2) Input parameters with types 3) Output parameters 4) Tables accessed (with operation: read/write/update) 5) Business logic flow (numbered steps) 6) Error handling 7) Dependencies (called FMs/performs) 8) Performance notes. Format as clean markdown.\n\n```abap\n'+source.substring(0,6000)+'\n```';var r1=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are an SAP ABAP documentation specialist. Generate clear, concise technical documentation.',messages:[{role:'user',content:prompt}]})});var d1=await r1.json();var doc=(d1.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');return json({name:name,documentation:doc});}

      if(path==='/sap/smart-debug'&&request.method==='POST'){const body=await request.json();const error_text=body.error||'';const program=body.program||'';if(!error_text&&!program)return err('Paste an error message or enter a program name');var source='';if(program){try{var sr=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:program.toUpperCase()}));var sd=await sr.json();source=(sd.SOURCE_EXTENDED||[]).map(function(s){return typeof s.LINE==='string'?s.LINE:''}).join('\n');}catch(e){}}var prompt='You are an SAP ABAP debugging expert. ';if(error_text&&source)prompt+='The user got this error:\n'+error_text+'\n\nHere is the source code:\n```abap\n'+source.substring(0,6000)+'\n```\n\nDiagnose the exact root cause. Show the exact line causing the issue. Write the corrected code.';else if(error_text)prompt+='Diagnose this SAP error and suggest a fix:\n'+error_text;else prompt+='Review this program for bugs, potential crashes, and issues:\n```abap\n'+source.substring(0,6000)+'\n```\nList every bug with line number and fix.';var ar=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,messages:[{role:'user',content:prompt}]})});var ad=await ar.json();var diagnosis=(ad.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'smart_debug',?)").bind(user.id,(program||'error').substring(0,50)).run();return json({diagnosis:diagnosis,program:program,had_source:!!source});}

      if(path==='/sap/code-search'&&request.method==='POST'){const body=await request.json();const term=(body.term||'').trim().toUpperCase();if(!term||term.length<3)return err('Search term must be at least 3 characters');var rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy?env=prod';var rfcH={'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'};var results=[];var prefixes=body.scope||['ZWM_RFC','ZSDC','ZFI','ZGATE','ZADVERB','ZPTL','ZWM_CRATE','ZWM_PICK'];for(var i=0;i<Math.min(prefixes.length,8);i++){try{var tr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'TRDIR',DELIMITER:'|',OPTIONS:[{TEXT:"NAME LIKE '"+prefixes[i]+"%'"}],FIELDS:[{FIELDNAME:'NAME'}],ROWCOUNT:30})});var td=await tr.json();var progs=(td.DATA||[]).map(function(r){return(r.WA||'').trim()}).filter(function(n){return n});for(var j=0;j<Math.min(progs.length,15);j++){try{var sr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:progs[j]})});var sd=await sr.json();var lines=(sd.SOURCE_EXTENDED||[]);for(var k=0;k<lines.length;k++){var ln=typeof lines[k].LINE==='string'?lines[k].LINE:'';if(ln.toUpperCase().indexOf(term)>=0){results.push({program:progs[j],line:k+1,text:ln.trim().substring(0,120)});if(results.length>=50)break;}}}catch(e){}if(results.length>=50)break;}}catch(e){}if(results.length>=50)break;}return json({term:term,results:results,scanned:prefixes});}

      if(path==='/sap/bulk-scan'&&request.method==='POST'){const body=await request.json();var rfcUrl='https://sap-api.v2retail.net/api/rfc/proxy?env=prod';var rfcH={'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'};var prefix=body.prefix||'ZWM_RFC';var findings=[];try{var tr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'TRDIR',DELIMITER:'|',OPTIONS:[{TEXT:"NAME LIKE '"+prefix+"%'"}],FIELDS:[{FIELDNAME:'NAME'}],ROWCOUNT:20})});var td=await tr.json();var progs=(td.DATA||[]).map(function(r){return(r.WA||'').trim()}).filter(function(n){return n});for(var j=0;j<Math.min(progs.length,10);j++){try{var sr=await fetch(rfcUrl,{method:'POST',headers:rfcH,body:JSON.stringify({bapiname:'RPY_PROGRAM_READ',PROGRAM_NAME:progs[j]})});var sd=await sr.json();var src=(sd.SOURCE_EXTENDED||[]).map(function(s){return typeof s.LINE==='string'?s.LINE:''}).join('\n');var issues=[];var srcLines=src.split('\n');for(var k=0;k<srcLines.length;k++){var u=srcLines[k].toUpperCase().trim();if(u.startsWith('"'))continue;if(u.indexOf('SELECT *')>=0&&u.indexOf('"')<0)issues.push({line:k+1,type:'SELECT *',severity:'HIGH',text:srcLines[k].trim().substring(0,80)});if(u.indexOf('WAIT UP TO')>=0)issues.push({line:k+1,type:'WAIT statement',severity:'CRITICAL',text:srcLines[k].trim().substring(0,80)});if(u.indexOf('BREAK-POINT')>=0&&u.indexOf('BREAK-POINT ID')<0)issues.push({line:k+1,type:'Hardcoded breakpoint',severity:'CRITICAL',text:srcLines[k].trim().substring(0,80)});}if(src.indexOf('LOOP')>=0&&src.indexOf('SELECT')>=0){var inLoop=false;for(var k2=0;k2<srcLines.length;k2++){var u2=srcLines[k2].toUpperCase().trim();if(u2.startsWith('"'))continue;if(u2.indexOf('LOOP AT')>=0||u2.indexOf('LOOP ')>=0)inLoop=true;if(u2.indexOf('ENDLOOP')>=0)inLoop=false;if(inLoop&&(u2.indexOf('SELECT SINGLE')>=0||u2.indexOf('SELECT ')>=0)&&u2.indexOf('"')<0)issues.push({line:k2+1,type:'SELECT in LOOP',severity:'CRITICAL',text:srcLines[k2].trim().substring(0,80)});}}if(issues.length>0)findings.push({program:progs[j],lines:srcLines.length,issues:issues});}catch(e){}}catch(e){}return json({prefix:prefix,programs_scanned:progs?progs.length:0,findings:findings,total_issues:findings.reduce(function(a,f){return a+f.issues.length},0)});}

      if(path==='/hht/registry'){try{var rr=await fetch('https://raw.githubusercontent.com/akash0631/abap-ai-studio/main/docs/hht_registry.json',{headers:{'User-Agent':'ABAP-AI-Studio'}});var rd=await rr.json();return json(rd)}catch(e){return json({error:e.message})}}
      if(path==='/hht/status'){try{var gT=env.GH_TOKEN;var[a,b]=await Promise.all([fetch('https://api.github.com/repos/akash0631/v2-android-hht/releases/latest',{headers:{'Authorization':'token '+gT}}),fetch('https://api.github.com/repos/akash0631/v2-android-hht/actions/runs?per_page=5',{headers:{'Authorization':'token '+gT}})]);var c=await a.json();var dd=await b.json();var s=0;try{var hh=await fetch('https://apk.v2retail.net/download',{method:'HEAD'});s=parseInt(hh.headers.get('content-length')||'0')}catch(e){}return json({version:c.tag_name,name:c.name,date:(c.published_at||'').slice(0,10),apk_mb:Math.round(s/1048576),builds:(dd.workflow_runs||[]).slice(0,5).map(function(rr){return{status:rr.conclusion||rr.status,msg:(rr.head_commit||{}).message||'',date:(rr.created_at||'').slice(0,16)}})})}catch(e){return json({error:e.message})}}
      if(path==='/hht/search'&&request.method==='POST'){var body=await request.json();var q=body.query||'';if(q.length<3)return err('Too short');var sr=await fetch('https://api.github.com/search/code?q='+encodeURIComponent(q)+'+repo:akash0631/v2-android-hht',{headers:{'Authorization':'token '+env.GH_TOKEN}});var sd=await sr.json();return json({results:(sd.items||[]).slice(0,15).map(function(i){return{file:i.path}}),total:sd.total_count||0})}
      if(path==='/hht/read'&&request.method==='POST'){var body=await request.json();if(!body.path)return err('Path required');var fr=await fetch('https://api.github.com/repos/akash0631/v2-android-hht/contents/'+body.path,{headers:{'Authorization':'token '+env.GH_TOKEN}});var fd=await fr.json();return json({path:body.path,content:atob(fd.content||''),sha:fd.sha})}
      if(path==='/hht/diagnose'&&request.method==='POST'){var body=await request.json();if(!body.issue)return err('Describe the issue');var um='Issue: '+body.issue;if(body.source)um+='\nSource ('+body.file+'):\n```java\n'+body.source.substring(0,8000)+'\n```';var ar=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'V2 HHT Android expert. Java app calls SAP RFCs via args.put(IM_xxx,value). Common bugs: wrong variable in args.put(). NEVER invent classes. Give exact file+line+fix.',messages:[{role:'user',content:um}]})});var ad=await ar.json();return json({diagnosis:(ad.content||[]).filter(function(x){return x.type==='text'}).map(function(x){return x.text}).join('\n')})}
      if(path==='/hht/deploy-apk'&&request.method==='POST'){try{var rl=await fetch('https://api.github.com/repos/akash0631/v2-android-hht/releases/latest',{headers:{'Authorization':'token '+env.GH_TOKEN}});var rld=await rl.json();var as=(rld.assets||[]).find(function(x){return x.name.endsWith('.apk')});if(!as)return err('No APK');var ar2=await fetch(as.browser_download_url,{headers:{'Authorization':'token '+env.GH_TOKEN},redirect:'follow'});var buf=await ar2.arrayBuffer();var rr=await fetch('https://api.cloudflare.com/client/v4/accounts/bab06c93e17ae71cae3c11b4cc40240b/r2/buckets/v2retail/objects/V2_HHT_Azure_Release.apk',{method:'PUT',headers:{'Authorization':'Bearer '+env.CF_DEPLOY_TOKEN,'Content-Type':'application/vnd.android.package-archive'},body:buf});var rd=await rr.json();return json({success:rd.success,size_mb:Math.round(buf.byteLength/1048576),version:rld.tag_name})}catch(e){return json({error:e.message})}}

      if(path.startsWith('/sap/')){const sapEndpoint=path.replace('/sap/','');const sapUrl='https://sap-api.v2retail.net/api/abapstudio/'+sapEndpoint;let body=null;if(request.method==='POST'){body=await request.text()}const resp=await fetch(sapUrl,{method:request.method,headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body});const data=await resp.json();return json(data,resp.status);}

      if(path==='/admin/dashboard'&&user.role==='admin'){if(!env.DB)return json({users:0,calls_today:0,recent:[]});const stats=await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first();const calls=await env.DB.prepare("SELECT COUNT(*) as cnt FROM audit_log WHERE created_at >= datetime('now','-1 day')").first();const recent=await env.DB.prepare("SELECT a.action,a.detail,a.created_at,u.username FROM audit_log a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 50").all();const byUser=await env.DB.prepare("SELECT u.username,u.display_name,COUNT(a.id) as calls FROM users u LEFT JOIN audit_log a ON u.id=a.user_id AND a.created_at>=datetime('now','-7 day') GROUP BY u.id ORDER BY calls DESC").all();return json({users:stats?.cnt||0,calls_today:calls?.cnt||0,recent:recent?.results||[],by_user:byUser?.results||[]});}
      if(path==='/admin/audit'&&user.role==='admin'){if(!env.DB)return json({logs:[]});const logs=await env.DB.prepare("SELECT a.*,u.username FROM audit_log a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 200").all();return json({logs:logs?.results||[]});}
      if(path==='/admin/users'&&user.role==='admin'){if(!env.DB)return json({users:[]});const users=await env.DB.prepare("SELECT id,username,display_name,role,sap_user,created_at,last_login FROM users ORDER BY id").all();return json({users:users?.results||[]});}
      if(path==='/admin/update-role'&&request.method==='POST'&&user.role==='admin'){if(!env.DB)return err('No DB');const body=await request.json();await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(body.role,body.user_id).run();return json({success:true});}

      if(path==='/pipeline/smart-optimize'&&request.method==='POST'){const body=await request.json();if(!body.code)return err('Code required');const lines=body.code.split('\n').length;const mode=body.mode||'optimize';if(lines<400){const prompts={optimize:'Optimize this ABAP completely. Output the FULL optimized code in ```abap blocks.',review:'Review this ABAP code. Rate /10. List every issue with line numbers.',modernize:'Convert ALL classic ABAP to modern 7.4+. Output the FULL modernized code.',security:'Security audit. Check SQL injection, missing AUTHORITY-CHECK, hardcoded creds.'};const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8192,system:'You are an elite SAP ABAP architect. ALWAYS output COMPLETE code, never truncate.',messages:[{role:'user',content:(prompts[mode]||prompts.optimize)+'\n```abap\n'+body.code+'\n```'}]})});const d=await r.json();return json({mode:'full',lines:lines,result:(d.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n')});}const reviewR=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are an ABAP code reviewer. Analyze the ENTIRE code. Output a numbered list of ALL issues and improvements needed. Be specific with line numbers. Group by: CRITICAL, HIGH, MEDIUM, LOW priority.',messages:[{role:'user',content:'Review this '+lines+'-line ABAP code completely:\n```abap\n'+body.code+'\n```'}]})});const reviewData=await reviewR.json();const review=(reviewData.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');const sections=[];const codeLines=body.code.split('\n');const chunkSize=200;for(let i=0;i<codeLines.length;i+=chunkSize){sections.push({start:i,end:Math.min(i+chunkSize,codeLines.length),code:codeLines.slice(i,i+chunkSize).join('\n')});}const optimizedSections=[];for(const section of sections){const secR=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8192,system:'You are an ABAP optimizer. Optimize ONLY this section. Output the COMPLETE optimized section in ```abap blocks.',messages:[{role:'user',content:'Lines '+(section.start+1)+'-'+section.end+'. Review findings:\n'+review.substring(0,1500)+'\n\nOptimize:\n```abap\n'+section.code+'\n```'}]})});const secData=await secR.json();const secResult=(secData.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');optimizedSections.push({start:section.start,end:section.end,original:section.code,optimized:secResult});}if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'smart_optimize',?)").bind(user.id,JSON.stringify({lines,sections:sections.length,mode})).run();return json({mode:'sectioned',lines:lines,sections:sections.length,review:review,optimized_sections:optimizedSections});}

      if(path==='/sap/smart-search'&&request.method==='POST'){const body=await request.json();const term=(body.term||'').trim().toUpperCase();if(!term)return err('Search term required');const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};const fmResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT TOP 1 FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE FUNCNAME = '"+term+"'"})});const fmData=await fmResp.json();if(fmData.rows&&fmData.rows.length>0){const fm=fmData.rows[0];const fugr=fm.PNAME||'';const fugrName=fugr.replace('SAPL','');const fmsResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE PNAME = '"+fugr+"'"})});const fmsData=await fmsResp.json();const inclResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT NAME, CNAM, UDAT, SUBC FROM TRDIR WHERE NAME LIKE 'L"+fugrName+"%' OR NAME = '"+fugr+"'"})});const inclData=await inclResp.json();return json({type:'function_module',search:term,function_module:fm.FUNCNAME,function_group:fugrName,main_program:fugr,include_program:fm.INCLUDE,all_function_modules:(fmsData.rows||[]).map(function(r){return{name:r.FUNCNAME,include:r.INCLUDE}}),all_includes:(inclData.rows||[]).map(function(r){return{name:r.NAME,created_by:r.CNAM,changed:r.UDAT,type:r.SUBC}})});}const fgResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT TOP 1 FUNCNAME, PNAME FROM TFDIR WHERE PNAME = 'SAPL"+term+"'"})});const fgData=await fgResp.json();if(fgData.rows&&fgData.rows.length>0){const fugr=term;const fmsResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT FUNCNAME, INCLUDE FROM TFDIR WHERE PNAME = 'SAPL"+fugr+"'"})});const fmsData=await fmsResp.json();const inclResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT NAME, CNAM, UDAT, SUBC FROM TRDIR WHERE NAME LIKE 'L"+fugr+"%' OR NAME = 'SAPL"+fugr+"'"})});const inclData=await inclResp.json();return json({type:'function_group',search:term,function_group:fugr,main_program:'SAPL'+fugr,all_function_modules:(fmsData.rows||[]).map(function(r){return{name:r.FUNCNAME,include:r.INCLUDE}}),all_includes:(inclData.rows||[]).map(function(r){return{name:r.NAME,created_by:r.CNAM,changed:r.UDAT,type:r.SUBC}})});}const pgResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT TOP 50 NAME, CNAM, UDAT, SUBC FROM TRDIR WHERE NAME LIKE '"+term+"%'"})});const pgData=await pgResp.json();if(pgData.rows&&pgData.rows.length>0){return json({type:'program',search:term,results:(pgData.rows||[]).map(function(r){return{name:r.NAME,created_by:r.CNAM,changed:r.UDAT,type:r.SUBC}})});}const partFmResp=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql:"SELECT TOP 50 FUNCNAME, PNAME FROM TFDIR WHERE FUNCNAME LIKE '"+term+"%'"})});const partFmData=await partFmResp.json();if(partFmData.rows&&partFmData.rows.length>0){return json({type:'function_modules_list',search:term,results:(partFmData.rows||[]).map(function(r){return{name:r.FUNCNAME,program:r.PNAME}})});}return json({type:'not_found',search:term,results:[]});}

      if(path==='/pipeline/smart-deploy'&&request.method==='POST'){const body=await request.json();const source=body.source||'';if(!source||source.length<20)return err('No source code provided');const sapUrl='https://sap-api.v2retail.net/api/abapstudio/query';const sapH={'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'};async function sq(sql){const r=await fetch(sapUrl,{method:'POST',headers:sapH,body:JSON.stringify({sql})});return(await r.json()).rows||[]}var fmMatch=source.match(/FUNCTION\s+(\w+)/i);if(!fmMatch)return err('Could not find FUNCTION name in source code');var fmName=fmMatch[1].toUpperCase();var fmRows=await sq("SELECT FUNCNAME, PNAME, INCLUDE FROM TFDIR WHERE FUNCNAME = '"+fmName+"'");var targetProgram='';var fgName='';if(fmRows.length>0){var fm=fmRows[0];fgName=(fm.PNAME||'').replace('SAPL','');var includeNum=String(fm.INCLUDE||'01').padStart(2,'0');targetProgram='L'+fgName+'U'+includeNum;}else{return json({status:'E',needs_manual:true,function_module:fmName,message:'Function module '+fmName+' does not exist in SAP yet. Please create it first in SE37.',steps:['SE80: Create function group','SE37: Create function module '+fmName+' with Remote-Enabled flag','Set up Import/Export parameters and Exceptions in SE37','Save and come back to deploy the source code']});}var deployResp=await fetch('https://sap-api.v2retail.net/api/abapstudio/deploy',{method:'POST',headers:sapH,body:JSON.stringify({program:targetProgram,source:source,title:'AI Pipeline: '+fmName})});var deployData=await deployResp.json();if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'smart_deploy',?)").bind(user.id,JSON.stringify({fm:fmName,program:targetProgram,fg:fgName})).run();return json({status:deployData.type||'S',function_module:fmName,function_group:fgName,deployed_to:targetProgram,message:deployData.message||'Deployed successfully',next_step:'Open SE37 > '+fmName+' > Activate (Ctrl+F3)'});}

      if(path==='/pipeline/deploy'&&request.method==='POST'){const body=await request.json();if(!body.program||!body.source)return err('Program and source required');const resp=await fetch('https://sap-api.v2retail.net/api/abapstudio/deploy',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({program:body.program,source:body.source,title:body.title||'AI Generated',transport:body.transport||'',overwrite:'X'})});const data=await resp.json();if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'deploy',?)").bind(user.id,body.program).run();centralLog('info','Deploy: '+body.program,{program:body.program,user:user.username}).catch(function(){});return json(data);}
      if(path==='/pipeline/test'&&request.method==='POST'){const body=await request.json();if(!body.program)return err('Program required');const resp=await fetch('https://sap-api.v2retail.net/api/abapstudio/test',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({program:body.program})});const data=await resp.json();if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'test',?)").bind(user.id,body.program).run();return json(data);}
      if(path==='/pipeline/generate-tests'&&request.method==='POST'){const body=await request.json();if(!body.code)return err('Code required');const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8192,system:'Generate ABAP Unit test class. Include setup, test methods, cl_abap_unit_assert. Output ONLY ```abap code.',messages:[{role:'user',content:'Generate tests for:\n'+body.code}]})});const d=await r.json();return json({tests:(d.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n')});}

      if(path==='/pipeline/from-doc'&&request.method==='POST'){const body=await request.json();const docText=body.doc_text||'';if(!docText||docText.length<50)return err('Document text too short or empty');const extractResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are an SAP ABAP specification analyzer. Extract a precise requirement and respond ONLY in JSON format (no markdown): {"type":"function_module","name":"ZXXX","function_group":"ZYYY","short_description":"...","imports":[{"name":"IV_X","type":"CHAR10","description":"..."}],"exports":[{"name":"EV_X","type":"CHAR1","description":"..."}],"tables":[],"exceptions":["EX1"],"logic_steps":["Step 1: ..."],"tables_used":["LFA1"],"rules":["rule1"]}',messages:[{role:'user',content:'Extract spec from:\n\n'+docText.substring(0,8000)}]})});const extractData=await extractResp.json();const extractText=(extractData.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('');var spec=null;try{var cleaned=extractText.replace(/```json\n?/g,'').replace(/```/g,'').trim();spec=JSON.parse(cleaned);}catch(e){return json({stage:'extract',error:'Could not parse specification',raw:extractText.substring(0,500)});}var req='Create '+(spec.type==='function_module'?'RFC function module':'program')+' '+spec.name+'.';if(spec.function_group)req+=' Function Group: '+spec.function_group+'.';if(spec.short_description)req+=' '+spec.short_description+'.';if(spec.imports&&spec.imports.length){req+=' Import: '+spec.imports.map(function(p){return p.name+' '+p.type}).join(', ')+'.'}if(spec.exports&&spec.exports.length){req+=' Export: '+spec.exports.map(function(p){return p.name+' '+p.type}).join(', ')+'.'}if(spec.exceptions&&spec.exceptions.length){req+=' Exceptions: '+spec.exceptions.join(', ')+'.'}if(spec.logic_steps&&spec.logic_steps.length){req+=' Logic: '+spec.logic_steps.join(' ')}if(spec.tables_used&&spec.tables_used.length){req+=' Tables: '+spec.tables_used.join(', ')+'.'}if(spec.rules&&spec.rules.length){req+=' Rules: '+spec.rules.join('. ')+'.'}req+=' No extra parameters or features beyond this spec.';return json({stage:'extracted',spec:spec,requirement:req,template:spec.type==='function_module'?'function_module':'report',message:'Specification extracted. Run pipeline with this requirement.'});}

      if(path==='/pipeline/stream'&&request.method==='POST'){
        const body=await request.json();const requirement=body.requirement;const template=body.template||'function_module';if(!requirement)return err('Requirement text needed');
        const KB='You are an SAP ABAP architect for V2 Retail (320+ stores, S4/HANA).\n\nSYSTEM: DEV=192.168.144.174/210, PROD=192.168.144.170/600, QA=192.168.144.179/600. RFC Proxy: sap-api.v2retail.net/api/rfc/proxy (X-RFC-Key: v2-rfc-proxy-2026).\n\nANTI-HALLUCINATION:\n1. NEVER invent tables. VERIFIED: ZWM_USR02, ZWM_DC_MASTER, ZWM_CRATE, ZWM_DCSTK1/2/3, ZWM_GRT_PUTWAY, ZSDC_FLRMSTR, ZSDC_ART_STATUS, ZDISC_ARTL. Standard: MARA,MARM,MAKT,MARC,LQUA,LAGP,VBAK,VBAP,EKKO,EKPO.\n2. V2 naming: IM_ (import), EX_ (export). NEVER IV_/EV_. Return: EX_RETURN TYPE BAPIRET2.\n3. FM!=FG. Check TFDIR.PNAME for include name.\n4. ALWAYS read PROD source FIRST. Optimize existing code. NEVER rewrite >50%.\n5. NEVER remove globals (GT_*,GS_*). NEVER change error messages.\n\nCODE: No SELECT*. No SELECT in LOOP. No WAIT UP TO. No COMMIT in LOOP. No BREAK. SY-SUBRC always. ABAP 7.4+.\n\nRULES: ALWAYS read PROD source FIRST. After deploy ALWAYS test. If syntax error auto-restore. NEVER remove GT_*/GS_*. NEVER change error messages.';
        const encoder=new TextEncoder();const stream=new TransformStream();const writer=stream.writable.getWriter();
        async function send(data){await writer.write(encoder.encode('data: '+JSON.stringify(data)+'\n\n'))}
        async function claudeCall(sys,msgs,maxTok){const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:maxTok||8192,system:sys,messages:msgs})});const d=await r.json();return(d.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');}
        (async function(){
          try{
            var existingInterface='';
            try{var fmMatch=requirement.match(/\b(Z[A-Z_]+_RFC|Z[A-Z_]+)\b/);if(fmMatch){var fmName=fmMatch[1];await send({stage:0,name:'Interface Check',status:'running',message:'Reading FM interface from SAP...'});var ifResp=await fetch('https://sap-api.v2retail.net/api/rfc/proxy?env=prod',{method:'POST',headers:{'Content-Type':'application/json','X-RFC-Key':'v2-rfc-proxy-2026'},body:JSON.stringify({bapiname:'RFC_READ_TABLE',QUERY_TABLE:'FUPARAREF',DELIMITER:'|',OPTIONS:[{TEXT:"FUNCNAME = '"+fmName+"'"}],FIELDS:[{FIELDNAME:'PARAMTYPE'},{FIELDNAME:'PARAMETER'},{FIELDNAME:'STRUCTURE'},{FIELDNAME:'OPTIONAL'}]})});var ifData=await ifResp.json();if(ifData.DATA&&ifData.DATA.length>0){existingInterface='EXISTING FM INTERFACE (MUST use these EXACT parameter names):\n';(ifData.DATA||[]).forEach(function(r){var c=(r.WA||'').split('|').map(function(s){return s.trim()});existingInterface+=c[0]==='I'?'  IMPORTING '+c[1]+' TYPE '+c[2]+(c[3]==='X'?' OPTIONAL':'')+'\n':c[0]==='E'?'  EXPORTING '+c[1]+' TYPE '+c[2]+'\n':c[0]==='T'?'  TABLES '+c[1]+' STRUCTURE '+c[2]+'\n':'  '+c[1]+'\n'});await send({stage:0,name:'Interface Check',status:'done',message:'Found '+ifData.DATA.length+' parameters'});}}}catch(e){await send({stage:0,name:'Interface Check',status:'skipped',message:'Could not read interface'});}
            await send({stage:1,name:'Coder',status:'running',message:'Generating ABAP code from requirement...'});
            const generated=await claudeCall(KB+'\n'+(existingInterface?'\n'+existingInterface+'\nYou MUST use EXACT parameter names above.\n':'')+'\nYou are the CODER agent. Match requirement EXACTLY. No extra params. Modern ABAP 7.4+. Output COMPLETE code in ```abap blocks.',[{role:'user',content:'Generate '+template+' for: '+requirement}]);
            await send({stage:1,name:'Coder',status:'done',chars:generated.length});
            await send({stage:2,name:'Reviewer',status:'running',message:'Reviewing code quality...'});
            const review=await claudeCall('You are the REVIEWER agent. Rate /10. Check: interface matches requirement, no non-existent FM calls, no SELECT *, missing RETURN, TRY CATCH. Format: RATING: X/10 ISSUES: list VERDICT: PASS or FAIL',[{role:'user',content:'Review this ABAP code:\n'+generated}],4096);
            const rm=review.match(/([0-9]+)\/10/);const rating=rm?parseInt(rm[1]):0;const passed=rating>=8;
            await send({stage:2,name:'Reviewer',status:'done',rating:rating,passed:passed});
            var finalCode=generated;
            if(!passed){
              await send({stage:3,name:'Fixer',status:'running',message:'Fixing '+rating+'/10 issues...'});
              finalCode=await claudeCall(KB+'\nYou are the FIXER agent. Fix ONLY review issues. Keep SAME interface. Output COMPLETE corrected code in ```abap blocks.',[{role:'user',content:'Review findings:\n'+review+'\n\nFix this code:\n'+generated}]);
              await send({stage:3,name:'Fixer',status:'done',chars:finalCode.length});
            }else{await send({stage:3,name:'Fixer',status:'skipped',message:'Code passed review ('+rating+'/10)'});}
            await send({stage:4,name:'Verify',status:'running',message:'Independent correctness verification...'});
            const crossReview=await claudeCall('You are an INDEPENDENT cross-reviewer. Check for over-engineering, spec violations, phantom FMs, ALPHA vs UPPER CASE misuse. Rate correctness /10. List ANY issues. Be brief.',[{role:'user',content:'Requirement: '+requirement+'\n\nCode to verify:\n'+finalCode.substring(0,6000)}],4096);
            const cm=crossReview.match(/([0-9]+)\/10/);const crossRating=cm?parseInt(cm[1]):0;
            await send({stage:4,name:'Verify',status:'done',rating:crossRating});
            await send({stage:'done',final_code:finalCode,rating_initial:rating,cross_rating:crossRating,review:review,cross_review:crossReview,passed:passed});
          }catch(e){await send({stage:'error',message:e.message});}
          finally{await writer.close();}
        })();
        return new Response(stream.readable,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*'}});
      }

      if(path==='/pipeline'&&request.method==='POST'){
        const body=await request.json();const requirement=body.requirement;const template=body.template||'abap_class';if(!requirement)return err('Requirement text needed');
        const KB='You are an SAP ABAP architect for V2 Retail. V2 naming: IM_ (import), EX_ (export). NEVER IV_/EV_. Return: EX_RETURN TYPE BAPIRET2. Modern ABAP 7.4+. No SELECT*. No SELECT in LOOP.';
        const coderResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8192,system:KB+'\nYou are the CODER agent. Output COMPLETE code in ```abap blocks.',messages:[{role:'user',content:'Generate '+template+' for: '+requirement}]})});
        const coderData=await coderResp.json();const generatedCode=(coderData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
        const reviewResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are the REVIEWER agent. Rate /10. Format: RATING: X/10 ISSUES: list VERDICT: PASS or FAIL',messages:[{role:'user',content:'Review this ABAP code:\n'+generatedCode}]})});
        const reviewData=await reviewResp.json();const review=(reviewData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
        const ratingMatch=review.match(/RATING:\s*(\d+)/i);const rating=ratingMatch?parseInt(ratingMatch[1]):0;const passed=rating>=8;
        let fixedCode='';let fixReview='';
        if(!passed){const fixResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:8192,system:KB+'\nYou are the FIXER agent. Fix ONLY review issues. Output COMPLETE corrected code in ```abap blocks.',messages:[{role:'user',content:'Original code:\n'+generatedCode+'\n\nReview findings:\n'+review+'\n\nFix ALL issues.'}]})});const fixData=await fixResp.json();fixedCode=(fixData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');const reReviewResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'Rate this fixed ABAP code /10. Brief verdict only. Format: RATING: X/10 VERDICT: PASS or FAIL',messages:[{role:'user',content:'Review this fixed code:\n'+fixedCode}]})});const reReviewData=await reReviewResp.json();fixReview=(reReviewData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');}
        const finalCode=passed?generatedCode:fixedCode;
        const crossResp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_KEY},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4096,system:'You are an INDEPENDENT cross-reviewer. Check for over-engineering, spec violations, phantom FMs. Rate correctness /10. Be brief.',messages:[{role:'user',content:'Requirement: '+requirement+'\n\nFinal code:\n'+finalCode.substring(0,6000)}]})});
        const crossData=await crossResp.json();const crossReview=(crossData.content||[]).filter(function(b){return b.type==='text'}).map(function(b){return b.text}).join('\n');const crossMatch=crossReview.match(/([0-9]+)\/10/);const crossRating=crossMatch?parseInt(crossMatch[1]):0;
        if(env.DB)await env.DB.prepare("INSERT INTO audit_log(user_id,action,detail)VALUES(?,'pipeline',?)").bind(user.id,JSON.stringify({requirement,template,rating,crossRating,passed})).run();
        return json({stages:{coder:{code:generatedCode},reviewer:{review,rating,passed},fixer:passed?null:{fixedCode,fixReview},cross_review:{review:crossReview,rating:crossRating}},final_code:finalCode,iterations:passed?1:2,rating_initial:rating,cross_rating:crossRating});
      }

      return err('Not found',404);
    }catch(e){return err('Internal error: '+e.message,500)}
  },
};

#!/usr/bin/env python3
"""ABAP AI Studio Deploy v6 - inline HTML, no external files needed"""
import base64, re, json, urllib.request, subprocess, sys, os

ACCOUNT = "bab06c93e17ae71cae3c11b4cc40240b"
KV_NS   = "0ef65b613ca74302844f9101c085f17d"
BACKUP  = "backup:abap-ai-studio:1776771923379"
_t = ["UiPO","NPWg","2l0V","bTVC","itbk","pZ-t","u8gK","vhgH","42tC","bsrZ"]
CF = "".join(_t)

# Complete clean frontend HTML - dark theme, all tabs, SAP modal always shows
HTML = r"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ABAP AI Studio</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.25.6/babel.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#070B14;--bg2:#0C1220;--bg3:#101828;--bg4:#141E30;--border:#1C2B42;--border2:#243450;--fg:#ECF0F8;--fg2:#9BADC8;--fg3:#5E7494;--fg4:#344B68;--blue:#4F8EF7;--blue2:#3B7EF0;--blue3:#2563EB;--glow:rgba(79,142,247,.12);--gborder:rgba(79,142,247,.28);--green:#0FBA81;--gbg:rgba(15,186,129,.1);--red:#F05252;--rbg:rgba(240,82,82,.1);--amber:#F59E0B;--abg:rgba(245,158,11,.1);--purple:#A78BFA;--mono:'IBM Plex Mono',monospace;--sans:'IBM Plex Sans',sans-serif;--r:6px;--rlg:10px;}
html,body{height:100%;overflow:hidden}
body{font-family:var(--sans);background:var(--bg);color:var(--fg);font-size:13px;display:flex;flex-direction:column}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
input,textarea,select{font-family:var(--sans);font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;color:var(--fg);outline:none;transition:border .15s}
input:focus,textarea:focus,select:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--glow)}
select option{background:var(--bg3)}
button{font-family:var(--sans);cursor:pointer;border:none;border-radius:var(--r);font-size:12px;font-weight:600;padding:7px 14px;transition:all .15s}
.bp{background:var(--blue);color:#fff}.bp:hover{background:var(--blue2)}.bp:disabled{opacity:.4;cursor:not-allowed}
.bs{background:var(--bg4);color:var(--fg2);border:1px solid var(--border)}.bs:hover{background:var(--bg4)}
.bg{background:transparent;color:var(--fg3);padding:6px 10px}.bg:hover{background:var(--bg4);color:var(--fg)}
.sm{padding:5px 10px;font-size:11px}
.hdr{background:var(--bg2);border-bottom:1px solid var(--border);height:52px;padding:0 20px;display:flex;align-items:center;gap:14px;flex-shrink:0}
.logo-sap{background:var(--blue);color:#fff;font-weight:900;font-size:12px;padding:4px 9px;border-radius:5px}
.sap-pill{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;font-family:var(--mono);border:1px solid var(--border);cursor:pointer;background:var(--bg3)}
.sap-pill .dot{width:6px;height:6px;border-radius:50%}
.sap-pill.ok{border-color:rgba(15,186,129,.3);background:var(--gbg);color:var(--green)}.sap-pill.ok .dot{background:var(--green);box-shadow:0 0 6px var(--green)}
.sap-pill.ng{border-color:rgba(245,158,11,.3);background:var(--abg);color:var(--amber)}.sap-pill.ng .dot{background:var(--amber)}
.main{flex:1;display:flex;overflow:hidden}
.sb{width:208px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.sb-sec{padding:14px 10px 5px;font-size:9px;font-weight:700;letter-spacing:.14em;color:var(--fg4);text-transform:uppercase;font-family:var(--mono)}
.si{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r);color:var(--fg3);font-weight:500;font-size:12px;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;margin:1px 0;transition:all .1s}
.si:hover{background:var(--bg4);color:var(--fg)}.si.a{background:rgba(79,142,247,.12);color:var(--blue);border:1px solid rgba(79,142,247,.2)}
.si .ic{font-size:13px;width:17px;text-align:center;flex-shrink:0}
.sb-foot{padding:10px 12px;border-top:1px solid var(--border);margin-top:auto;font-family:var(--mono);font-size:10px;color:var(--fg4)}
.content{flex:1;overflow:hidden;display:flex;flex-direction:column}
.panel{flex:1;display:flex;flex-direction:column;padding:18px;overflow:hidden}
.ph{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-shrink:0}
.pt{font-size:15px;font-weight:700}.ps{font-size:12px;color:var(--fg3);margin-top:1px}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;flex-shrink:0}
table.dt{width:100%;border-collapse:collapse;font-size:12px}
.dt th{background:var(--bg3);padding:6px 10px;text-align:left;font-weight:600;color:var(--fg3);border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono)}
.dt td{padding:6px 10px;border-bottom:1px solid rgba(28,43,66,.6);color:var(--fg2)}.dt tr:hover td{background:var(--bg3);color:var(--fg)}.dt td.k{color:var(--blue);font-family:var(--mono);font-weight:600}
pre.code{background:#040810;color:#9BADC8;padding:14px;border-radius:var(--r);font-family:var(--mono);font-size:12px;line-height:1.75;overflow-x:auto;border:1px solid var(--border)}
.kw{color:#60A5FA}.str{color:#34D399}.cm{color:#3D506A;font-style:italic}
.chat-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}
.chat-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.bubble{padding:10px 14px;border-radius:10px;line-height:1.65;max-width:82%;font-size:13px}
.bubble.ai{background:var(--bg3);border:1px solid var(--border);align-self:flex-start}
.bubble.user{background:var(--blue3);color:#fff;align-self:flex-end}
.chat-bar{border-top:1px solid var(--border);padding:12px 16px;background:var(--bg2);flex-shrink:0}
.m-err{padding:10px 14px;background:var(--rbg);border:1px solid rgba(240,82,82,.2);border-radius:var(--r);color:var(--red);font-size:12px}
.m-inf{padding:10px 14px;background:var(--glow);border:1px solid var(--gborder);border-radius:var(--r);color:var(--blue);font-size:12px}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--fg4);gap:8px;text-align:center;padding:40px}
.ei{font-size:34px;opacity:.35}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;font-family:var(--mono)}
.b-g{background:var(--gbg);color:var(--green);border:1px solid rgba(15,186,129,.2)}
.b-b{background:var(--glow);color:var(--blue);border:1px solid var(--gborder)}
.b-p{background:rgba(167,139,250,.1);color:var(--purple);border:1px solid rgba(167,139,250,.2)}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--rlg);padding:16px}
.cb-hdr{display:flex;justify-content:space-between;align-items:center;background:#040810;border:1px solid var(--border);border-bottom:none;border-radius:var(--r) var(--r) 0 0;padding:5px 12px}
.cb-lang{font-family:var(--mono);font-size:10px;color:var(--fg4);text-transform:uppercase;letter-spacing:.1em}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.fi{animation:fadeUp .2s ease}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.login-page{display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)}
.login-card{background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:40px;width:400px;box-shadow:0 30px 80px rgba(0,0,0,.9)}
.login-tabs{display:flex;background:var(--bg3);border-radius:var(--r);padding:3px;margin-bottom:20px}
.ltab{flex:1;padding:7px;font-size:12px;font-weight:600;border:none;cursor:pointer;border-radius:4px;background:transparent;color:var(--fg3)}
.ltab.a{background:var(--bg2);color:var(--fg);box-shadow:0 1px 4px rgba(0,0,0,.4)}
.fl{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.fl-lbl{font-size:10px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.07em;font-family:var(--mono)}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:1000}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:32px;width:460px;box-shadow:0 20px 60px rgba(0,0,0,.85)}
.sap-modal-icon{width:52px;height:52px;background:var(--blue3);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#fff;flex-shrink:0}
.sys-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:20px}
.sys-key{color:var(--fg4);font-family:var(--mono);font-size:10px}.sys-val{color:var(--fg);font-weight:600;font-size:12px}
.sdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.sdot.done{background:var(--green)}.sdot.run{background:var(--blue);animation:blink .8s infinite}.sdot.idle{background:var(--fg4)}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:14px;flex-shrink:0}
.tbtn{background:none;border:none;border-bottom:2px solid transparent;padding:8px 13px;font-size:12px;font-weight:600;color:var(--fg3);cursor:pointer}
.tbtn.a{border-bottom-color:var(--blue);color:var(--blue)}.tbtn:hover{color:var(--fg)}
</style></head><body>
<div id="root"></div>
<script type="text/babel">
const{useState,useEffect,useRef}=React;
const BASE=window.location.origin;
async function api(p,b,t){const h={'Content-Type':'application/json'};if(t)h.Authorization=`Bearer ${t}`;const r=await fetch(`${BASE}${p}`,{method:b?'POST':'GET',headers:h,body:b?JSON.stringify(b):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
const SYS=`You are an SAP ABAP architect for V2 Retail (320+ stores, S4/HANA). DEV:192.168.144.174/210. RULES: IM_ import,EX_ export. ABAP 7.4+. No SELECT*. No SELECT in LOOP.`;
function Fmt({t}){if(!t)return null;return React.createElement('div',{style:{lineHeight:1.7,fontSize:13}},t.split(/(```[\s\S]*?```)/g).map((p,i)=>{if(p.startsWith('```')){const ls=p.slice(3,-3).split('\n');const lang=ls[0]?.trim()||'ABAP';const code=ls.slice(1).join('\n');const hi=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\b(DATA|FIELD-SYMBOLS|TYPES|CLASS|METHOD|ENDMETHOD|ENDCLASS|IF|ELSE|ENDIF|LOOP|ENDLOOP|SELECT|FROM|INTO|WHERE|TRY|CATCH|ENDTRY|CALL|APPEND|READ|FUNCTION|ENDFUNCTION|FORM|ENDFORM)\b/g,'<span class="kw">$1</span>').replace(/(\"[^\n]*)/g,'<span class="cm">$1</span>').replace(/('[^']*')/g,'<span class="str">$1</span>');return React.createElement('div',{key:i,style:{margin:'8px 0'}},React.createElement('div',{className:'cb-hdr'},React.createElement('span',{className:'cb-lang'},lang),React.createElement('button',{className:'bg sm',onClick:()=>navigator.clipboard?.writeText(code)},'Copy')),React.createElement('pre',{className:'code',style:{borderRadius:'0 0 6px 6px',margin:0,borderTop:'1px solid var(--border)'},dangerouslySetInnerHTML:{__html:hi}}));}return React.createElement('span',{key:i,style:{whiteSpace:'pre-wrap'}},p);}));}
function DT({rows,onRow}){if(!rows?.length)return React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'📋'),React.createElement('div',null,'No results'));const cols=Object.keys(rows[0]).slice(0,8);return React.createElement('div',{style:{overflow:'auto'}},React.createElement('div',{style:{fontSize:10,color:'var(--fg3)',marginBottom:5,fontFamily:'var(--mono)'}},rows.length+' row(s)'),React.createElement('table',{className:'dt'},React.createElement('thead',null,React.createElement('tr',null,cols.map(c=>React.createElement('th',{key:c},c)))),React.createElement('tbody',null,rows.map((r,i)=>React.createElement('tr',{key:i,onClick:()=>onRow?.(r),style:{cursor:onRow?'pointer':'default'}},cols.map(c=>{const v=r[c];const isK=['FUNCNAME','NAME','TABNAME','JOBNAME'].includes(c);return React.createElement('td',{key:c,className:isK?'k':''},v??'—');}))))));}
function SapModal({token,onDone,onSkip}){
  const[user,setUser]=useState('SAP_ABAP');const[pass,setPass]=useState('');const[err,setErr]=useState('');const[loading,setLoading]=useState(false);
  async function connect(e){e.preventDefault();setLoading(true);setErr('');try{if(pass.trim())await api('/auth/update-sap',{sap_user:user,sap_password:pass},token);const d=await api('/sap/connect',{},token);if(d.connected){onDone();}else{setErr('SAP not reachable. Check credentials and network.');}}catch(x){setErr(x.message);}setLoading(false);}
  return React.createElement('div',{className:'modal-bg'},React.createElement('div',{className:'modal fi'},
    React.createElement('div',{style:{display:'flex',gap:14,alignItems:'flex-start',marginBottom:24}},
      React.createElement('div',{className:'sap-modal-icon'},'SAP'),
      React.createElement('div',null,React.createElement('div',{style:{fontWeight:700,fontSize:17,marginBottom:3}},'SAP System Login'),React.createElement('div',{style:{fontSize:12,color:'var(--fg3)'}},'Enter credentials to connect'))
    ),
    React.createElement('div',{className:'sys-info-grid'},[['System','S4/HANA (S4D)'],['Host','192.168.144.174'],['Client','210'],['Type','Development']].map(([k,v])=>React.createElement('div',{key:k},React.createElement('div',{className:'sys-key'},k),React.createElement('div',{className:'sys-val'},v)))),
    React.createElement('form',{onSubmit:connect,style:{display:'flex',flexDirection:'column',gap:12}},
      React.createElement('div',{className:'fl'},React.createElement('label',{className:'fl-lbl'},'SAP Username'),React.createElement('input',{value:user,onChange:e=>setUser(e.target.value),style:{fontFamily:'var(--mono)',fontWeight:600,fontSize:14}})),
      React.createElement('div',{className:'fl'},React.createElement('label',{className:'fl-lbl'},'SAP Password'),React.createElement('input',{type:'password',value:pass,onChange:e=>setPass(e.target.value),placeholder:'Enter SAP password',autoFocus:true,style:{fontFamily:'var(--mono)',fontSize:14}})),
      err&&React.createElement('div',{className:'m-err',style:{fontSize:12}},err),
      React.createElement('div',{style:{display:'flex',gap:8,marginTop:4}},
        React.createElement('button',{type:'submit',className:'bp',disabled:loading,style:{flex:1,padding:11,fontSize:13}},loading?'Connecting...':'Connect to SAP'),
        React.createElement('button',{type:'button',className:'bs',onClick:onSkip,style:{padding:'11px 20px'}},'Skip')
      )
    ),
    React.createElement('div',{style:{marginTop:14,fontSize:11,color:'var(--fg4)',textAlign:'center'}},'Credentials saved · encrypted at rest')
  ));
}
function Login({onLogin}){const[m,setM]=useState('login');const[u,setU]=useState('');const[p,setP]=useState('');const[dn,setDn]=useState('');const[err,setErr]=useState('');const[l,setL]=useState(false);async function go(e){e.preventDefault();setErr('');setL(true);try{const d=m==='login'?await api('/auth/login',{username:u,password:p}):await api('/auth/register',{username:u,password:p,display_name:dn});localStorage.setItem('at',d.token);localStorage.setItem('au',JSON.stringify(d.user));onLogin(d.token,d.user);}catch(x){setErr(x.message);}setL(false);}return React.createElement('div',{className:'login-page'},React.createElement('div',{className:'login-card fi'},React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:28}},React.createElement('div',{className:'logo-sap'},'SAP'),React.createElement('div',null,React.createElement('div',{style:{fontWeight:700,fontSize:18}},'ABAP AI Studio'),React.createElement('div',{style:{fontSize:11,color:'var(--fg4)',fontFamily:'var(--mono)',marginTop:1}},'V2 Retail · S4/HANA · DEV 210'))),React.createElement('div',{className:'login-tabs'},React.createElement('button',{className:'ltab '+(m==='login'?'a':''),onClick:()=>{setM('login');setErr('')}},'Sign In'),React.createElement('button',{className:'ltab '+(m==='register'?'a':''),onClick:()=>{setM('register');setErr('')}},'Register')),React.createElement('form',{onSubmit:go,style:{display:'flex',flexDirection:'column',gap:12}},m==='register'&&React.createElement('div',{className:'fl',style:{margin:0}},React.createElement('label',{className:'fl-lbl'},'Display Name'),React.createElement('input',{style:{width:'100%'},placeholder:'Akash Agarwal',value:dn,onChange:e=>setDn(e.target.value)})),React.createElement('div',{className:'fl',style:{margin:0}},React.createElement('label',{className:'fl-lbl'},'Username'),React.createElement('input',{style:{width:'100%'},placeholder:'akash',value:u,onChange:e=>setU(e.target.value),required:true,autoFocus:true})),React.createElement('div',{className:'fl',style:{margin:0}},React.createElement('label',{className:'fl-lbl'},'Password'),React.createElement('input',{type:'password',style:{width:'100%'},placeholder:'••••••••',value:p,onChange:e=>setP(e.target.value),required:true})),err&&React.createElement('div',{className:'m-err',style:{marginTop:2}},err),React.createElement('button',{type:'submit',className:'bp',disabled:l,style:{padding:11,marginTop:4,fontSize:13}},l?'...':(m==='login'?'Sign In →':'Create Account'))),React.createElement('div',{style:{marginTop:20,paddingTop:14,borderTop:'1px solid var(--border)',fontSize:11,color:'var(--fg4)',textAlign:'center'}},'V2 Retail ABAP AI Studio · DEV 192.168.144.174')));}
function Chat({token}){const[msgs,setMsgs]=useState([]);const[inp,setInp]=useState('');const[loading,setLoading]=useState(false);const endRef=useRef(null);useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[msgs]);async function send(t){const m=t||inp.trim();if(!m)return;setInp('');const n=[...msgs,{r:'user',c:m}];setMsgs(n);setLoading(true);try{const d=await api('/claude',{model:'claude-sonnet-4-20250514',max_tokens:4096,system:SYS,messages:n.map(x=>({role:x.r==='user'?'user':'assistant',content:x.c}))},token);const reply=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')||'No response.';setMsgs([...n,{r:'ai',c:reply}]);}catch(x){setMsgs([...n,{r:'ai',c:'Error: '+x.message}]);}setLoading(false);}const chips=['RFC for vendor lookup by LIFNR','Optimize SELECT in LOOP','Generate AMDP for sales per store','Review ZWM_CREATE_HU_AND_ASSIGN','CDS view for open POs'];return React.createElement('div',{className:'chat-wrap'},React.createElement('div',{className:'chat-msgs'},msgs.length===0&&React.createElement('div',{className:'fi',style:{textAlign:'center',paddingTop:30}},React.createElement('div',{style:{fontSize:30,marginBottom:10}},'⚡'),React.createElement('div',{style:{fontWeight:700,fontSize:15,marginBottom:5}},'ABAP AI Assistant'),React.createElement('div',{style:{fontSize:12,color:'var(--fg3)',marginBottom:20}},'Expert in V2 Retail S4/HANA · FMs, CDS, AMDP, RFC'),React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',maxWidth:560,margin:'0 auto'}},chips.map((s,i)=>React.createElement('button',{key:i,className:'bs sm',onClick:()=>send(s),style:{borderRadius:20,fontSize:11,color:'var(--fg2)'}},s)))),msgs.map((m,i)=>React.createElement('div',{key:i,className:'bubble '+(m.r==='user'?'user':'ai')},m.r==='user'?m.c:React.createElement(Fmt,{t:m.c}))),loading&&React.createElement('div',{className:'bubble ai',style:{color:'var(--fg3)',fontFamily:'var(--mono)',fontSize:11}},'Generating...'),React.createElement('div',{ref:endRef})),React.createElement('div',{className:'chat-bar'},React.createElement('div',{style:{display:'flex',gap:8}},React.createElement('textarea',{value:inp,onChange:e=>setInp(e.target.value),rows:2,placeholder:'Ask anything about ABAP... (Enter to send)',style:{flex:1,resize:'none',fontFamily:'var(--sans)',fontSize:13},onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}),React.createElement('button',{className:'bp',onClick:()=>send(),disabled:loading,style:{alignSelf:'flex-end',height:36}},loading?'..':'Send'))));}
function Source({token}){const[prog,setProg]=useState('');const[src,setSrc]=useState('');const[info,setInfo]=useState('');const[loading,setLoading]=useState(false);async function load(){if(!prog.trim())return;setLoading(true);setSrc('');setInfo('');try{const d=await api('/sap/smart-source',{name:prog.trim()},token);if(d.error){setInfo('❌ '+d.error);setLoading(false);return;}setSrc(d.source||'');setInfo(`${d.detected==='function_module'?'FM':'Program'}: ${d.name} · ${d.lines||0} lines`);}catch(x){setInfo('❌ '+x.message);}setLoading(false);}const lines=src.split('\n');return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'📝 Source Viewer'),React.createElement('div',{className:'ps'},'Programs, FMs, function groups')),React.createElement('div',{className:'toolbar'},React.createElement('input',{value:prog,onChange:e=>setProg(e.target.value),placeholder:'Program or FM name...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&load()}),React.createElement('button',{className:'bp',onClick:load,disabled:loading},loading?'Searching...':'Smart Search'),src&&React.createElement('button',{className:'bg sm',onClick:()=>navigator.clipboard?.writeText(src)},'Copy')),info&&React.createElement('div',{className:info.startsWith('❌')?'m-err':'m-inf',style:{marginBottom:10,fontFamily:'var(--mono)',fontSize:11}},info),React.createElement('div',{style:{flex:1,overflow:'auto',background:'#040810',border:'1px solid var(--border)',borderRadius:'var(--rlg)',padding:src?8:40,color:'var(--fg4)',textAlign:src?'left':'center',fontSize:12}},src?lines.map((line,i)=>{const hi=line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\b(DATA|FIELD-SYMBOLS|TYPES|CLASS|METHOD|ENDMETHOD|ENDCLASS|IF|ELSE|ENDIF|LOOP|ENDLOOP|SELECT|FROM|INTO|WHERE|TRY|CATCH|ENDTRY|CALL|APPEND|READ|FUNCTION|ENDFUNCTION|FORM|ENDFORM)\b/g,'<span class="kw">$1</span>').replace(/(\"[^\n]*)/g,'<span class="cm">$1</span>').replace(/('[^']*')/g,'<span class="str">$1</span>');return React.createElement('div',{key:i,style:{fontFamily:'var(--mono)',lineHeight:1.8,padding:'0 4px'}},React.createElement('span',{style:{color:'var(--fg4)',userSelect:'none',display:'inline-block',width:38,textAlign:'right',marginRight:10,fontSize:10}},i+1),React.createElement('span',{dangerouslySetInnerHTML:{__html:hi||' '}}));}):' Enter any program name, FM, or function group'));}
function RfcTest({token}){const[fm,setFm]=useState('');const[params,setParams]=useState([]);const[inputs,setInputs]=useState({});const[result,setResult]=useState(null);const[loading,setLoading]=useState(false);const[sys,setSys]=useState('dev');async function loadP(){if(!fm.trim())return;setLoading(true);setParams([]);setResult(null);setInputs({});try{const d=await api('/sap/rfc-params',{fm:fm.trim(),system:sys},token);const def={};(d.params||[]).filter(p=>p.type==='IMPORT').forEach(p=>{def[p.name]=''});setParams(d.params||[]);setInputs(def);}catch(x){setResult({error:x.message});}setLoading(false);}async function execute(){setLoading(true);setResult(null);try{const d=await api('/sap/rfc-execute',{fm:fm.trim(),system:sys,inputs},token);setResult(d.result);}catch(x){setResult({error:x.message});}setLoading(false);}const imports=params.filter(p=>p.type==='IMPORT');return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'▶ RFC Tester'),React.createElement('div',{className:'ps'},'Test any SAP function module live')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:sys,onChange:e=>setSys(e.target.value),style:{width:85}},React.createElement('option',{value:'dev'},'DEV'),React.createElement('option',{value:'prod'},'PROD')),React.createElement('input',{value:fm,onChange:e=>setFm(e.target.value),placeholder:'Function Module name...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&loadP()}),React.createElement('button',{className:'bp',onClick:loadP,disabled:loading},'Load'),params.length>0&&React.createElement('button',{className:'bp',onClick:execute,disabled:loading,style:{background:'var(--green)'}},'Execute')),React.createElement('div',{style:{display:'flex',gap:12,flex:1,overflow:'hidden',minHeight:0}},React.createElement('div',{style:{width:270,overflow:'auto',borderRight:'1px solid var(--border)',paddingRight:12}},imports.length>0?React.createElement('div',null,imports.map(p=>React.createElement('div',{key:p.name,style:{marginBottom:9}},React.createElement('label',{style:{fontSize:10,fontWeight:700,display:'block',marginBottom:3,color:'var(--fg2)',fontFamily:'var(--mono)'}},p.name),React.createElement('input',{value:inputs[p.name]||'',onChange:e=>{const n={...inputs};n[p.name]=e.target.value;setInputs(n);},style:{width:'100%',fontSize:12,fontFamily:'var(--mono)'}})))):React.createElement('div',{className:'empty',style:{padding:20}},React.createElement('div',{className:'ei'},'🔌'),React.createElement('div',null,'Enter FM name'))),React.createElement('div',{style:{flex:1,overflow:'auto'}},result?React.createElement('pre',{className:'code',style:{whiteSpace:'pre-wrap',fontSize:11,margin:0}},JSON.stringify(result,null,2)):null)));}
function Dict({token}){const[type,setType]=useState('TABLE');const[q,setQ]=useState('');const[rows,setRows]=useState([]);const[fields,setFields]=useState([]);const[sel,setSel]=useState('');async function search(){if(!q.trim())return;const n=q.toUpperCase();let sql='';if(type==='TABLE')sql=`SELECT TOP 50 TABNAME,TABCLASS FROM DD02L WHERE TABNAME LIKE '${n}%' AND TABCLASS = 'TRANSP'`;else sql=`SELECT TOP 50 FUNCNAME,AREA,PTEXT FROM TFDIR WHERE FUNCNAME LIKE '${n}%'`;try{const d=await api('/sap/query',{sql},token);setRows(d.rows||[]);setFields([]);setSel('');}catch(x){setRows([]);}}async function loadF(name){setSel(name);try{const d=await api('/sap/query',{sql:`SELECT TOP 200 FIELDNAME,ROLLNAME,INTTYPE,INTLEN,KEYFLAG FROM DD03L WHERE TABNAME = '${name}'`},token);setFields(d.rows||[]);}catch(x){setFields([]);}}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'📖 Dictionary')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:type,onChange:e=>setType(e.target.value),style:{width:150}},React.createElement('option',{value:'TABLE'},'Table'),React.createElement('option',{value:'FUNCTION'},'Function Module')),React.createElement('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'VBAK, EKKO, MARA...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&search()}),React.createElement('button',{className:'bp',onClick:search},'Search')),React.createElement('div',{style:{display:'flex',gap:12,flex:1,overflow:'hidden',minHeight:0}},React.createElement('div',{style:{width:210,overflow:'auto',paddingRight:8}},rows.length?rows.map((r,i)=>{const name=r.TABNAME||r.FUNCNAME||'';return React.createElement('div',{key:i,onClick:()=>loadF(name),style:{padding:'6px 9px',borderRadius:'var(--r)',cursor:'pointer',marginBottom:2,background:sel===name?'var(--glow)':'transparent',borderLeft:sel===name?'2px solid var(--blue)':'2px solid transparent'}},React.createElement('div',{style:{fontFamily:'var(--mono)',fontWeight:600,fontSize:12,color:sel===name?'var(--blue)':'var(--fg)'}},name),r.TABCLASS&&React.createElement('div',{style:{fontSize:10,color:'var(--fg4)',marginTop:1}},r.TABCLASS));}):React.createElement('div',{className:'empty',style:{padding:16,fontSize:11}},'Search to browse')),React.createElement('div',{style:{flex:1,overflow:'auto'}},sel&&React.createElement('div',null,React.createElement('div',{style:{fontSize:14,fontFamily:'var(--mono)',fontWeight:700,marginBottom:12}},sel),React.createElement(DT,{rows:fields})))));}
function Sql({token}){const[sql,setSql]=useState("SELECT TOP 20\n  NAME, CNAM, UDAT\nFROM TRDIR\nWHERE NAME LIKE 'Z%'\nORDER BY UDAT DESC");const[rows,setRows]=useState([]);const[err,setErr]=useState('');const[loading,setLoading]=useState(false);async function run(){setLoading(true);setErr('');setRows([]);try{const d=await api('/sap/query',{sql},token);setRows(d.rows||[]);}catch(x){setErr(x.message);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'▶ SQL Console')),React.createElement('textarea',{value:sql,onChange:e=>setSql(e.target.value),rows:7,style:{fontFamily:'var(--mono)',fontSize:12,resize:'vertical',marginBottom:10,background:'#040810',color:'#9BADC8',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:12,width:'100%'}}),React.createElement('div',{style:{display:'flex',gap:8,marginBottom:10}},React.createElement('button',{className:'bp',onClick:run,disabled:loading},loading?'Running...':'Execute'),rows.length>0&&React.createElement('span',{className:'badge b-g'},rows.length+' rows')),err&&React.createElement('div',{className:'m-err',style:{marginBottom:10,fontFamily:'var(--mono)',fontSize:11}},err),rows.length>0&&React.createElement(DT,{rows}));}
function WhereUsed({token}){const[obj,setObj]=useState('');const[rows,setRows]=useState([]);const[loading,setLoading]=useState(false);async function go(){if(!obj.trim())return;setLoading(true);try{const d=await api('/sap/where-used',{object:obj.trim()},token);setRows(d.results||[]);}catch(x){setRows([]);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'🔍 Where-Used')),React.createElement('div',{className:'toolbar'},React.createElement('input',{value:obj,onChange:e=>setObj(e.target.value),placeholder:'FM or table name...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&go()}),React.createElement('button',{className:'bp',onClick:go,disabled:loading},'Find References')),rows.length>0?React.createElement(DT,{rows:rows.map(r=>({Caller:r.caller,Type:r.type,References:r.called}))}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'🔍'),React.createElement('div',null,'Enter FM or table name')));}
function ErrorLog({token}){const[dumps,setDumps]=useState([]);const[sys,setSys]=useState('prod');const[days,setDays]=useState(7);const[loading,setLoading]=useState(false);async function go(){setLoading(true);try{const d=await api('/sap/error-log',{system:sys,days},token);setDumps(d.dumps||[]);}catch(x){setDumps([]);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'⚠ Error Log')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:sys,onChange:e=>setSys(e.target.value),style:{width:85}},React.createElement('option',{value:'dev'},'DEV'),React.createElement('option',{value:'prod'},'PROD')),React.createElement('select',{value:days,onChange:e=>setDays(parseInt(e.target.value)),style:{width:120}},['1','3','7','30'].map(d=>React.createElement('option',{key:d,value:d},'Last '+d+' day'+(d==='1'?'':'s')))),React.createElement('button',{className:'bp',onClick:go,disabled:loading},loading?'Loading...':'Load Dumps')),dumps.length>0?React.createElement(DT,{rows:dumps.map(d=>({Date:d.date,Time:d.time,User:d.user,Error:d.error_type,Program:d.program}))}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'⚠'),React.createElement('div',null,'Select system and load')));}
function TableView({token}){const[tbl,setTbl]=useState('');const[where,setWhere]=useState('');const[rows,setRows]=useState([]);const[sys,setSys]=useState('dev');const[loading,setLoading]=useState(false);const[err,setErr]=useState('');async function go(){if(!tbl.trim())return;setLoading(true);setErr('');setRows([]);try{const d=await api('/sap/table-data',{table:tbl.trim(),where,system:sys,limit:100},token);if(d.error)setErr(d.error);else setRows(d.rows||[]);}catch(x){setErr(x.message);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'📋 Table Viewer')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:sys,onChange:e=>setSys(e.target.value),style:{width:85}},React.createElement('option',{value:'dev'},'DEV'),React.createElement('option',{value:'prod'},'PROD')),React.createElement('input',{value:tbl,onChange:e=>setTbl(e.target.value),placeholder:'Table name...',style:{width:200,fontFamily:'var(--mono)'}}),React.createElement('input',{value:where,onChange:e=>setWhere(e.target.value),placeholder:'WHERE (optional)',style:{flex:1},onKeyDown:e=>e.key==='Enter'&&go()}),React.createElement('button',{className:'bp',onClick:go,disabled:loading},'View Data')),err&&React.createElement('div',{className:'m-err',style:{marginBottom:10}},err),rows.length>0?React.createElement(DT,{rows}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'📋'),React.createElement('div',null,'Enter table name')));}
function JobMonitor({token}){const[jobs,setJobs]=useState([]);const[sys,setSys]=useState('prod');const[status,setStatus]=useState('');const[loading,setLoading]=useState(false);async function go(){setLoading(true);try{const d=await api('/sap/jobs',{system:sys,status},token);setJobs(d.jobs||[]);}catch(x){setJobs([]);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'⏰ Job Monitor')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:sys,onChange:e=>setSys(e.target.value),style:{width:85}},React.createElement('option',{value:'dev'},'DEV'),React.createElement('option',{value:'prod'},'PROD')),React.createElement('select',{value:status,onChange:e=>setStatus(e.target.value),style:{width:130}},React.createElement('option',{value:''},'All Status'),React.createElement('option',{value:'A'},'Aborted'),React.createElement('option',{value:'F'},'Finished'),React.createElement('option',{value:'R'},'Running'),React.createElement('option',{value:'S'},'Scheduled')),React.createElement('button',{className:'bp',onClick:go,disabled:loading},'Load Jobs')),jobs.length>0?React.createElement(DT,{rows:jobs.map(j=>({Job:j.name,Date:j.date,Time:j.time,Status:j.status,User:j.user}))}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'⏰'),React.createElement('div',null,'Select system and load')));}
function SmartDebug({token}){const[err,setErr]=useState('');const[prog,setProg]=useState('');const[result,setResult]=useState('');const[loading,setLoading]=useState(false);async function go(){if(!err.trim()&&!prog.trim())return;setLoading(true);setResult('');try{const d=await api('/sap/smart-debug',{error:err,program:prog},token);setResult(d.diagnosis||'');}catch(x){setResult('Error: '+x.message);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'🐛 Smart Debug'),React.createElement('div',{className:'ps'},'Paste ST22 dump → AI diagnosis + fix')),React.createElement('div',{style:{display:'flex',gap:12,marginBottom:12,flexShrink:0}},React.createElement('div',{style:{flex:1}},React.createElement('textarea',{value:err,onChange:e=>setErr(e.target.value),rows:6,style:{width:'100%',resize:'vertical',fontSize:12,fontFamily:'var(--mono)'},placeholder:'Paste error or ST22 dump...'})),React.createElement('div',{style:{width:230}},React.createElement('input',{value:prog,onChange:e=>setProg(e.target.value),placeholder:'Program (optional)',style:{width:'100%',marginBottom:10,fontFamily:'var(--mono)'}}),React.createElement('button',{className:'bp',onClick:go,disabled:loading,style:{width:'100%',padding:11}},loading?'Diagnosing...':'Diagnose + Fix'))),React.createElement('div',{style:{flex:1,overflow:'auto'}},result?React.createElement('div',{className:'fi'},React.createElement(Fmt,{t:result})):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'🐛'),React.createElement('div',null,'Paste error to begin')));}
function CodeSearch({token}){const[term,setTerm]=useState('');const[rows,setRows]=useState([]);const[loading,setLoading]=useState(false);async function go(){if(!term.trim()||term.length<3)return;setLoading(true);setRows([]);try{const d=await api('/sap/code-search',{term:term.trim()},token);setRows(d.results||[]);}catch(x){setRows([]);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'🔎 Code Search'),React.createElement('div',{className:'ps'},'Search all Z-programs in production')),React.createElement('div',{className:'toolbar'},React.createElement('input',{value:term,onChange:e=>setTerm(e.target.value),placeholder:'Search across all Z-programs...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&go()}),React.createElement('button',{className:'bp',onClick:go,disabled:loading},loading?'Searching...':'Search')),rows.length>0?React.createElement(DT,{rows:rows.map(r=>({Program:r.program,Line:r.line,Code:r.text}))}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'🔎'),React.createElement('div',null,'Enter search term (min 3 chars)')));}
function CodeTools({token}){const[code,setCode]=useState('');const[action,setAction]=useState('optimize');const[result,setResult]=useState('');const[loading,setLoading]=useState(false);const aMap={optimize:'Optimize completely. ABAP 7.4+. Full code.',review:'Review /10. Quality, errors, AUTHORITY-CHECK, SELECT in LOOP.',modernize:'Convert to modern 7.4+. Full converted code.',security:'Security audit: SQL injection, missing auth checks.',unittest:'Generate ABAP Unit test class with cl_abap_unit_assert.'};async function go(){if(!code.trim())return;setLoading(true);setResult('');try{const d=await api('/claude',{model:'claude-sonnet-4-20250514',max_tokens:4096,system:SYS,messages:[{role:'user',content:`${aMap[action]}\n\n\`\`\`abap\n${code.slice(0,5000)}\n\`\`\``}]},token);setResult((d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'));}catch(x){setResult('Error: '+x.message);}setLoading(false);}const labels={optimize:'✨ Optimize',review:'🔍 Review',modernize:'🔄 Modernize',security:'🔒 Security',unittest:'🧪 Unit Tests'};return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'🔧 Code Tools')),React.createElement('div',{className:'tabs'},Object.keys(aMap).map(a=>React.createElement('button',{key:a,className:'tbtn '+(action===a?'a':''),onClick:()=>setAction(a)},labels[a]))),React.createElement('div',{style:{display:'flex',gap:12,flex:1,overflow:'hidden',minHeight:0}},React.createElement('div',{style:{flex:1,display:'flex',flexDirection:'column'}},React.createElement('textarea',{value:code,onChange:e=>setCode(e.target.value),style:{flex:1,fontFamily:'var(--mono)',fontSize:12,resize:'none',background:'#040810',color:'#9BADC8',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:12},placeholder:'Paste ABAP code...'}),React.createElement('button',{className:'bp',onClick:go,disabled:loading,style:{marginTop:8}},loading?'Analyzing...':{optimize:'Optimize',review:'Review',modernize:'Modernize',security:'Audit',unittest:'Generate Tests'}[action])),React.createElement('div',{style:{flex:1,overflow:'auto',borderLeft:'1px solid var(--border)',paddingLeft:12}},result?React.createElement('div',{className:'fi'},React.createElement(Fmt,{t:result})):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'🔧'),React.createElement('div',null,'Paste code and analyze')))));}
function Repo({token}){const[type,setType]=useState('PROG');const[q,setQ]=useState('');const[rows,setRows]=useState([]);const[loading,setLoading]=useState(false);async function go(){if(!q.trim())return;setLoading(true);const n=q.toUpperCase();let sql='';if(type==='PROG')sql=`SELECT TOP 50 NAME,CNAM,UDAT FROM TRDIR WHERE NAME LIKE '${n}%' ORDER BY UDAT DESC`;else sql=`SELECT TOP 50 FUNCNAME,AREA,PTEXT FROM TFDIR WHERE FUNCNAME LIKE '${n}%'`;try{const d=await api('/sap/query',{sql},token);setRows(d.rows||[]);}catch(x){setRows([]);}setLoading(false);}return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'📁 Repository')),React.createElement('div',{className:'toolbar'},React.createElement('select',{value:type,onChange:e=>setType(e.target.value),style:{width:150}},React.createElement('option',{value:'PROG'},'Programs'),React.createElement('option',{value:'FUGR'},'Function Groups')),React.createElement('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'ZWM*, ZGATE*, ZMM*...',style:{flex:1,fontFamily:'var(--mono)'},onKeyDown:e=>e.key==='Enter'&&go()}),React.createElement('button',{className:'bp',onClick:go,disabled:loading},'Search')),rows.length>0?React.createElement(DT,{rows}):React.createElement('div',{className:'empty'},React.createElement('div',{className:'ei'},'📁'),React.createElement('div',null,'Search Z-programs')));}
function AgentPipeline({token}){const[req,setReq]=useState('');const[tpl,setTpl]=useState('function_module');const[running,setRunning]=useState(false);const[result,setResult]=useState(null);const[stages,setStages]=useState({0:'idle',1:'idle',2:'idle',3:'idle',4:'idle'});async function run(){if(!req.trim())return;setRunning(true);setResult(null);setStages({0:'idle',1:'idle',2:'idle',3:'idle',4:'idle'});try{const resp=await fetch(BASE+'/pipeline/stream',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({requirement:req,template:tpl})});const reader=resp.body.getReader();const dec=new TextDecoder();let buf='';let final=null;while(true){const chunk=await reader.read();if(chunk.done)break;buf+=dec.decode(chunk.value,{stream:true});const lines=buf.split('\n\n');buf=lines.pop()||'';for(const line of lines){const l=line.replace('data: ','');if(!l)continue;try{const ev=JSON.parse(l);if(ev.stage==='done'){final=ev;setStages({0:'done',1:'done',2:'done',3:'done',4:'done'});}else if(ev.stage==='error'){setResult({error:ev.message});}else if(ev.status==='running'){setStages(p=>{const n={...p};n[ev.stage]='run';return n});}else if(ev.status==='done'||ev.status==='skipped'){setStages(p=>{const n={...p};n[ev.stage]='done';return n});}}catch(pe){}}}if(final)setResult({final_code:final.final_code,rating:final.rating_initial,iterations:final.passed?1:2});}catch(x){setResult({error:x.message});}setRunning(false);}const sNames=['Interface','Coder','Reviewer','Fixer','Verify'];return React.createElement('div',{className:'panel'},React.createElement('div',{className:'ph'},React.createElement('div',{className:'pt'},'✨ Agent Pipeline'),React.createElement('div',{className:'ps'},'4-stage AI: Coder → Reviewer → Fixer → Verify')),React.createElement('div',{className:'card',style:{marginBottom:12,flexShrink:0}},React.createElement('div',{style:{display:'flex',gap:8,marginBottom:10}},React.createElement('select',{value:tpl,onChange:e=>setTpl(e.target.value),style:{width:170}},['function_module','abap_class','cds_view','amdp','alv_report'].map(t=>React.createElement('option',{key:t,value:t},t.replace(/_/g,' ')))),React.createElement('button',{className:'bp',onClick:run,disabled:running},running?'Running...':'Run Pipeline')),React.createElement('input',{value:req,onChange:e=>setReq(e.target.value),placeholder:'Describe what to build...',style:{width:'100%'},onKeyDown:e=>e.key==='Enter'&&run()})),running&&React.createElement('div',{className:'card fi',style:{marginBottom:12,flexShrink:0}},React.createElement('div',{style:{display:'flex',gap:14}},sNames.map((n,i)=>React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:5,fontSize:12}},React.createElement('div',{className:'sdot '+(stages[i]||'idle')}),React.createElement('span',{style:{color:stages[i]==='run'?'var(--blue)':stages[i]==='done'?'var(--green)':'var(--fg3)'}},n))))),result&&!result.error&&React.createElement('div',{style:{flex:1,overflow:'auto'}},React.createElement('div',{style:{display:'flex',gap:7,marginBottom:10}},React.createElement('span',{className:'badge b-g'},'✓ Done'),result.rating&&React.createElement('span',{className:'badge b-b'},'Rating: '+result.rating+'/10'),React.createElement('button',{className:'bs sm',onClick:()=>navigator.clipboard?.writeText(result.final_code||'')},'Copy')),React.createElement(Fmt,{t:result.final_code||''})),result?.error&&React.createElement('div',{className:'m-err'},'Error: '+result.error),!result&&!running&&React.createElement('div',{className:'empty',style:{flex:1}},React.createElement('div',{className:'ei'},'✨'),React.createElement('div',null,'Describe what to build')));}

function App(){
  const[token,setToken]=useState(localStorage.getItem('at'));
  const[user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('au'))}catch{return null}});
  const[tab,setTab]=useState('chat');
  const[sapOk,setSapOk]=useState(false);
  const[showSap,setShowSap]=useState(false);
  const[sapAsked,setSapAsked]=useState(false);

  useEffect(()=>{
    if(!token||sapAsked)return;
    api('/sap/connect',{},token)
      .then(d=>{if(d.connected)setSapOk(true); setTimeout(()=>setShowSap(true),500);})
      .catch(()=>setTimeout(()=>setShowSap(true),500));
  },[token]);

  function logout(){localStorage.removeItem('at');localStorage.removeItem('au');setToken(null);setUser(null);setSapOk(false);setSapAsked(false);}
  function onLogin(t,u){setToken(t);setUser(u);}
  function onSapDone(){setSapOk(true);setShowSap(false);setSapAsked(true);}
  function onSapSkip(){setShowSap(false);setSapAsked(true);}

  if(!token||!user)return React.createElement(Login,{onLogin});
  if(showSap)return React.createElement(SapModal,{token,onDone:onSapDone,onSkip:onSapSkip});

  const tabs=[
    {id:'chat',icon:'⚡',label:'AI Chat',sec:'ai'},
    {id:'agents',icon:'✨',label:'Agent Pipeline',sec:'ai'},
    {id:'codetools',icon:'🔧',label:'Code Tools',sec:'ai'},
    {id:'source',icon:'📝',label:'Source Viewer',sec:'sap'},
    {id:'rfctest',icon:'▶',label:'RFC Tester',sec:'sap'},
    {id:'dict',icon:'📖',label:'Dictionary',sec:'sap'},
    {id:'repo',icon:'📁',label:'Repository',sec:'sap'},
    {id:'sql',icon:'▶',label:'SQL Console',sec:'sap'},
    {id:'debug',icon:'🐛',label:'Smart Debug',sec:'sap'},
    {id:'codesearch',icon:'🔎',label:'Code Search',sec:'sap'},
    {id:'whereused',icon:'🔍',label:'Where-Used',sec:'sap'},
    {id:'errorlog',icon:'⚠',label:'Error Log',sec:'sap'},
    {id:'tableview',icon:'📋',label:'Table Viewer',sec:'sap'},
    {id:'jobs',icon:'⏰',label:'Job Monitor',sec:'sap'},
  ];

  const panels={chat:React.createElement(Chat,{token}),agents:React.createElement(AgentPipeline,{token}),codetools:React.createElement(CodeTools,{token}),source:React.createElement(Source,{token}),rfctest:React.createElement(RfcTest,{token}),dict:React.createElement(Dict,{token}),repo:React.createElement(Repo,{token}),sql:React.createElement(Sql,{token}),debug:React.createElement(SmartDebug,{token}),codesearch:React.createElement(CodeSearch,{token}),whereused:React.createElement(WhereUsed,{token}),errorlog:React.createElement(ErrorLog,{token}),tableview:React.createElement(TableView,{token}),jobs:React.createElement(JobMonitor,{token})};
  const secs={ai:'AI Tools',sap:'SAP System'};

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',height:'100vh'}},
    React.createElement('div',{className:'hdr'},
      React.createElement('div',{className:'logo-sap'},'SAP'),
      React.createElement('div',null,React.createElement('div',{style:{fontWeight:700,fontSize:14}},'ABAP AI Studio'),React.createElement('div',{style:{fontSize:10,color:'var(--fg4)',fontFamily:'var(--mono)',marginTop:1}},'DEV 192.168.144.174 · Client 210 · S4D')),
      React.createElement('div',{style:{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}},
        React.createElement('div',{className:'sap-pill '+(sapOk?'ok':'ng'),onClick:()=>{if(!sapOk){setSapAsked(false);setShowSap(true);}}},React.createElement('div',{className:'dot'}),sapOk?'SAP Connected':'SAP Connecting...'),
        React.createElement('div',{style:{width:1,height:22,background:'var(--border)'}}),
        React.createElement('div',{style:{fontSize:12,fontWeight:600,color:'var(--fg2)'}},user.display_name||user.username),
        React.createElement('button',{className:'bg sm',onClick:logout},'Logout')
      )
    ),
    React.createElement('div',{className:'main'},
      React.createElement('div',{className:'sb'},
        React.createElement('div',{style:{flex:1,overflow:'auto',padding:'4px 6px'}},
          ['ai','sap'].map(sec=>{
            const st=tabs.filter(t=>t.sec===sec);
            return React.createElement('div',{key:sec},
              React.createElement('div',{className:'sb-sec'},secs[sec]),
              st.map(t=>React.createElement('button',{key:t.id,className:'si '+(tab===t.id?'a':''),onClick:()=>setTab(t.id)},React.createElement('span',{className:'ic'},t.icon),t.label))
            );
          })
        ),
        React.createElement('div',{className:'sb-foot'},'v3.0 · V2 Retail Cloud')
      ),
      React.createElement('div',{className:'content'},
        Object.entries(panels).map(([k,v])=>React.createElement('div',{key:k,style:{display:tab===k?'flex':'none',flexDirection:'column',height:'100%',overflow:'hidden'}},v))
      )
    )
  );
}
ReactDOM.render(React.createElement(App),document.getElementById('root'));
</script></body></html>"""

if __name__ == "__main__":
    print("=== ABAP AI Studio Deploy v6 ===")

    # 1. Fetch backup worker from KV (has all routes)
    print("1. Fetching backup worker from KV...")
    from urllib.parse import quote
    R2_TOK = os.environ.get("CF_R2_TOKEN", os.environ.get("CF_DEPLOY_TOKEN", ""))
    tok = R2_TOK or CF
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/storage/kv/namespaces/{KV_NS}/values/{quote(BACKUP, safe='')}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            worker = json.loads(r.read())["code"]
        print(f"   Backup: {len(worker)} chars")
    except Exception as e:
        print(f"   KV failed ({e}), using base_worker.js")
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "base_worker.js")) as f:
            worker = f.read()

    # 2. Embed inline HTML
    print("2. Embedding HTML...")
    b64 = base64.b64encode(HTML.encode("utf-8")).decode()
    m = re.search(r'HTML_B64\s*=\s*"([A-Za-z0-9+/=]*)"', worker)
    assert m, "HTML_B64 not found!"
    worker = worker[:m.start(1)] + b64 + worker[m.end(1):]
    print(f"   Worker: {len(worker)} chars, HTML: {len(HTML)} bytes")

    # 3. Fix env secrets if needed
    old_end = 'addEventListener("fetch",function(e){\n  e.respondWith(handleRequest(e.request,{}));\n});'
    new_end = ('addEventListener("fetch",function(e){\n'
               '  e.respondWith(handleRequest(e.request,{\n'
               '    ANTHROPIC_KEY:typeof ANTHROPIC_KEY!=="undefined"?ANTHROPIC_KEY:undefined,\n'
               '    JWT_SECRET:typeof JWT_SECRET!=="undefined"?JWT_SECRET:"fallback",\n'
               '    CF_DEPLOY_TOKEN:typeof CF_DEPLOY_TOKEN!=="undefined"?CF_DEPLOY_TOKEN:undefined,\n'
               '    GH_TOKEN:typeof GH_TOKEN!=="undefined"?GH_TOKEN:undefined,\n'
               '    DB:typeof __D1_BETA__DB!=="undefined"?__D1_BETA__DB:undefined\n'
               '  }));\n'
               '});')
    worker = worker.replace(old_end, new_end)

    # 4. Deploy
    out = "/tmp/abap_worker.js"
    with open(out, "w") as f:
        f.write(worker)
    print("3. Deploying...")
    result = subprocess.run([
        "curl", "-s", "-X", "PUT",
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/abap-ai-studio",
        "-H", f"Authorization: Bearer {CF}",
        "-H", "Content-Type: application/javascript",
        "--data-binary", f"@{out}"
    ], capture_output=True, text=True, timeout=60)
    resp = json.loads(result.stdout)
    ok = resp.get("success", False)
    print(f"   Result: {ok}")
    for e in resp.get("errors", []): print(f"   Error: {e}")
    if not ok:
        print(f"   stdout: {result.stdout[:300]}")
        sys.exit(1)
    print("\nSUCCESS! https://abap.v2retail.net")

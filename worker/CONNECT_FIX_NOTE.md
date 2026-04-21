      // SAP connectivity check — used by App header to show green badge
      if(path==='/sap/connect'&&request.method==='POST'){
        try{
          // Use /query with a simple SELECT since /health endpoint does not exist
          const r=await fetch('https://sap-api.v2retail.net/api/abapstudio/query',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':'abap-studio-sap-2026'},body:JSON.stringify({sql:"SELECT TOP 1 MANDT FROM T000"})});
          const d=await r.json();
          return json({connected:!!(d.rows||Array.isArray(d.rows)),system:'S4D'});
        }catch(e){return json({connected:false,error:e.message});}
      }

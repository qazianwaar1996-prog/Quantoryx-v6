/* ══════════════════════════════════════════════
   QUANTORYX v6 — LOGGING & ERROR REPORTING

   One channel for all diagnostics. In production only warn/error
   are emitted; debug/info are suppressed. Every error is also
   pushed to a bounded in-memory ring buffer so the UI can show
   recent failures, and forwarded to `onReport` for a real sink
   (Sentry, Datadog, a backend /logs route…).
══════════════════════════════════════════════ */

const LOG_LEVELS={debug:10,info:20,warn:30,error:40,silent:99};
const IS_PROD=(window.QX_ENV||'development')==='production';
const MIN_LEVEL=LOG_LEVELS[window.QX_LOG_LEVEL||(IS_PROD?'warn':'debug')]??LOG_LEVELS.debug;

const log=(()=>{
  const buffer=[];              // bounded ring of recent events
  const MAX=50;
  let reporter=null;            // external sink

  const emit=(level,scope,msg,extra)=>{
    if(LOG_LEVELS[level]<MIN_LEVEL) return;
    const entry={level,scope,msg:String(msg),extra,t:Date.now()};
    if(level==='warn'||level==='error'){
      buffer.push(entry);
      if(buffer.length>MAX) buffer.shift();
      try{ reporter?.(entry); }catch{}
    }
    const tag=`%c[qx:${scope}]`;
    const style=level==='error'?'color:#f87171;font-weight:600'
              :level==='warn' ?'color:#fbbf24;font-weight:600'
              :'color:#a78bfa';
    const fn=console[level]||console.log;
    extra!==undefined?fn(tag,style,msg,extra):fn(tag,style,msg);
  };

  return{
    debug:(s,m,e)=>emit('debug',s,m,e),
    info: (s,m,e)=>emit('info', s,m,e),
    warn: (s,m,e)=>emit('warn', s,m,e),
    error:(s,m,e)=>emit('error',s,m,e),
    /* Attach a real sink: log.setReporter(e=>fetch('/api/logs',…)) */
    setReporter(fn){ reporter=fn; },
    recent(){ return [...buffer]; },
    clear(){ buffer.length=0; },
  };
})();

/* Catch anything that escapes React's tree (async callbacks, WS handlers). */
window.addEventListener('error',e=>{
  log.error('window',e.message,{src:e.filename,line:e.lineno});
});
window.addEventListener('unhandledrejection',e=>{
  const r=e.reason;
  log.error('promise',r?.message||String(r),{status:r?.status});
});

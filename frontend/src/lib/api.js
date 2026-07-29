/* ══════════════════════════════════════════════
   QUANTORYX v6 — API SERVICE LAYER (LIVE)

   Single seam between the UI and the FastAPI backend
   (github.com/qazianwaar1996-prog/Quantoryx).

   • All routers mount under /api  (backend/main.py:161-170)
   • JWT bearer auth, access + refresh token rotation
   • snake_case ⇄ camelCase adapters live here so no page
     component ever sees a backend field name
   • Endpoints the backend does not implement yet fall back to
     local fixtures, flagged with `degraded:true`, so the UI stays
     functional instead of showing a dead page.
══════════════════════════════════════════════ */

const API_BASE = (window.QX_API_BASE ?? 'https://quantoryx-backend-production.up.railway.app/api');
const WS_BASE  = (window.QX_WS_BASE  ?? 'wss://quantoryx-backend-production.up.railway.app');
const LATENCY  = [140, 380];            // fixture-only simulated latency

/* ── Token store (survives reload) ───────────────────── */
const TokenStore={
  get access(){ try{ return localStorage.getItem('qx.access')||null; }catch{ return null; } },
  get refresh(){ try{ return localStorage.getItem('qx.refresh')||null; }catch{ return null; } },
  set({access,refresh}){
    try{
      if(access)  localStorage.setItem('qx.access',access);
      if(refresh) localStorage.setItem('qx.refresh',refresh);
    }catch{}
  },
  clear(){ try{ localStorage.removeItem('qx.access'); localStorage.removeItem('qx.refresh'); }catch{} },
};

/* Decode a JWT payload without verifying (verification is the server's job).
   Used only to pre-empt expiry and to read the role claim for UI gating. */
const decodeJwt=t=>{
  try{
    const p=t.split('.')[1];
    return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
  }catch{ return null; }
};
const jwtExpired=(t,skewMs=15000)=>{
  const c=decodeJwt(t);
  if(!c||!c.exp) return false;              // opaque token: let the server decide
  return Date.now()+skewMs >= c.exp*1000;
};

class ApiError extends Error{
  constructor(status,msg,body){
    super(msg||`Request failed (${status})`);
    this.status=status; this.name='ApiError'; this.body=body;
  }
}
/* Raised when the backend route genuinely does not exist yet */
class NotImplementedError extends ApiError{
  constructor(path){ super(501,`Not implemented on backend: ${path}`); this.name='NotImplementedError'; }
}

const _delay=()=>new Promise(r=>setTimeout(r,LATENCY[0]+Math.random()*(LATENCY[1]-LATENCY[0])));

/* ── Auth event bus: lets AppShell react to forced logout ── */
const AuthEvents=(()=>{
  let subs=[];
  return{ subscribe(fn){ subs.push(fn); return()=>{subs=subs.filter(s=>s!==fn);}; },
          emit(e){ subs.forEach(s=>s(e)); } };
})();

/* ── Tiny GET cache (dedupes in-flight + short TTL) ── */
const _cache=new Map();
const _inflight=new Map();
const cacheKey=(p,o)=>`${o?.method||'GET'} ${p}`;
const invalidate=pref=>{ [..._cache.keys()].forEach(k=>{ if(k.includes(pref)) _cache.delete(k); }); };

/* ── Core transport with refresh-once-on-401 + retry ── */
let _refreshing=null;

async function _raw(path,opts={}){
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),opts.timeout??45000);
  try{
    const res=await fetch(`${API_BASE}${path}`,{
      method:opts.method||'GET',
      headers:{
        ...(opts.body?{'Content-Type':'application/json'}:{}),
        ...(TokenStore.access?{Authorization:`Bearer ${TokenStore.access}`}:{}),
        ...(opts.headers||{}),
      },
      body:opts.body?JSON.stringify(opts.body):undefined,
      signal:ctrl.signal,
    });
    const text=await res.text();
    let data=null;
    try{ data=text?JSON.parse(text):null; }catch{ data=text; }
    if(!res.ok){
      const detail=(data&&typeof data==='object'&&data.detail)||res.statusText;
      if(res.status===404) throw new NotImplementedError(path);
      throw new ApiError(res.status,typeof detail==='string'?detail:JSON.stringify(detail),data);
    }
    return data;
  } finally { clearTimeout(timeout); }
}

async function _refreshTokens(){
  if(_refreshing) return _refreshing;
  const rt=TokenStore.refresh;
  if(!rt){ throw new ApiError(401,'Session expired'); }
  _refreshing=(async()=>{
    try{
      const t=await _raw('/auth/refresh',{method:'POST',body:{refresh_token:rt}});
      TokenStore.set({access:t.access_token,refresh:t.refresh_token});
      return t;
    } finally { _refreshing=null; }
  })();
  return _refreshing;
}

async function _http(path,opts={}){
  try{
    /* Pre-emptive refresh: avoids a guaranteed-401 round trip and the
       resulting UI flicker when the access token has already lapsed. */
    const at=TokenStore.access;
    if(at && jwtExpired(at) && TokenStore.refresh && !path.startsWith('/auth/refresh')){
      try{ await _refreshTokens(); }catch{}
    }
    return await _raw(path,opts);
  }catch(e){
    /* one transparent refresh attempt on expiry */
    if(e.status===401 && TokenStore.refresh && !opts._retried){
      try{
        await _refreshTokens();
        return await _raw(path,{...opts,_retried:true});
      }catch{
        TokenStore.clear();
        AuthEvents.emit({type:'logout',reason:'expired'});
        throw new ApiError(401,'Your session expired. Please sign in again.');
      }
    }
    if(e.status===401){ log.warn('auth','401 — clearing session',{path});
      TokenStore.clear(); AuthEvents.emit({type:'logout',reason:'unauthorised'}); }
    /* one retry for transient network/5xx on idempotent reads */
    if((e.name==='AbortError'||e.status>=500) && (opts.method||'GET')==='GET' && !opts._retried){
      await _delay();
      return _raw(path,{...opts,_retried:true});
    }
    throw e;
  }
}

/* Cached GET */
async function _get(path,{ttl=8000,force=false}={}){
  const k=cacheKey(path);
  const hit=_cache.get(k);
  if(!force && hit && Date.now()-hit.t<ttl) return hit.v;
  if(_inflight.has(k)) return _inflight.get(k);
  const p=_http(path).then(v=>{ _cache.set(k,{v,t:Date.now()}); _inflight.delete(k); return v; })
                     .catch(e=>{ _inflight.delete(k); throw e; });
  _inflight.set(k,p);
  return p;
}


/* ══════════════════════════════════════════════
   ADAPTERS — backend snake_case → UI camelCase
══════════════════════════════════════════════ */
const toMs=iso=>{ const t=Date.parse(iso); return Number.isNaN(t)?Date.now():t; };
/* Evenly sample an array down to `max` items, preserving both endpoints. */
const decimate=(arr,max=400)=>{
  if(!Array.isArray(arr)||arr.length<=max) return arr||[];
  const step=(arr.length-1)/(max-1);
  const out=[];
  for(let i=0;i<max;i++) out.push(arr[Math.round(i*step)]);
  out[out.length-1]=arr[arr.length-1];
  return out;
};
const pct=v=>typeof v==='number'?v:0;

const A={
  user:u=>u&&({
    id:u.id, username:u.username, email:u.email,
    name:u.full_name||u.username, role:u.role,
    plan:u.role==='admin'?'Quant':'Pro', active:u.is_active,
    createdAt:u.created_at,
  }),

  /* GET /api/dashboard */
  dashboard:d=>{
    const p=d.portfolio_summary||{};
    return {
      symbol:d.active_symbol, timeframe:d.active_timeframe,
      champion:d.champion_strategy, aiConfidence:pct(d.ai_confidence_score),
      regime:d.market_regime, aiStatus:d.ai_status,
      equity:p.ending_equity??0, totalReturn:pct(p.total_return_pct),
      maxDrawdown:pct(p.max_drawdown_pct), sharpe:p.sharpe_ratio??0,
      trades:p.total_trades??0, winRate:pct(p.win_rate), profitFactor:p.profit_factor??0,
      recentTrades:(d.recent_executed_trades||[]).map(A.trade),
    };
  },

  trade:t=>({
    id:t.id??uid(), pair:t.symbol||t.pair||'—',
    dir:(t.direction||t.side||'').toLowerCase()==='sell'?'Short':'Long',
    entry:t.entry_price??t.entry, exit:t.exit_price??t.exit,
    pnl:t.pnl??t.profit??0, date:t.timestamp||t.date,
  }),

  /* GET /api/strategies — backend returns catalogue, not user library */
  strategy:(s,i)=>({
    id:s.config_key||s.name||`s${i}`,
    name:(s.name||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
    key:s.config_key, type:'Built-in',
    params:s.default_parameters||{},
    paramList:Object.entries(s.default_parameters||{}).map(([k,v])=>`${k}: ${v}`),
  }),

  /* GET /api/portfolio */
  portfolio:p=>({
    starting:p.starting_balance??0, equity:p.ending_equity??0,
    totalReturn:pct(p.total_return_pct), maxDrawdown:pct(p.max_drawdown_pct),
    sharpe:p.sharpe_ratio??0, trades:p.total_trades??0,
    winRate:pct(p.win_rate), profitFactor:p.profit_factor??0,
    /* The engine emits one point per bar (~9k for a year of H1 data).
       Rendering that many SVG nodes stalls Recharts and produces an empty
       chart, so decimate to a fixed budget while always keeping the first
       and last points so the start/end equity stay exact. */
    curve:decimate((p.equity_curve||[]).map((e,i)=>({
      w:e.date||e.timestamp||`T${i+1}`,
      equity:e.equity??e.balance??e.value??0,
      dd:e.drawdown_pct??0,
    })),400),
  }),

  /* GET /api/market-regime */
  regime:r=>{
    const dist=r.percentage_distribution||{};
    const palette={Trending:'#10b981','High Volatility':'#ef4444',Ranging:'#6366f1',
      'Normal/Quiet':'#3b82f6','Low Volatility':'#a78bfa',Unknown:'#6b7280'};
    const rows=Object.entries(dist).map(([name,value])=>({name,value,color:palette[name]||'#8b5cf6'}))
      .sort((a,b)=>b.value-a.value);
    return {symbol:r.symbol,timeframe:r.timeframe,bars:r.total_bars_analyzed,
      counts:r.distribution||{},rows,dominant:rows[0]?.name||'Unknown',
      dominantPct:rows[0]?.value||0};
  },

  /* GET /api/reports */
  report:(r,i)=>({
    id:r.filename||i, name:r.filename||'Report', desc:`${r.category||'general'} artefact`,
    icon:r.category==='logs'?'📄':r.category==='charts'?'📈':'📊',
    color:'rgba(139,92,246,.15)', iconColor:'var(--pu-400)',
    date:(r.last_modified||'').slice(0,10), size:`${r.size_kb??0} KB`,
    type:(r.filename||'').split('.').pop()?.toUpperCase()||'FILE',
  }),

  notification:n=>({
    id:n.id, type:n.type||n.level||'info',
    icon:{success:'✓',error:'✕',warning:'⚠',signal:'📈'}[n.type]||'ℹ',
    title:n.title||n.subject||'Notification',
    body:n.message||n.body||'', link:n.link||null,
    read:!!(n.is_read??n.read), time:toMs(n.created_at||n.timestamp),
  }),

  holding:h=>({
    pair:h.symbol||h.instrument, dir:h.direction||h.side||'Long',
    size:h.quantity??h.size??0, entry:h.entry_price??h.avg_price,
    current:h.current_price??h.mark_price, pnl:h.unrealized_pnl??h.pnl??0,
    pnlPct:h.pnl_pct??0, up:(h.unrealized_pnl??h.pnl??0)>=0,
  }),

  settings:s=>({
    id:s.id, symbol:s.default_symbol, timeframe:s.default_timeframe,
    riskPerTrade:s.risk_per_trade_pct, leverage:s.leverage, spread:s.spread,
    confidenceThreshold:s.confidence_threshold, updatedAt:s.updated_at,
  }),

  /* POST /api/backtest */
  backtest:b=>{
    const m=b.metrics||{};
    return {strategy:b.strategy,symbol:b.symbol,timeframe:b.timeframe,
      params:b.parameters||{},trades:b.trade_count??0,
      netProfit:m.net_profit??0, profitFactor:m.profit_factor??0,
      maxDrawdown:m.max_drawdown??0, winRate:(m.win_rate??0)*100,
      sharpe:m.sharpe_ratio??0};
  },

  /* POST /api/ai-analysis */
  ai:a=>({
    timestamp:a.timestamp, symbol:a.symbol, timeframe:a.timeframe,
    regime:a.market_regime, strategy:a.selected_strategy,
    confidence:pct(a.confidence_score), action:a.decision_action,
    explanation:a.explanation||'', risk:a.risk_level||'Medium',
  }),
};

/* ══════════════════════════════════════════════
   CLIENT-SIDE REFERENCE DATA
   Keyboard shortcuts are pure UI metadata with no
   server-side representation. Every other domain is
   served by the backend.
══════════════════════════════════════════════ */
const FX_SHORTCUTS=[
  {keys:['Ctrl','K'],desc:'Open command palette'},
  {keys:['G','D'],desc:'Go to Dashboard'},
  {keys:['G','S'],desc:'Go to Strategies'},
  {keys:['G','B'],desc:'Go to Backtest'},
  {keys:['G','A'],desc:'Go to AI Assistant'},
  {keys:['G','P'],desc:'Go to Portfolio'},
  {keys:['Ctrl','Shift','T'],desc:'Toggle dark / light mode'},
  {keys:['Esc'],desc:'Close dialog, palette, or stop streaming'},
];

/* ══════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════ */
const api={
  /* meta */
  _base:API_BASE,
  events:AuthEvents,
  tokens:TokenStore,
  isAuthed:()=>!!TokenStore.access,
  /* Role claim straight from the signed token — the server still enforces
     authorisation; this only decides what the UI offers. */
  role:()=>decodeJwt(TokenStore.access||'')?.role||null,
  isAdmin:()=>decodeJwt(TokenStore.access||'')?.role==='admin',
  sessionExpired:()=>{ const t=TokenStore.access; return !t||jwtExpired(t,0); },

  auth:{
    async login({u,p}){
      const t=await _http('/auth/login',{method:'POST',body:{username:u,password:p}});
      TokenStore.set({access:t.access_token,refresh:t.refresh_token});
      const me=await _http('/auth/me');
      return {token:t.access_token,user:A.user(me)};
    },
    async register({username,email,password,fullName}){
      await _http('/auth/register',{method:'POST',
        body:{username,email,password,full_name:fullName||username,role:'user'}});
      return api.auth.login({u:username,p:password});
    },
    me:async()=>A.user(await _http('/auth/me')),
    async updateProfile(body){
      const u=await _http('/auth/profile',{method:'PUT',
        body:{full_name:body.name,email:body.email}});
      invalidate('/auth/me');
      return A.user(u);
    },
    changePassword:(oldPw,newPw)=>_http('/auth/change-password',{method:'POST',
      body:{old_password:oldPw,new_password:newPw}}),
    async logout(){
      const rt=TokenStore.refresh;
      try{ if(rt) await _http('/auth/logout',{method:'POST',body:{refresh_token:rt}}); }
      catch{ /* best-effort */ }
      TokenStore.clear(); _cache.clear();
    },
    forgot:email=>_http('/auth/forgot',{method:'POST',body:{email}}),
  },

  system:{
    health:()=>_get('/health',{ttl:15000}),
    /* Admin clearance required by the backend (endpoints.py). */
    systemHealth:()=>api.isAdmin()
      ? _get('/system-health',{ttl:20000})
      : Promise.reject(new ApiError(403,'Admin clearance is required.')),
    dbHealth:()=>api.isAdmin()
      ? _get('/database-health',{ttl:20000})
      : Promise.reject(new ApiError(403,'Admin clearance is required.')),
    status:()=>_get('/status',{ttl:60000}),
    version:()=>_get('/version',{ttl:600000}),
  },

  dashboard:{
    get:async(force)=>A.dashboard(await _get('/dashboard',{ttl:10000,force})),
  },

  strategies:{
    async list(force){
      const d=await _get('/strategies',{ttl:120000,force});
      return (d.strategies||[]).map(A.strategy);
    },
  },

  portfolio:{
    get:async force=>A.portfolio(await _get('/portfolio',{ttl:10000,force})),
    holdings:async()=>{ const h=await _get('/portfolio/holdings',{ttl:8000}); return (h||[]).map(A.holding); },
    settings:async()=>A.settings(await _get('/portfolio/settings',{ttl:30000})),
    async saveSettings(s){
      const r=await _http('/portfolio/settings',{method:'PUT',body:{
        default_symbol:s.symbol, default_timeframe:s.timeframe,
        risk_per_trade_pct:Number(s.riskPerTrade), leverage:Number(s.leverage),
        spread:Number(s.spread), confidence_threshold:Number(s.confidenceThreshold),
      }});
      invalidate('/portfolio/settings');
      return A.settings(r);
    },
    watchlists:()=>_get('/portfolio/watchlists',{ttl:30000}),
  },

  reports:{
    async list(force){
      const d=await _get('/reports',{ttl:20000,force});
      return (d.reports||[]).map(A.report);
    },
  },

  regime:{ get:async force=>A.regime(await _get('/market-regime',{ttl:60000,force})) },

  backtest:{
    run:async cfg=>A.backtest(await _http('/backtest',{method:'POST',timeout:120000,body:{
      strategy:cfg.strategy, symbol:cfg.symbol, timeframe:cfg.timeframe,
      ...(cfg.customParams?{custom_params:cfg.customParams}:{}),
    }})),
  },

  optimize:{
    /* queues a Celery job; requires Redis + worker */
    run:cfg=>_http('/optimize',{method:'POST',timeout:60000,
      body:{strategy:cfg.strategy,symbol:cfg.symbol,timeframe:cfg.timeframe}}),
    task:id=>_http(`/tasks/${id}`),
  },
  walkForward:{
    run:cfg=>_http('/walk-forward',{method:'POST',timeout:60000,
      body:{strategy:cfg.strategy,symbol:cfg.symbol,timeframe:cfg.timeframe}}),
  },
  paperTrading:{
    run:cfg=>_http('/paper-trading',{method:'POST',timeout:120000,
      body:{symbol:cfg.symbol,timeframe:cfg.timeframe}}),
  },

  ai:{
    analyse:async cfg=>A.ai(await _http('/ai-analysis',{method:'POST',timeout:120000,
      body:{symbol:cfg.symbol||'EURUSD',timeframe:cfg.timeframe||'1H'}})),
  },

  notifications:{
    async list(){
      const d=await _get('/portfolio/notifications',{ttl:12000});
      return (Array.isArray(d)?d:[]).map(A.notification);
    },
    markRead:id=>{ invalidate('/portfolio/notifications');
      return _http(`/portfolio/notifications/${id}/read`,{method:'PUT'}); },
    markAllRead:()=>{ invalidate('/portfolio/notifications');
      return _http('/portfolio/notifications/read-all',{method:'PUT'}); },
  },

  /* ── v6.0 platform domains (backend/api/platform_endpoints.py) ── */
  alerts:{
    list:()=>_get('/alerts',{ttl:6000}),
    create:body=>{ invalidate('/alerts'); return _http('/alerts',{method:'POST',body}); },
    toggle:(id,on)=>{ invalidate('/alerts'); return _http(`/alerts/${id}`,{method:'PATCH',body:{on}}); },
    remove:id=>{ invalidate('/alerts'); return _http(`/alerts/${id}`,{method:'DELETE'}); },
  },
  signals:{
    list:()=>_get('/signals',{ttl:6000}),
    tickers:()=>_get('/market/tickers',{ttl:4000}),
  },
  journal:{
    list:()=>_get('/journal',{ttl:6000}),
    create:body=>{ invalidate('/journal'); return _http('/journal',{method:'POST',body}); },
    remove:id=>{ invalidate('/journal'); return _http(`/journal/${id}`,{method:'DELETE'}); },
  },
  billing:{
    plans:()=>_get('/billing/plans',{ttl:300000}),
    invoices:()=>_get('/billing/invoices',{ttl:20000}),
    usage:()=>_get('/billing/usage',{ttl:15000}),
    subscribe:(planId,cycle='mo')=>{ invalidate('/billing'); 
      return _http('/billing/subscribe',{method:'POST',body:{planId,cycle}}); },
  },
  builder:{
    blocks:()=>_get('/builder/blocks',{ttl:300000}),
    save:body=>_http('/builder/strategies',{method:'POST',body}),
  },
  help:{
    faq:()=>_get('/help/faq',{ttl:300000}),
    docs:()=>_get('/help/docs',{ttl:300000}),
    shortcuts:()=>FX_SHORTCUTS,   // pure client-side UI reference
  },

  /* ── WebSocket: /api/ws/{user_id}, expects "ping" heartbeat ── */
  ws:{
    connect(userId,{onMessage,onStatus}={}){
      let sock=null,hb=null,retry=0,closed=false;
      const open=()=>{
        if(closed) return;
        const tk=TokenStore.access;
        if(!tk){ onStatus?.('idle'); return; }   // backend rejects tokenless handshakes
        try{ sock=new WebSocket(`${WS_BASE}${API_BASE}/ws/${userId}?token=${encodeURIComponent(tk)}`); }
        catch{ onStatus?.('error'); return; }
        sock.onopen=()=>{ retry=0; onStatus?.('open');
          hb=setInterval(()=>{ try{ sock.readyState===1&&sock.send('ping'); }catch{} },25000); };
        sock.onmessage=e=>{ try{ onMessage?.(JSON.parse(e.data)); }catch{ onMessage?.({type:'RAW',data:e.data}); } };
        sock.onerror=()=>onStatus?.('error');
        sock.onclose=ev=>{
          clearInterval(hb); onStatus?.(ev?.code===1008?'unauthorised':'closed');
          if(closed||ev?.code===1008) return;   // 1008 = policy violation, retrying is futile
          retry=Math.min(retry+1,6);
          setTimeout(open,Math.min(1000*2**retry,30000));  // exponential backoff
        };
      };
      open();
      return ()=>{ closed=true; clearInterval(hb); try{ sock?.close(); }catch{} };
    },
  },
};

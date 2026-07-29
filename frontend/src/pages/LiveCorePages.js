/* ══════════════════════════════════════════════
   QUANTORYX v6 — LIVE CORE PAGES
   Strategies · Backtest · Optimize · Portfolio · Reports · Regime
   All bound to the FastAPI backend. v5 visual language reused.
══════════════════════════════════════════════ */

/* ── shared symbol/timeframe options from GET /api/status ── */
const useMarketMeta=()=>{
  const {data}=useAsync(()=>api.system.status(),[]);
  return {
    symbols:data?.supported_pairs||['EURUSD','GBPUSD','USDJPY'],
    timeframes:data?.supported_timeframes||['M15','M30','1H','4H','1D'],
  };
};

/* ══════════════ STRATEGIES ══════════════ */
const LiveStrategiesPage=({go})=>{
  const {data,loading,error,refetch}=useAsync(()=>api.strategies.list(),[]);
  const [q,setQ]=useState('');
  const [sel,setSel]=useState(null);
  const dq=useDebounced(q);
  const list=(data||[]).filter(s=>!dq||fuzzy(dq,s.name)||fuzzy(dq,s.key));
  const active=sel||list[0];

  return(
    <div className="page fade-page">
      <PageHd title="Strategy Library" sub="Built-in strategies exposed by the backend engine">
        <button className="btn btn-g btn-sm" onClick={()=>go('builder')}>🧱 Builder</button>
        <button className="btn btn-p btn-sm" onClick={()=>go('backtest')}>▶ Backtest</button>
      </PageHd>

      <div className="tbl-filters">
        <div className="tbl-search" style={{maxWidth:280}}>
          <span style={{color:'var(--tx-3)',fontSize:12}}>🔍</span>
          <input placeholder="Search strategies…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <span style={{fontSize:11,color:'var(--tx-3)',marginLeft:'auto'}}>
          {loading?'loading…':`${list.length} strategies`}
        </span>
      </div>

      {error&&<div className="card card-p"><Empty icon="⚠" title="Could not load strategies" sub={error.message}/>
        <div style={{textAlign:'center'}}><button className="btn btn-g btn-sm" onClick={refetch}>Retry</button></div></div>}

      {loading?<div className="strat-cards" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12}}>
        {Array.from({length:6},(_,i)=><SkelCard key={i} rows={2}/>)}</div>:
      !error&&(
        <div className="strat-page-grid">
          <div className="strat-cards" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {list.map(s=>(
              <div key={s.id} className={cx('scard','card')} onClick={()=>setSel(s)}
                style={{cursor:'pointer',padding:14,borderColor:active?.id===s.id?'var(--pu-500)':undefined}}>
                <div className="scard-top" style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span className="node-ico">📋</span>
                  <div style={{minWidth:0}}>
                    <div className="scard-name" style={{fontSize:12.5,fontWeight:700,color:'var(--tx-1)'}}>{s.name}</div>
                    <div className="scard-type" style={{fontSize:10,color:'var(--tx-3)',fontFamily:'JetBrains Mono,monospace'}}>{s.key}</div>
                  </div>
                </div>
                <div className="scard-tags" style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {s.paramList.slice(0,3).map(p=><span key={p} className="jr-tag">{p}</span>)}
                </div>
              </div>
            ))}
            {!list.length&&<div className="card card-p" style={{gridColumn:'1/-1'}}>
              <Empty icon="🔍" title={`No strategies match “${q}”`} sub="Try a different keyword."/></div>}
          </div>

          <div className="card card-p detail-panel">
            <div className="card-hd"><div className="card-title">⚙ Parameters</div></div>
            {active?(
              <>
                <div style={{fontSize:14,fontWeight:700,color:'var(--tx-1)'}}>{active.name}</div>
                <div style={{fontSize:11,color:'var(--tx-3)',margin:'2px 0 12px',fontFamily:'JetBrains Mono,monospace'}}>
                  config_key: {active.key}
                </div>
                {Object.entries(active.params).map(([k,v])=>(
                  <div key={k} className="settings-row" style={{display:'flex',justifyContent:'space-between',
                    padding:'7px 0',borderBottom:'1px solid var(--bd)',fontSize:11.5}}>
                    <span style={{color:'var(--tx-2)'}}>{k}</span>
                    <span style={{fontWeight:600,color:'var(--tx-1)',fontFamily:'JetBrains Mono,monospace'}}>{String(v)}</span>
                  </div>
                ))}
                <button className="btn btn-p btn-sm btn-full" style={{marginTop:14}}
                  onClick={()=>{ try{ sessionStorage.setItem('qx.bt.strategy',active.key);}catch{} go('backtest'); }}>
                  ▶ Backtest this strategy
                </button>
              </>
            ):<Empty icon="👆" title="Select a strategy" sub="Click a card to inspect its default parameters."/>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════ BACKTEST ══════════════ */
const LiveBacktestPage=({go})=>{
  const {symbols,timeframes}=useMarketMeta();
  const {data:strats}=useAsync(()=>api.strategies.list(),[]);
  const [cfg,setCfg]=useState(()=>{
    let s='RSI'; try{ s=sessionStorage.getItem('qx.bt.strategy')||'RSI'; }catch{}
    return {strategy:s,symbol:'EURUSD',timeframe:'1H'};
  });
  const [res,setRes]=useState(null);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);
  const set=k=>e=>setCfg(p=>({...p,[k]:e.target.value}));

  const run=async()=>{
    setBusy(true); setErr(null);
    try{
      const r=await api.backtest.run(cfg);
      setRes(r);
      toast.success('Backtest complete',`${r.trades} trades · Sharpe ${r.sharpe.toFixed(2)}`);
    }catch(e){ setErr(e); toast.error('Backtest failed',e.message); }
    finally{ setBusy(false); }
  };

  const kpis=res?[
    {l:'Net Profit',v:fmtMoney(res.netProfit,4),c:dirClass(res.netProfit)},
    {l:'Profit Factor',v:res.profitFactor.toFixed(3),c:res.profitFactor>=1?'ok':'err'},
    {l:'Max Drawdown',v:res.maxDrawdown.toFixed(4),c:'err'},
    {l:'Win Rate',v:`${res.winRate.toFixed(2)}%`,c:res.winRate>=50?'ok':'err'},
    {l:'Sharpe Ratio',v:res.sharpe.toFixed(3),c:res.sharpe>=0?'ok':'err'},
    {l:'Total Trades',v:fmtNum(res.trades),c:'neu'},
  ]:[];

  return(
    <div className="page fade-page">
      <PageHd title="Backtest" sub="Run the backend simulation engine on historical data"/>
      <div className="bt-layout">
        <div className="bt-form card card-p">
          <div className="bt-form-title">Configuration</div>
          <div className="form-grp">
            <label className="form-lbl">Strategy</label>
            <select className="form-sel" value={cfg.strategy} onChange={set('strategy')}>
              {(strats||[]).map(s=><option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Symbol</label>
            <select className="form-sel" value={cfg.symbol} onChange={set('symbol')}>
              {symbols.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Timeframe</label>
            <select className="form-sel" value={cfg.timeframe} onChange={set('timeframe')}>
              {timeframes.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <button className="btn btn-p btn-full" style={{padding:9,marginTop:6}} onClick={run} disabled={busy}>
            {busy?<><Spinner/> Running…</>:'▶ Run Backtest'}
          </button>
          <div style={{fontSize:10,color:'var(--tx-3)',marginTop:8,lineHeight:1.6}}>
            POST <code style={{fontFamily:'JetBrains Mono,monospace'}}>/api/backtest</code> — executes on the live engine.
          </div>
        </div>

        <div className="bt-results">
          {busy&&<div className="card card-p"><SkelTable rows={4} cols={3}/></div>}
          {err&&!busy&&<div className="card card-p"><Empty icon="⚠" title="Backtest failed" sub={err.message}/></div>}
          {!busy&&!err&&!res&&(
            <div className="card card-p">
              <Empty icon="▶" title="Run a backtest"
                sub="Choose a strategy, symbol, and timeframe, then run it against the backend engine."/>
            </div>
          )}
          {res&&!busy&&(
            <>
              <div className="bt-kpi-row" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {kpis.map(k=>(
                  <div key={k.l} className="bt-kpi">
                    <div className="bt-kpi-lbl">{k.l}</div>
                    <div className={cx('bt-kpi-val',k.c)}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="card card-p" style={{marginTop:14}}>
                <div className="card-hd"><div className="card-title">⚙ Parameters used</div></div>
                <div className="code-prev">{JSON.stringify(res.params,null,2)}</div>
                <div style={{fontSize:11,color:'var(--tx-2)',marginTop:10,lineHeight:1.7}}>
                  <strong style={{color:'var(--tx-1)'}}>{res.strategy}</strong> on {res.symbol} {res.timeframe} —
                  {' '}{res.trades} trades executed by the backend engine.
                </div>
                <div style={{display:'flex',gap:8,marginTop:12}}>
                  <button className="btn btn-g btn-sm" onClick={()=>go('optimize')}>⚙ Optimize params</button>
                  <button className="btn btn-g btn-sm" onClick={()=>go('reports')}>📊 Reports</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════ OPTIMIZE (Celery-backed) ══════════════ */
const LiveOptimizePage=({go})=>{
  const {symbols,timeframes}=useMarketMeta();
  const {data:strats}=useAsync(()=>api.strategies.list(),[]);
  const [cfg,setCfg]=useState({strategy:'RSI',symbol:'EURUSD',timeframe:'1H'});
  const [task,setTask]=useState(null);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(null);
  const set=k=>e=>setCfg(p=>({...p,[k]:e.target.value}));

  const run=async(kind)=>{
    setBusy(true); setErr(null); setTask(null);
    try{
      const r=kind==='wf'?await api.walkForward.run(cfg):await api.optimize.run(cfg);
      setTask(r);
      toast.success('Job queued',r.task_id?`Task ${r.task_id}`:'Dispatched to worker.');
    }catch(e){ setErr(e); toast.error('Could not queue job',e.message); }
    finally{ setBusy(false); }
  };

  const celeryDown=err&&/celery|redis|reconnect|result store/i.test(err.message||'');

  return(
    <div className="page fade-page">
      <PageHd title="Optimization" sub="Grid search and walk-forward validation via the backend task queue"/>

      {celeryDown&&(
        <div className="card card-p" style={{borderColor:'rgba(245,158,11,.3)',background:'rgba(245,158,11,.05)'}}>
          <div className="row" style={{gap:10,alignItems:'flex-start'}}>
            <span style={{fontSize:18}}>⚠</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:700,color:'var(--tx-1)'}}>Task queue unavailable</div>
              <div style={{fontSize:11,color:'var(--tx-2)',marginTop:4,lineHeight:1.7}}>
                Optimization and walk-forward are dispatched to Celery and need Redis running.
                Start them with:
                <div className="code-prev" style={{marginTop:8}}>{`redis-server &\ncelery -A backend.tasks.celery_app worker --loglevel=info`}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bt-layout">
        <div className="bt-form card card-p">
          <div className="bt-form-title">Job Configuration</div>
          <div className="form-grp">
            <label className="form-lbl">Strategy</label>
            <select className="form-sel" value={cfg.strategy} onChange={set('strategy')}>
              {(strats||[]).map(s=><option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Symbol</label>
            <select className="form-sel" value={cfg.symbol} onChange={set('symbol')}>
              {symbols.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Timeframe</label>
            <select className="form-sel" value={cfg.timeframe} onChange={set('timeframe')}>
              {timeframes.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <button className="btn btn-p btn-full" style={{padding:9,marginTop:6}} onClick={()=>run('opt')} disabled={busy}>
            {busy?<><Spinner/> Queuing…</>:'⚙ Run Optimization'}
          </button>
          <button className="btn btn-g btn-full" style={{padding:9}} onClick={()=>run('wf')} disabled={busy}>
            🔄 Run Walk-Forward
          </button>
        </div>

        <div className="bt-results">
          {task?(
            <div className="card card-p">
              <div className="card-hd"><div className="card-title">✅ Job accepted</div></div>
              <div className="code-prev">{JSON.stringify(task,null,2)}</div>
              {task.task_id&&(
                <button className="btn btn-g btn-sm" style={{marginTop:10}}
                  onClick={async()=>{ try{ const s=await api.optimize.task(task.task_id);
                    toast.info('Task status',JSON.stringify(s).slice(0,120)); }
                    catch(e){ toast.error('Poll failed',e.message); } }}>
                  ↻ Poll status
                </button>
              )}
            </div>
          ):!err&&(
            <div className="card card-p">
              <Empty icon="⚙" title="No job running"
                sub="Queue an optimization or walk-forward run. Results are computed asynchronously by the worker."/>
            </div>
          )}
          {err&&!celeryDown&&<div className="card card-p"><Empty icon="⚠" title="Job failed" sub={err.message}/></div>}
        </div>
      </div>
    </div>
  );
};

/* ══════════════ PORTFOLIO ══════════════ */
const LivePortfolioPage=({go})=>{
  const port=useAsync(()=>api.portfolio.get(),[]);
  const hold=useAsync(()=>api.portfolio.holdings(),[]);
  const p=port.data;

  return(
    <div className="page fade-page">
      <PageHd title="Portfolio" sub="Live account performance from the backend">
        <button className="btn btn-g btn-sm" onClick={()=>{port.refetch();hold.refetch();}} aria-label="Refresh portfolio" title="Refresh">↻ Refresh</button>
      </PageHd>

      <div className="port-top" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {l:'Equity',v:p?fmtMoney(p.equity,2):'—',c:'stat-pu'},
          {l:'Starting Balance',v:p?fmtMoney(p.starting,2):'—',c:'stat-bl'},
          {l:'Total Return',v:p?fmtPct(p.totalReturn):'—',c:'stat-gr',cls:p?dirClass(p.totalReturn):''},
          {l:'Max Drawdown',v:p?`${p.maxDrawdown.toFixed(2)}%`:'—',c:'stat-rd',cls:'down'},
        ].map(s=>(
          <div key={s.l} className={cx('stat',s.c)}>
            <div className="stat-hd"><span className="stat-lbl">{s.l}</span></div>
            {port.loading?<Skel h={22} w="70%"/>:<div className={cx('stat-val',s.cls)}>{s.v}</div>}
          </div>
        ))}
      </div>

      <div className="card card-p">
        <div className="card-hd">
          <div className="card-title">📈 Equity Curve</div>
          <div style={{fontSize:11,color:'var(--tx-3)'}}>{p?`${p.trades} trades`:''}</div>
        </div>
        {port.loading?<Skel h={200}/>:
         p&&p.curve.length?(
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={p.curve} margin={{top:4,right:4,bottom:0,left:-18}}>
              <defs><linearGradient id="pfEq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={.28}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false}/>
              <XAxis dataKey="w" tick={{fill:'var(--tx-3)',fontSize:10}} axisLine={false} tickLine={false} minTickGap={30}/>
              <YAxis hide domain={['auto','auto']}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="equity" stroke="#a78bfa" strokeWidth={2} fill="url(#pfEq)" dot={false} name="Equity"/>
            </AreaChart>
          </ResponsiveContainer>
        ):<Empty icon="📈" title="No equity history"
            sub="The backend has no completed runs yet. Execute a backtest or paper-trading session."/>}
      </div>

      <div className="card card-p">
        <div className="card-hd"><div className="card-title">💼 Open Holdings</div></div>
        {hold.loading?<SkelTable rows={4} cols={5}/>:
         hold.data?.length?(
          <table className="tbl">
            <thead><tr><th>Instrument</th><th>Dir</th><th>Size</th><th>Entry</th><th>Current</th><th>P&L</th></tr></thead>
            <tbody>
              {hold.data.map((h,i)=>(
                <tr key={i}>
                  <td><span className="pair-chip">{h.pair}</span></td>
                  <td><span className={cx('trade-dir',h.dir==='Short'?'dir-short':'dir-long')}>{h.dir}</span></td>
                  <td>{h.size}</td>
                  <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{h.entry??'—'}</td>
                  <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{h.current??'—'}</td>
                  <td className={dirClass(h.pnl)}>{fmtMoney(h.pnl,2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ):<Empty icon="💼" title="No open positions"
            sub="Positions opened through the execution engine or paper trading appear here."/>}
      </div>
    </div>
  );
};

/* ══════════════ REPORTS ══════════════ */
const LiveReportsPage=()=>{
  const {data,loading,error,refetch}=useAsync(()=>api.reports.list(),[]);
  const reports=data||[];
  return(
    <div className="page fade-page">
      <PageHd title="Reports" sub="Artefacts generated by the backend engine">
        <button className="btn btn-g btn-sm" onClick={refetch} aria-label="Refresh reports" title="Refresh">↻ Refresh</button>
      </PageHd>
      {loading?<div className="reports-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
        {Array.from({length:4},(_,i)=><SkelCard key={i} rows={2}/>)}</div>:
       error?<div className="card card-p"><Empty icon="⚠" title="Could not load reports" sub={error.message}/></div>:
       reports.length?(
        <div className="reports-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
          {reports.map(r=>(
            <div key={r.id} className="report-card card card-p">
              <div className="report-icon-wrap" style={{background:r.color}}><span style={{color:r.iconColor}}>{r.icon}</span></div>
              <div className="report-name">{r.name}</div>
              <div className="report-desc">{r.desc}</div>
              <div className="report-meta">
                <span>{r.date} · {r.size}</span>
                <span className="status-pill pill-ok">{r.type}</span>
              </div>
            </div>
          ))}
        </div>
      ):<div className="card card-p"><Empty icon="📊" title="No reports yet"
          sub="Run a backtest, optimization, or portfolio analysis and generated files will be listed here."/></div>}
    </div>
  );
};

/* ══════════════ MARKET REGIME ══════════════ */
const LiveRegimePage=()=>{
  const {data:r,loading,error,refetch}=useAsync(()=>api.regime.get(),[]);
  return(
    <div className="page fade-page">
      <PageHd title="Market Regime" sub={r?`${r.symbol} · ${r.timeframe} · ${fmtNum(r.bars)} bars analysed`:'Loading…'}>
        <button className="btn btn-g btn-sm" onClick={refetch} aria-label="Re-run regime analysis" title="Re-analyse">↻ Re-analyse</button>
      </PageHd>

      {loading&&<div className="card card-p"><Skel h={220}/></div>}
      {error&&<div className="card card-p"><Empty icon="⚠" title="Regime detection failed" sub={error.message}/></div>}

      {r&&(
        <>
          <div className="card card-p regime-hero">
            <div style={{textAlign:'center',padding:'8px 0'}}>
              <div style={{fontSize:11,color:'var(--tx-3)',textTransform:'uppercase',letterSpacing:'.5px'}}>Dominant Regime</div>
              <div style={{fontSize:30,fontWeight:800,color:r.rows[0]?.color||'var(--tx-1)',marginTop:4}}>{r.dominant}</div>
              <div style={{fontSize:12,color:'var(--tx-2)',marginTop:3}}>
                {r.dominantPct.toFixed(2)}% of {fmtNum(r.bars)} analysed bars
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
            <div className="card card-p">
              <div className="card-hd"><div className="card-title">📊 Regime Distribution</div></div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={r.rows} margin={{top:8,right:8,bottom:0,left:-18}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:'var(--tx-3)',fontSize:10}} axisLine={false} tickLine={false} interval={0} angle={-14} textAnchor="end" height={54}/>
                  <YAxis tick={{fill:'var(--tx-3)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="value" radius={[5,5,0,0]} name="Share %">
                    {r.rows.map(x=><Cell key={x.name} fill={x.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card card-p">
              <div className="card-hd"><div className="card-title">🧮 Bar Counts</div></div>
              <table className="tbl">
                <thead><tr><th>Regime</th><th>Bars</th><th>Share</th></tr></thead>
                <tbody>
                  {r.rows.map(x=>(
                    <tr key={x.name}>
                      <td><span className="row" style={{gap:6}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:x.color,display:'inline-block'}}/>
                        {x.name}</span></td>
                      <td style={{fontFamily:'JetBrains Mono,monospace'}}>{fmtNum(r.counts[x.name]||0)}</td>
                      <td style={{fontWeight:600,color:'var(--tx-1)'}}>{x.value.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

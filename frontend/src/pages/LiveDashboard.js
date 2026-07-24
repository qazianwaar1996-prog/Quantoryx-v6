/* ══════════════════════════════════════════════
   QUANTORYX v6 — LIVE DASHBOARD
   Replaces the v5 mock Dashboard. Every widget reads the
   FastAPI backend:
     GET /api/dashboard      → KPIs, AI status, champion strategy
     GET /api/portfolio      → equity curve
     GET /api/market-regime  → regime distribution
     GET /api/strategies     → catalogue count
   Reuses v5 visual language: .stat, .card, .charts-grid, ChartTip.
══════════════════════════════════════════════ */

const LiveDashboard=({go,onWsMetric})=>{
  const dash=useAsync(()=>api.dashboard.get(),[]);
  const port=useAsync(()=>api.portfolio.get(),[]);
  const reg =useAsync(()=>api.regime.get(),[]);
  const strat=useAsync(()=>api.strategies.list(),[]);
  const [aiRun,setAiRun]=useState(null);
  const [aiBusy,setAiBusy]=useState(false);

  const d=dash.data,p=port.data,r=reg.data;
  const loading=dash.loading;

  const runAI=async()=>{
    setAiBusy(true);
    try{
      const res=await api.ai.analyse({symbol:d?.symbol||'EURUSD',timeframe:d?.timeframe||'1H'});
      setAiRun(res);
      toast.success('AI analysis complete',`${res.strategy} · ${res.confidence.toFixed(1)}% confidence`);
    }catch(e){ toast.error('AI analysis failed',e.message); }
    finally{ setAiBusy(false); }
  };

  const refreshAll=()=>{
    dash.refetch(); port.refetch(); reg.refetch(); strat.refetch();
    toast.info('Refreshing','Pulling the latest data from the backend.');
  };

  const stats=[
    {l:'Total Strategies',v:strat.data?strat.data.length:'—',c:'stat-pu',i:'📋'},
    {l:'Total Trades',v:d?fmtNum(d.trades):'—',c:'stat-bl',i:'▶'},
    {l:'Total Return',v:d?fmtPct(d.totalReturn):'—',c:'stat-gr',i:'📈',cls:d?dirClass(d.totalReturn):''},
    {l:'Max Drawdown',v:d?`${d.maxDrawdown.toFixed(2)}%`:'—',c:'stat-rd',i:'📉',cls:'down'},
    {l:'Sharpe Ratio',v:d?d.sharpe.toFixed(2):'—',c:'stat-cy',i:'📊'},
    {l:'Win Rate',v:d?`${(d.winRate*100<=100&&d.winRate<=1?d.winRate*100:d.winRate).toFixed(1)}%`:'—',c:'stat-or',i:'🎯'},
  ];

  const ai=aiRun||(d?{regime:d.regime,confidence:d.aiConfidence,strategy:d.champion,action:d.aiStatus,explanation:''}:null);

  return(
    <div className="page fade-page">
      <PageHd title="Dashboard" sub={d?`${d.symbol} · ${d.timeframe} · live backend data`:'Connecting to backend…'}>
        <button className="btn btn-g btn-sm" onClick={refreshAll} aria-label="Refresh dashboard data" title="Refresh">↻ Refresh</button>
        <button className="btn btn-p btn-sm" onClick={()=>go('backtest')}>+ New Backtest</button>
      </PageHd>

      {dash.error&&(
        <div className="card card-p" style={{borderColor:'rgba(239,68,68,.3)',background:'rgba(239,68,68,.05)'}}>
          <div className="row" style={{gap:10}}>
            <span style={{fontSize:18}}>⚠</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:700,color:'var(--tx-1)'}}>Could not reach the backend</div>
              <div style={{fontSize:11,color:'var(--tx-2)',marginTop:3}}>{dash.error.message}</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={dash.refetch}>Retry</button>
          </div>
        </div>
      )}

      <div className="stats-row">
        {stats.map(s=>(
          <div key={s.l} className={cx('stat',s.c)}>
            <div className="stat-hd"><span className="stat-lbl">{s.l}</span><span className="stat-ico">{s.i}</span></div>
            {loading?<Skel h={22} w="60%"/>:<div className={cx('stat-val',s.cls)}>{s.v}</div>}
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {/* ── Equity curve from GET /api/portfolio ── */}
        <div className="card card-p">
          <div className="card-hd">
            <div>
              <div className="card-title">📈 Equity Curve</div>
              <div className="card-sub">
                {p?`Balance ${fmtMoney(p.starting,0)} → ${fmtMoney(p.equity,0)} · ${p.trades} trades`:'Loading…'}
              </div>
            </div>
          </div>
          {port.loading?<Skel h={200}/>:
           p&&p.curve.length?(
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={p.curve} margin={{top:4,right:4,bottom:0,left:-18}}>
                <defs>
                  <linearGradient id="liveEq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={.28}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" vertical={false}/>
                <XAxis dataKey="w" tick={{fill:'var(--tx-3)',fontSize:10}} axisLine={false} tickLine={false} minTickGap={28}/>
                <YAxis hide domain={['auto','auto']}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="equity" stroke="#a78bfa" strokeWidth={2}
                  fill="url(#liveEq)" dot={false} name="Equity"/>
              </AreaChart>
            </ResponsiveContainer>
          ):(
            <Empty icon="📈" title="No equity history yet"
              sub="Run a backtest or paper-trading session and the curve will populate from the backend."/>
          )}
          {p&&(
            <div className="perf-metrics" style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginTop:12}}>
              {[['Return',fmtPct(p.totalReturn),dirClass(p.totalReturn)],
                ['Max DD',`${p.maxDrawdown.toFixed(2)}%`,'down'],
                ['Sharpe',p.sharpe.toFixed(2),'neu'],
                ['Win Rate',`${(p.winRate<=1?p.winRate*100:p.winRate).toFixed(1)}%`,'neu'],
                ['Profit Factor',p.profitFactor.toFixed(2),'neu']].map(([l,v,c])=>(
                <div key={l}>
                  <div className="micro-lbl">{l}</div>
                  <div className={cx('pm-val',c)} style={{fontSize:14,fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── AI insight from POST /api/ai-analysis ── */}
        <div className="card card-p ai-card">
          <div className="card-hd">
            <div className="card-title">🤖 AI Market Insight</div>
            <span className="ai-badge">Quantoryx AI</span>
          </div>
          {loading?<SkelText lines={4}/>:ai?(
            <>
              <div className="ai-signal" style={{fontSize:26,fontWeight:800,
                color:ai.action==='EXECUTE'?'var(--tx-ok)':ai.action==='REJECT'?'var(--tx-err)':'var(--tx-wrn)'}}>
                {ai.action||'—'}
              </div>
              <div className="ai-conf-lbl">Confidence: <strong>{ai.confidence?.toFixed(1)}%</strong></div>
              <div className="conf-bar"><div className="conf-fill" style={{width:`${ai.confidence||0}%`}}/></div>
              <div style={{fontSize:11.5,color:'var(--tx-2)',lineHeight:1.65,margin:'10px 0'}}>
                Regime <strong style={{color:'var(--tx-1)'}}>{ai.regime}</strong> ·
                selected <strong style={{color:'var(--tx-1)'}}>{ai.strategy}</strong>
              </div>
              {ai.explanation&&(
                <div style={{fontSize:11,color:'var(--tx-2)',lineHeight:1.7,maxHeight:120,overflowY:'auto',
                  background:'var(--bg-base)',border:'1px solid var(--bd)',borderRadius:8,padding:'9px 11px'}}>
                  {ai.explanation}
                </div>
              )}
              <div className="ai-acts" style={{display:'flex',gap:8,marginTop:12}}>
                <button className="btn btn-p btn-sm" onClick={runAI} disabled={aiBusy}>
                  {aiBusy?<><Spinner/> Analysing…</>:'⚡ Run AI Analysis'}
                </button>
                <button className="btn btn-g btn-sm" onClick={()=>go('ai')}>Open Assistant</button>
              </div>
            </>
          ):<Empty icon="🤖" title="AI unavailable" sub="The analysis engine did not respond."/>}
        </div>

        {/* ── Regime from GET /api/market-regime ── */}
        <div className="card card-p">
          <div className="card-hd">
            <div className="card-title">🌐 Market Regime</div>
          </div>
          {reg.loading?<Skel h={160}/>:r?(
            <>
              <div style={{textAlign:'center',marginBottom:10}}>
                <div style={{fontSize:20,fontWeight:800,color:'var(--tx-1)'}}>{r.dominant}</div>
                <div style={{fontSize:11,color:'var(--tx-3)'}}>{r.dominantPct.toFixed(1)}% of {fmtNum(r.bars)} bars</div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={r.rows} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                    {r.rows.map(x=><Cell key={x.name} fill={x.color}/>)}
                  </Pie>
                  <Tooltip content={<ChartTip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{marginTop:8}}>
                {r.rows.slice(0,4).map(x=>(
                  <div key={x.name} className="reg-row" style={{display:'flex',alignItems:'center',gap:7,padding:'3px 0'}}>
                    <span className="reg-dot" style={{background:x.color,width:8,height:8,borderRadius:'50%'}}/>
                    <span style={{fontSize:11,color:'var(--tx-2)',flex:1}}>{x.name}</span>
                    <span style={{fontSize:11,fontWeight:600,color:'var(--tx-1)'}}>{x.value.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-g btn-sm btn-full" style={{marginTop:10}} onClick={()=>go('regime')}>
                Full regime analysis →
              </button>
            </>
          ):<Empty icon="🌐" title="No regime data" sub="The detector returned no distribution."/>}
        </div>
      </div>

      {/* ── Recent trades + strategy catalogue ── */}
      <div className="bot-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card card-p">
          <div className="card-hd"><div className="card-title">📋 Recent Executed Trades</div></div>
          {loading?<SkelTable rows={4} cols={4}/>:
           d&&d.recentTrades.length?(
            <table className="tbl">
              <thead><tr><th>Pair</th><th>Dir</th><th>Entry</th><th>P&L</th></tr></thead>
              <tbody>
                {d.recentTrades.slice(0,8).map((t,i)=>(
                  <tr key={t.id||i}>
                    <td><span className="pair-chip">{t.pair}</span></td>
                    <td><span className={cx('trade-dir',t.dir==='Long'?'dir-long':'dir-short')}>{t.dir}</span></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{t.entry??'—'}</td>
                    <td className={dirClass(t.pnl)}>{fmtMoney(t.pnl,2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ):(
            <Empty icon="📋" title="No executed trades yet"
              sub="Trades appear here once a backtest or paper-trading run completes on the backend."/>
          )}
        </div>

        <div className="card card-p">
          <div className="card-hd">
            <div className="card-title">🧠 Strategy Library</div>
            <button className="btn btn-g btn-sm" onClick={()=>go('strategies')}>View all</button>
          </div>
          {strat.loading?<SkelText lines={5}/>:
           strat.data?.length?(
            <div className="stack" style={{gap:0}}>
              {strat.data.slice(0,7).map(s=>(
                <div key={s.id} className="tick-row" style={{cursor:'pointer'}} onClick={()=>go('strategies')}>
                  <span className="tick-pair" style={{minWidth:0,flex:1}}>{s.name}</span>
                  <span style={{fontSize:10,color:'var(--tx-3)',fontFamily:'JetBrains Mono,monospace'}}>{s.key}</span>
                </div>
              ))}
            </div>
          ):<Empty icon="🧠" title="No strategies" sub="The backend returned an empty catalogue."/>}
        </div>
      </div>
    </div>
  );
};

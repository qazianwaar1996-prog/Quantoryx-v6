/* ══════════════════════════════════════════════
   QUANTORYX v6 — LIVE AI ASSISTANT
   Bound to POST /api/ai-analysis (decision engine:
   regime detection → strategy selection → confidence
   model → explanation engine).
   Reuses the v5 chat shell classes and Md renderer.
══════════════════════════════════════════════ */

const AI_SUGGESTIONS=[
  {icon:'📊',label:'Analyse EUR/USD',   symbol:'EURUSD',tf:'1H'},
  {icon:'🎯',label:'Best setup on GBP/USD',symbol:'GBPUSD',tf:'1H'},
  {icon:'🌐',label:'USD/JPY 4H regime', symbol:'USDJPY',tf:'4H'},
  {icon:'🛡',label:'AUD/USD daily risk',symbol:'AUDUSD',tf:'1D'},
];

const LiveAIPage=({go})=>{
  const {symbols,timeframes}=useMarketMeta();
  const [msgs,setMsgs]=useState([]);
  const [busy,setBusy]=useState(false);
  const [sel,setSel]=useState({symbol:'EURUSD',timeframe:'1H'});
  const [state,setState]=useState(null);
  const endRef=useRef(null);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs,busy]);

  const ask=async(symbol,timeframe)=>{
    const s=symbol||sel.symbol, tf=timeframe||sel.timeframe;
    setSel({symbol:s,timeframe:tf});
    setMsgs(m=>[...m,{role:'user',text:`Analyse ${s} on ${tf}`,t:Date.now()}]);
    setBusy(true);
    try{
      const r=await api.ai.analyse({symbol:s,timeframe:tf});
      setState(r);
      setMsgs(m=>[...m,{role:'ai',data:r,t:Date.now()}]);
    }catch(e){
      setMsgs(m=>[...m,{role:'error',text:e.message,t:Date.now()}]);
      toast.error('AI analysis failed',e.message);
    }finally{ setBusy(false); }
  };

  const actionColor=a=>a==='EXECUTE'?'var(--tx-ok)':a==='REJECT'?'var(--tx-err)':'var(--tx-wrn)';

  return(
    <div className="page fade-page">
      <PageHd title="AI Assistant" sub="Live decision engine — regime, strategy selection, confidence and rationale">
        <select className="sel-sm" value={sel.symbol} onChange={e=>setSel(s=>({...s,symbol:e.target.value}))}>
          {symbols.map(o=><option key={o}>{o}</option>)}
        </select>
        <select className="sel-sm" value={sel.timeframe} onChange={e=>setSel(s=>({...s,timeframe:e.target.value}))}>
          {timeframes.map(o=><option key={o}>{o}</option>)}
        </select>
        <button className="btn btn-p btn-sm" onClick={()=>ask()} disabled={busy}>
          {busy?<><Spinner/> Analysing…</>:'⚡ Run Analysis'}
        </button>
      </PageHd>

      <div className="charts-grid" style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start'}}>
        <div className="card card-p" style={{minHeight:440,display:'flex',flexDirection:'column'}}>
          <div className="chat-msgs" style={{flex:1,overflowY:'auto',maxHeight:'56vh',paddingRight:4}}>
            {msgs.length===0&&!busy&&(
              <Empty icon="🤖" title="Ask the decision engine"
                sub="Pick an instrument and timeframe, then run an analysis. The backend classifies the market regime, selects a strategy, scores confidence, and explains its reasoning."/>
            )}

            {msgs.map((m,i)=>(
              <div key={i} className="msg-row" style={{marginBottom:16}}>
                {m.role==='user'&&(
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <div className="bubble" style={{background:'var(--grad-brand)',color:'#fff',
                      padding:'9px 14px',borderRadius:14,fontSize:12.5,maxWidth:'75%'}}>{m.text}</div>
                  </div>
                )}
                {m.role==='error'&&(
                  <div className="card card-p" style={{borderColor:'rgba(239,68,68,.3)',background:'rgba(239,68,68,.05)'}}>
                    <div style={{fontSize:12,color:'var(--tx-err)'}}>⚠ {m.text}</div>
                  </div>
                )}
                {m.role==='ai'&&(
                  <div className="msg-grp">
                    <div className="msg-meta" style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
                      <span className="msg-av" style={{width:22,height:22,borderRadius:6,background:'var(--grad-accent)',
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>🤖</span>
                      <span className="msg-nm" style={{fontSize:11.5,fontWeight:700,color:'var(--tx-1)'}}>Quantoryx AI</span>
                      <span className="ai-badge">decision engine</span>
                      <span style={{fontSize:10,color:'var(--tx-3)',marginLeft:'auto'}}>{fmtTime(m.t)}</span>
                    </div>

                    <div className="card card-p" style={{background:'var(--bg-base)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
                        {[['Action',m.data.action,actionColor(m.data.action)],
                          ['Confidence',`${m.data.confidence.toFixed(1)}%`,'var(--tx-1)'],
                          ['Regime',m.data.regime,'var(--tx-1)'],
                          ['Strategy',m.data.strategy,'var(--pu-400)']].map(([l,v,c])=>(
                          <div key={l}>
                            <div className="micro-lbl">{l}</div>
                            <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="conf-bar"><div className="conf-fill" style={{width:`${m.data.confidence}%`}}/></div>
                      <div style={{fontSize:11.5,color:'var(--tx-2)',lineHeight:1.8,marginTop:12,whiteSpace:'pre-wrap'}}>
                        {m.data.explanation}
                      </div>
                      <div style={{display:'flex',gap:8,marginTop:12}}>
                        <button className="btn btn-g btn-sm" onClick={()=>{
                          try{ sessionStorage.setItem('qx.bt.strategy',m.data.strategy);}catch{}
                          go('backtest');
                        }}>▶ Backtest {m.data.strategy}</button>
                        <CopyBtn text={m.data.explanation} label="Copy rationale"/>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {busy&&(
              <div className="row" style={{gap:8,color:'var(--tx-3)',fontSize:12}}>
                <Spinner dark/> Running regime detection and strategy selection…
              </div>
            )}
            <div ref={endRef}/>
          </div>

          <div className="prompts" style={{display:'flex',flexWrap:'wrap',gap:7,paddingTop:12,borderTop:'1px solid var(--bd)'}}>
            {AI_SUGGESTIONS.map(s=>(
              <button key={s.label} className="prompt-chip" onClick={()=>ask(s.symbol,s.tf)} disabled={busy}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Insight rail ── */}
        <div className="stack" style={{gap:14}}>
          <div className="card card-p">
            <div className="card-hd"><div className="card-title">📊 Latest Signal</div></div>
            {state?(
              <>
                <div className="ins-card">
                  <div className="ins-lbl">Decision</div>
                  <div className="ins-val" style={{color:actionColor(state.action)}}>{state.action}</div>
                </div>
                <div className="ins-card" style={{marginTop:8}}>
                  <div className="ins-lbl">Confidence</div>
                  <div className="ins-val">{state.confidence.toFixed(1)}%</div>
                  <div className="conf-bar" style={{marginTop:6}}><div className="conf-fill" style={{width:`${state.confidence}%`}}/></div>
                </div>
                <div className="ins-card" style={{marginTop:8}}>
                  <div className="ins-lbl">Market Regime</div>
                  <div className="ins-val" style={{fontSize:15}}>{state.regime}</div>
                </div>
                <div className="ins-card" style={{marginTop:8}}>
                  <div className="ins-lbl">Selected Strategy</div>
                  <div className="ins-val" style={{fontSize:15,color:'var(--pu-400)'}}>{state.strategy}</div>
                </div>
              </>
            ):<Empty icon="📡" title="No analysis yet" sub="Run an analysis to populate live engine output."/>}
          </div>

          <div className="card card-p">
            <div className="card-hd"><div className="card-title">🔗 Engine</div></div>
            <div style={{fontSize:11,color:'var(--tx-2)',lineHeight:1.8}}>
              Powered by <code style={{fontFamily:'JetBrains Mono,monospace'}}>POST /api/ai-analysis</code><br/>
              Pipeline: regime detector → strategy selector → confidence model → explanation engine.
            </div>
            <button className="btn btn-g btn-sm btn-full" style={{marginTop:10}} onClick={()=>go('regime')}>
              🌐 View regime analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

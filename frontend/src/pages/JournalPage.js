/* ══════════════════════════════════════════════
   QUANTORYX v6 — TRADE JOURNAL
   Reuses: PageHd, Empty, Modal, Confirm, toast, MiniLine,
           .card / .btn / .filter-chip / .tbl / .stat (v5)
══════════════════════════════════════════════ */

const JournalPage=({go})=>{
  const {data,loading,setData}=useAsync(()=>api.journal.list(),[]);
  const {data:strats}=useAsync(()=>api.strategies.list().catch(()=>[]),[]);
  const [filter,setFilter]=useState('All');
  const [q,setQ]=useState('');
  const dq=useDebounced(q);
  const [modal,setModal]=useState(false);
  const [detail,setDetail]=useState(null);
  const [del,setDel]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({pair:'EUR/USD',dir:'Long',pnl:'',rating:4,tags:'',note:'',strategy:'Momentum Breakout'});
  const [errs,setErrs]=useState({});

  const entries=data||[];
  const filters=['All','Wins','Losses','A+ setups'];

  const shown=entries.filter(e=>{
    const passF=filter==='All'?true
      :filter==='Wins'?e.pnl>0
      :filter==='Losses'?e.pnl<0
      :e.tags.includes('A+ setup');
    const passQ=!dq||fuzzy(dq,e.pair)||fuzzy(dq,e.note)||fuzzy(dq,e.strategy)||e.tags.some(t=>fuzzy(dq,t));
    return passF&&passQ;
  });

  const wins=entries.filter(e=>e.pnl>0);
  const losses=entries.filter(e=>e.pnl<0);
  const totalPnl=entries.reduce((s,e)=>s+e.pnl,0);
  const winRate=entries.length?(wins.length/entries.length*100).toFixed(1):'0.0';
  const avgWin=wins.length?wins.reduce((s,e)=>s+e.pnl,0)/wins.length:0;
  const avgLoss=losses.length?Math.abs(losses.reduce((s,e)=>s+e.pnl,0)/losses.length):0;
  const expectancy=entries.length?(totalPnl/entries.length):0;
  const avgRating=entries.length?(entries.reduce((s,e)=>s+e.rating,0)/entries.length).toFixed(1):'—';

  /* Cumulative P&L curve reusing the v5 MiniLine component */
  const curve=useMemo(()=>{
    let run=0;
    return [...entries].sort((a,b)=>a.date-b.date).map((e,i)=>{ run+=e.pnl; return {w:`T${i+1}`,equity:run}; });
  },[entries]);

  const save=async()=>{
    const e={};
    if(!String(form.pnl).trim()||isNaN(+form.pnl)) e.pnl='Enter the realised P&L as a number.';
    if(!form.note.trim()) e.note='Write at least a short reflection.';
    setErrs(e);
    if(Object.keys(e).length) return;
    setSaving(true);
    const created=await api.journal.create({
      ...form,pnl:+form.pnl,date:Date.now(),
      tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean),
    });
    setData(p=>[created,...p]);
    setSaving(false); setModal(false);
    setForm({pair:'EUR/USD',dir:'Long',pnl:'',rating:4,tags:'',note:'',strategy:'Momentum Breakout'});
    toast.success('Entry logged','Your trade has been added to the journal.');
  };

  const confirmDelete=async()=>{
    setSaving(true);
    await api.journal.remove(del.id);
    setData(p=>p.filter(e=>e.id!==del.id));
    setSaving(false); setDel(null); setDetail(null);
    toast.success('Entry deleted','The journal entry has been removed.');
  };

  const exportCsv=()=>{
    const rows=[['Date','Pair','Direction','Strategy','P&L','Rating','Tags','Note'],
      ...entries.map(e=>[fmtDate(e.date),e.pair,e.dir,e.strategy,e.pnl,e.rating,e.tags.join(' | '),`"${e.note.replace(/"/g,'""')}"`])];
    const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='quantoryx-journal.csv'; a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Journal exported',`${entries.length} entries written to CSV.`);
  };

  const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);

  return(
    <div className="page fade-page">
      <PageHd title="Trade Journal" sub="Log every trade, tag the setup, and review your own decision quality">
        <button className="btn btn-g btn-sm" onClick={exportCsv} disabled={!entries.length} aria-label="Export journal as CSV" title="Export CSV">⬇ Export CSV</button>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ New Entry</button>
      </PageHd>

      <div className="stats-row">
        {[
          {l:'Net P&L',v:fmtMoney(totalPnl,0),c:'stat-pu',i:'💰',cls:dirClass(totalPnl)},
          {l:'Win Rate',v:`${winRate}%`,c:'stat-gr',i:'🎯'},
          {l:'Entries',v:entries.length,c:'stat-bl',i:'📓'},
          {l:'Avg Win',v:fmtMoney(avgWin,0),c:'stat-cy',i:'📈',cls:'up'},
          {l:'Avg Loss',v:fmtMoney(-avgLoss,0),c:'stat-rd',i:'📉',cls:'down'},
          {l:'Avg Grade',v:avgRating,c:'stat-or',i:'⭐'},
        ].map(s=>(
          <div key={s.l} className={cx('stat',s.c)}>
            <div className="stat-hd"><span className="stat-lbl">{s.l}</span><span className="stat-ico">{s.i}</span></div>
            <div className={cx('stat-val',s.cls)}>{loading?'—':s.v}</div>
          </div>
        ))}
      </div>

      <div className="card card-p">
        <div className="card-hd">
          <div>
            <div className="card-title">📈 Cumulative P&L</div>
            <div className="card-sub">Expectancy {fmtMoney(expectancy,2)} per trade across {entries.length} logged trades</div>
          </div>
        </div>
        {loading?<Skel h={60}/>:curve.length?<MiniLine data={curve} color="#8b5cf6" height={90}/>:
          <Empty icon="📈" title="No data yet" sub="Log your first trade to start building the equity curve."/>}
      </div>

      <div className="tbl-filters">
        <div className="strat-filters" style={{flex:1}}>
          {filters.map(f=><button key={f} className={cx('filter-chip',filter===f&&'on')} onClick={()=>setFilter(f)}>{f}</button>)}
        </div>
        <div className="tbl-search">
          <span style={{color:'var(--tx-3)',fontSize:12}}>🔍</span>
          <input placeholder="Search notes, pairs, tags…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
      </div>

      {loading&&<div className="jr-grid">{Array.from({length:4},(_,i)=><SkelCard key={i} rows={2}/>)}</div>}

      {!loading&&shown.length===0&&(
        <div className="card card-p">
          <Empty icon="📓" title={q?`No entries match “${q}”`:'Your journal is empty'}
            sub="Consistent journaling is the fastest way to find the leaks in your process. Log a trade to begin."/>
          <div style={{textAlign:'center'}}>
            <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Log your first trade</button>
          </div>
        </div>
      )}

      {!loading&&shown.length>0&&(
        <div className="jr-grid">
          {shown.map(e=>(
            <div key={e.id} className="jr-entry" onClick={()=>setDetail(e)}>
              <div className="jr-top">
                <span className="jr-pair">{e.pair}</span>
                <span className={cx('trade-dir',e.dir==='Long'?'dir-long':'dir-short')}>{e.dir}</span>
                <span className={cx('jr-pnl',dirClass(e.pnl))}>{fmtMoney(e.pnl,0)}</span>
              </div>
              <div className="jr-rating" style={{color:'var(--ye-400)'}}>{stars(e.rating)}</div>
              <div className="jr-note">{e.note}</div>
              <div className="jr-tags">
                {e.tags.slice(0,3).map(t=><span key={t} className="jr-tag">{t}</span>)}
              </div>
              <div className="jr-foot">
                <span style={{fontSize:10,color:'var(--tx-3)'}}>{relTime(e.date)}</span>
                <span style={{fontSize:10,color:'var(--tx-3)'}}>{e.strategy}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New entry modal ── */}
      <Modal open={modal} onClose={()=>setModal(false)} icon="📓" size="lg"
        title="New Journal Entry" sub="Record the trade and — more importantly — why you took it."
        footer={
          <>
            <span className="mdl-ft-l">Honest notes beat flattering ones.</span>
            <button className="btn btn-g btn-md" onClick={()=>setModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-p btn-md" onClick={save} disabled={saving}>
              {saving?<><Spinner/> Saving…</>:'Save Entry'}
            </button>
          </>
        }>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          <div className="form-grp">
            <label className="form-lbl">Instrument</label>
            <select className="form-sel" value={form.pair} onChange={e=>setForm(f=>({...f,pair:e.target.value}))}>
              {['EUR/USD','GBP/USD','USD/JPY','XAU/USD','BTC/USD','ETH/USD','NASDAQ','SPX500'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Direction</label>
            <select className="form-sel" value={form.dir} onChange={e=>setForm(f=>({...f,dir:e.target.value}))}>
              <option>Long</option><option>Short</option>
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Realised P&L ($)</label>
            <input className={cx('form-inp',errs.pnl&&'inp-err')} placeholder="e.g. 620 or -310"
              value={form.pnl} onChange={e=>setForm(f=>({...f,pnl:e.target.value}))}/>
            <FieldError>{errs.pnl}</FieldError>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-grp">
            <label className="form-lbl">Strategy</label>
            <select className="form-sel" value={form.strategy} onChange={e=>setForm(f=>({...f,strategy:e.target.value}))}>
              <option>Manual</option>
              {(strats||[]).map(s=><option key={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Execution Grade</label>
            <div className="row" style={{gap:4,height:34}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))}
                  style={{background:'none',border:'none',fontSize:19,lineHeight:1,color:n<=form.rating?'var(--ye-400)':'var(--bd-gl)'}}
                  aria-label={`${n} star${n>1?'s':''}`}>★</button>
              ))}
              <span style={{fontSize:11,color:'var(--tx-3)',marginLeft:6}}>{form.rating}/5</span>
            </div>
          </div>
        </div>

        <div className="form-grp">
          <label className="form-lbl">Tags <span style={{textTransform:'none',color:'var(--tx-3)'}}>(comma separated)</span></label>
          <input className="form-inp" placeholder="Breakout, Planned, A+ setup"
            value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))}/>
        </div>

        <div className="form-grp">
          <label className="form-lbl">Reflection</label>
          <textarea className={cx('form-inp',errs.note&&'inp-err')} rows={4}
            style={{resize:'vertical',minHeight:84,lineHeight:1.6,padding:'9px 11px'}}
            placeholder="What was the setup? Did you follow your plan? What would you do differently?"
            value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
          <FieldError>{errs.note}</FieldError>
          <div style={{fontSize:10,color:'var(--tx-3)',textAlign:'right'}}>{form.note.length} characters</div>
        </div>
      </Modal>

      {/* ── Detail modal ── */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} size="lg" icon={detail?.pnl>=0?'📈':'📉'}
        title={detail?`${detail.pair} · ${detail.dir}`:''}
        sub={detail?`${detail.strategy} · ${fmtDate(detail.date)}`:''}
        footer={
          <>
            <button className="btn btn-g btn-md" style={{color:'var(--tx-err)'}} onClick={()=>setDel(detail)}>🗑 Delete</button>
            <button className="btn btn-g btn-md" onClick={()=>setDetail(null)}>Close</button>
            <button className="btn btn-p btn-md" onClick={()=>{ setDetail(null); go('backtest'); }}>▶ Backtest strategy</button>
          </>
        }>
        {detail&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
              {[['Realised P&L',fmtMoney(detail.pnl,2),dirClass(detail.pnl)],
                ['Execution Grade',`${detail.rating}/5`,'neu'],
                ['Direction',detail.dir,'neu']].map(([l,v,c])=>(
                <div key={l} className="bt-kpi">
                  <div className="bt-kpi-lbl">{l}</div>
                  <div className={cx('bt-kpi-val',c)}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="section-lbl">Tags</div>
              <div className="jr-tags">{detail.tags.map(t=><span key={t} className="jr-tag">{t}</span>)}</div>
            </div>
            <div>
              <div className="section-lbl">Reflection</div>
              <div style={{fontSize:12,color:'var(--tx-2)',lineHeight:1.85}}>{detail.note}</div>
            </div>
          </>
        )}
      </Modal>

      <Confirm open={!!del} onClose={()=>setDel(null)} onConfirm={confirmDelete} loading={saving}
        title="Delete this entry?" confirmLabel="Delete entry"
        body={<>The {del?.pair} entry from {del?fmtDate(del.date):''} will be permanently removed.</>}/>
    </div>
  );
};

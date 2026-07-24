/* ══════════════════════════════════════════════
   QUANTORYX v6 — ALERTS PAGE
   Reuses: PageHd, Empty, Toggle, Modal, Confirm, toast,
           .card / .btn / .filter-chip / .form-* / .tbl (v5)
══════════════════════════════════════════════ */

const ALERT_TONE={
  price:      {icon:'💲',bg:'rgba(139,92,246,.13)',fg:'var(--pu-400)'},
  risk:       {icon:'🛡',bg:'rgba(239,68,68,.13)', fg:'var(--re-400)'},
  volatility: {icon:'📊',bg:'rgba(245,158,11,.13)',fg:'var(--ye-400)'},
  indicator:  {icon:'📈',bg:'rgba(59,130,246,.13)',fg:'var(--bl-400)'},
  pnl:        {icon:'💰',bg:'rgba(16,185,129,.13)',fg:'var(--gr-400)'},
};
const CHANNEL_ICON={push:'📱',email:'✉️',sms:'💬'};

const AlertsPage=({go})=>{
  const {data,loading,setData}=useAsync(()=>api.alerts.list(),[]);
  const {data:strats}=useAsync(()=>api.strategies.list().catch(()=>[]),[]);
  const [filter,setFilter]=useState('All');
  const [modal,setModal]=useState(false);
  const [del,setDel]=useState(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({name:'',type:'price',instrument:'EUR/USD',op:'>',value:'',channel:['push'],strategy:'All strategies'});
  const [errs,setErrs]=useState({});

  const alerts=data||[];
  const filters=['All','Active','Paused'];
  const shown=alerts.filter(a=>filter==='All'||(filter==='Active'?a.on:!a.on));
  const activeCount=alerts.filter(a=>a.on).length;
  const firedTotal=alerts.reduce((s,a)=>s+a.fired,0);

  const toggle=(id,on)=>{
    setData(p=>p.map(a=>a.id===id?{...a,on}:a));
    api.alerts.toggle(id,on);
    toast.info(on?'Alert enabled':'Alert paused',alerts.find(a=>a.id===id)?.name);
  };

  const confirmDelete=async()=>{
    setSaving(true);
    await api.alerts.remove(del.id);
    setData(p=>p.filter(a=>a.id!==del.id));
    setSaving(false); setDel(null);
    toast.success('Alert deleted',`“${del.name}” has been removed.`);
  };

  const toggleChannel=c=>setForm(f=>({
    ...f,channel:f.channel.includes(c)?f.channel.filter(x=>x!==c):[...f.channel,c],
  }));

  const save=async()=>{
    const e={};
    if(!form.name.trim()) e.name='Give the alert a name.';
    if(!String(form.value).trim()) e.value='Enter a trigger value.';
    if(!form.channel.length) e.channel='Pick at least one delivery channel.';
    setErrs(e);
    if(Object.keys(e).length) return;
    setSaving(true);
    const cond=`${form.instrument} ${form.op} ${form.value}`;
    const created=await api.alerts.create({...form,cond,on:true});
    setData(p=>[created,...p]);
    setSaving(false); setModal(false);
    setForm({name:'',type:'price',instrument:'EUR/USD',op:'>',value:'',channel:['push'],strategy:'All strategies'});
    toast.success('Alert created',`“${created.name}” is now live.`);
  };

  return(
    <div className="page fade-page">
      <PageHd title="Alerts" sub="Get notified when the market meets your conditions">
        <button className="btn btn-g btn-sm" onClick={()=>go('signals')}>📡 Live Signals</button>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ New Alert</button>
      </PageHd>

      <div className="stats-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {[
          {l:'Total Alerts',v:alerts.length,c:'stat-pu',i:'🔔'},
          {l:'Active',v:activeCount,c:'stat-gr',i:'✓'},
          {l:'Paused',v:alerts.length-activeCount,c:'stat-or',i:'⏸'},
          {l:'Triggered (30d)',v:firedTotal,c:'stat-bl',i:'⚡'},
        ].map(s=>(
          <div key={s.l} className={cx('stat',s.c)}>
            <div className="stat-hd">
              <span className="stat-lbl">{s.l}</span>
              <span className="stat-ico">{s.i}</span>
            </div>
            <div className="stat-val">{loading?'—':s.v}</div>
          </div>
        ))}
      </div>

      <div className="alerts-grid">
        <div>
          <div className="strat-filters" style={{marginBottom:12}}>
            {filters.map(f=>(
              <button key={f} className={cx('filter-chip',filter===f&&'on')} onClick={()=>setFilter(f)}>
                {f}{f!=='All'&&` (${f==='Active'?activeCount:alerts.length-activeCount})`}
              </button>
            ))}
          </div>

          {loading&&Array.from({length:4},(_,i)=><div key={i} style={{marginBottom:9}}><SkelCard rows={1}/></div>)}

          {!loading&&shown.length===0&&(
            <div className="card card-p">
              <Empty icon="🔔" title="No alerts here"
                sub="Create an alert to be notified the moment price, risk, or an indicator hits your threshold."/>
              <div style={{textAlign:'center'}}>
                <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Create your first alert</button>
              </div>
            </div>
          )}

          {!loading&&shown.map(a=>{
            const tone=ALERT_TONE[a.type]||ALERT_TONE.price;
            return(
              <div key={a.id} className={cx('alert-row',!a.on&&'off')}>
                <span className="alert-ico" style={{background:tone.bg,color:tone.fg}}>{tone.icon}</span>
                <div style={{minWidth:0,flex:1}}>
                  <div className="alert-nm">{a.name}</div>
                  <div className="alert-cond">{a.cond}</div>
                  <div className="alert-meta">
                    <span>{a.strategy}</span>
                    <span>· {a.fired} triggered</span>
                    <span>· {a.last?relTime(a.last):'never fired'}</span>
                    <span>· {a.channel.map(c=>CHANNEL_ICON[c]).join(' ')}</span>
                  </div>
                </div>
                <div className="alert-acts">
                  <Toggle on={a.on} onChange={v=>toggle(a.id,v)}/>
                  <button className="alert-ib" title="Edit alert"
                    onClick={()=>toast.info('Edit alert','Inline editing opens the alert configurator.')}>✎</button>
                  <button className="alert-ib danger" title="Delete alert" onClick={()=>setDel(a)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card card-p">
          <div className="card-hd"><div className="card-title">⚡ Recent Triggers</div></div>
          {loading?<SkelTable rows={5} cols={2}/>:(
            <div className="stack" style={{gap:0}}>
              {alerts.filter(a=>a.last).sort((a,b)=>b.last-a.last).slice(0,5).map(a=>(
                <div key={a.id} className="tick-row">
                  <span className="tick-pair" style={{minWidth:0,flex:1}}>{a.name}</span>
                  <span style={{fontSize:10,color:'var(--tx-3)'}}>{relTime(a.last)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="section-lbl" style={{marginTop:16}}>Delivery Channels</div>
          {[['📱','Push notifications','Browser & mobile'],['✉️','Email','anwaar@quantoryx.io'],['💬','SMS','Quant plan only']].map(([i,t,s])=>(
            <div key={t} className="row" style={{gap:9,padding:'8px 0',borderBottom:'1px solid var(--bd)'}}>
              <span style={{fontSize:14}}>{i}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11.5,fontWeight:600,color:'var(--tx-1)'}}>{t}</div>
                <div style={{fontSize:10,color:'var(--tx-3)',marginTop:1}}>{s}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-g btn-sm btn-full" style={{marginTop:12}} onClick={()=>go('settings')}>
            ⚙ Notification settings
          </button>
        </div>
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} icon="🔔"
        title="Create Alert" sub="Define the condition and how you want to be notified."
        footer={
          <>
            <span className="mdl-ft-l">Alerts are evaluated on every tick.</span>
            <button className="btn btn-g btn-md" onClick={()=>setModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-p btn-md" onClick={save} disabled={saving}>
              {saving?<><Spinner/> Creating…</>:'Create Alert'}
            </button>
          </>
        }>
        <div className="form-grp">
          <label className="form-lbl">Alert Name</label>
          <input className={cx('form-inp',errs.name&&'inp-err')} placeholder="e.g. EUR/USD breakout"
            value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <FieldError>{errs.name}</FieldError>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-grp">
            <label className="form-lbl">Type</label>
            <select className="form-sel" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              {['price','risk','volatility','indicator','pnl'].map(t=><option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-grp">
            <label className="form-lbl">Strategy</label>
            <select className="form-sel" value={form.strategy} onChange={e=>setForm(f=>({...f,strategy:e.target.value}))}>
              <option>All strategies</option>
              <option>Account-wide</option>
              {(strats||[]).map(s=><option key={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grp">
          <label className="form-lbl">Condition</label>
          <div style={{display:'grid',gridTemplateColumns:'1.4fr .7fr 1fr',gap:8}}>
            <select className="form-sel" value={form.instrument} onChange={e=>setForm(f=>({...f,instrument:e.target.value}))}>
              {['EUR/USD','GBP/USD','USD/JPY','XAU/USD','BTC/USD','NASDAQ','Drawdown','Daily P&L','RSI(14)','ATR(14)'].map(o=><option key={o}>{o}</option>)}
            </select>
            <select className="form-sel" value={form.op} onChange={e=>setForm(f=>({...f,op:e.target.value}))}>
              {['>','<','≥','≤','='].map(o=><option key={o}>{o}</option>)}
            </select>
            <input className={cx('form-inp',errs.value&&'inp-err')} placeholder="value"
              value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))}/>
          </div>
          <FieldError>{errs.value}</FieldError>
          {form.value&&<div style={{fontSize:10.5,color:'var(--tx-3)',marginTop:4,fontFamily:'JetBrains Mono,monospace'}}>
            Preview: {form.instrument} {form.op} {form.value}
          </div>}
        </div>

        <div className="form-grp">
          <label className="form-lbl">Delivery Channels</label>
          <div className="strat-filters">
            {['push','email','sms'].map(c=>(
              <button key={c} className={cx('filter-chip',form.channel.includes(c)&&'on')} onClick={()=>toggleChannel(c)}>
                {CHANNEL_ICON[c]} {c[0].toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>
          <FieldError>{errs.channel}</FieldError>
        </div>
      </Modal>

      <Confirm open={!!del} onClose={()=>setDel(null)} onConfirm={confirmDelete} loading={saving}
        title="Delete this alert?" confirmLabel="Delete alert"
        body={<>“{del?.name}” will stop monitoring immediately. This cannot be undone.</>}/>
    </div>
  );
};

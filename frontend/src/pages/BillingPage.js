/* ══════════════════════════════════════════════
   QUANTORYX v6 — BILLING & SUBSCRIPTION
   Reuses: PageHd, Empty, Modal, Confirm, toast,
           .card / .btn / .tbl / .status-pill (v5)
══════════════════════════════════════════════ */

const BillingPage=({go})=>{
  const {data:plans,loading:pLoad}=useAsync(()=>api.billing.plans(),[]);
  const invoicesQ=useAsync(()=>api.billing.invoices(),[]);
  const {data:invoices,loading:iLoad}=invoicesQ;
  const usageQ=useAsync(()=>api.billing.usage(),[]);
  const {data:usage,loading:uLoad}=usageQ;
  const [cycle,setCycle]=useState('mo');
  const [renews,setRenews]=useState(null);
  /* First day of next month — matches the backend's usage-cycle reset. */
  const nextReset=useMemo(()=>{
    const d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,1);
  },[]);
  const fmtDay=d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
  const [current,setCurrent]=useState('pro');
  const [confirm,setConfirm]=useState(null);
  const [saving,setSaving]=useState(false);
  const [cardModal,setCardModal]=useState(false);

  const doSubscribe=async()=>{
    setSaving(true);
    const res=await api.billing.subscribe(confirm.id,cycle);
    if(res?.renews_at) setRenews(res.renews_at);
    setCurrent(confirm.id);
    setSaving(false);
    invoicesQ.refetch?.(); usageQ.refetch?.();
    toast.success('Plan updated',`You are now on the ${confirm.name} plan.`);
    setConfirm(null);
  };

  const price=p=>cycle==='mo'?p.price.mo:Math.round(p.price.yr/12);

  return(
    <div className="page fade-page">
      <PageHd title="Billing & Plan" sub="Manage your subscription, payment method, and usage">
        <button className="btn btn-g btn-sm" onClick={()=>go('settings')}>⚙ Account Settings</button>
        <button className="btn btn-p btn-sm" onClick={()=>setCardModal(true)}>💳 Update Payment</button>
      </PageHd>

      {/* ── Current plan banner ── */}
      <div className="card card-p" style={{background:'linear-gradient(135deg,rgba(139,92,246,.10),rgba(37,99,235,.06))',borderColor:'var(--bd-pu)'}}>
        <div className="row" style={{gap:14,flexWrap:'wrap'}}>
          <div className="mdl-hd-ico" style={{width:42,height:42,fontSize:19}}>💎</div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--tx-1)'}}>
              {plans?.find(p=>p.id===current)?.name||'Pro'} plan · active
            </div>
            <div style={{fontSize:11.5,color:'var(--tx-2)',marginTop:3,lineHeight:1.6}}>
              Renews on <strong style={{color:'var(--tx-1)'}}>{fmtDay(renews||nextReset)}</strong> · billed {cycle==='mo'?'monthly':'annually'} ·
              next charge {fmtMoney(plans?.find(p=>p.id===current)?.price[cycle]||49,2)}
            </div>
          </div>
          <div className="bill-toggle">
            {[['mo','Monthly'],['yr','Yearly']].map(([k,l])=>(
              <button key={k} className={cx('bill-tg',cycle===k&&'on')} onClick={()=>setCycle(k)}>
                {l}{k==='yr'&&<span className="save-tag">−20%</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Plans ── */}
      <div>
        <div className="section-lbl">Available Plans</div>
        {pLoad?(
          <div className="plans-grid">{Array.from({length:3},(_,i)=><SkelCard key={i} rows={6}/>)}</div>
        ):(
          <div className="plans-grid">
            {plans.map(p=>{
              const isCur=p.id===current;
              return(
                <div key={p.id} className={cx('plan',isCur&&'on')}>
                  {p.popular&&!isCur&&<span className="plan-tag">MOST POPULAR</span>}
                  {isCur&&<span className="plan-tag" style={{background:'var(--grad-success)'}}>CURRENT PLAN</span>}
                  <div>
                    <div className="plan-nm">{p.name}</div>
                    <div className="plan-desc" style={{marginTop:4}}>{p.desc}</div>
                  </div>
                  <div className="plan-price">
                    <span className="plan-amt">${price(p)}</span>
                    <span className="plan-per">/ month</span>
                  </div>
                  {cycle==='yr'&&p.price.yr>0&&
                    <div style={{fontSize:10.5,color:'var(--tx-ok)',marginTop:-6}}>${p.price.yr} billed annually</div>}
                  <div className="plan-feats">
                    {p.feats.map(([f,on])=>(
                      <div key={f} className={cx('plan-feat',!on&&'off')}>
                        <span className="plan-feat-ck">{on?'✓':'✕'}</span>{f}
                      </div>
                    ))}
                  </div>
                  <button className={cx('btn','btn-full','btn-md',isCur?'btn-g':'btn-p')}
                    disabled={isCur} onClick={()=>setConfirm(p)}>
                    {isCur?'✓ Current plan':p.price.mo===0?'Downgrade':'Upgrade to '+p.name}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="port-grid" style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16,alignItems:'start'}}>
        {/* ── Invoices ── */}
        <div className="card card-p">
          <div className="card-hd">
            <div className="card-title">🧾 Billing History</div>
            <button className="btn btn-g btn-sm" onClick={()=>toast.info('Export queued','Your invoice archive will be emailed shortly.')}>⬇ Export all</button>
          </div>
          {iLoad?<SkelTable rows={5} cols={5}/>:(
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {invoices.map(inv=>(
                  <tr key={inv.id}>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{inv.id}</td>
                    <td>{inv.date}</td>
                    <td>{inv.plan}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace'}}>{fmtMoney(inv.amt,2)}</td>
                    <td><span className={cx('status-pill',inv.status==='paid'?'pill-ok':'pill-warn')}>
                      {inv.status==='paid'?'Paid':'Free'}</span></td>
                    <td><button className="copy-btn" onClick={()=>toast.success('Invoice downloaded',`${inv.id}.pdf saved.`)}>⬇ PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Payment method + usage ── */}
        <div className="stack" style={{gap:16}}>
          <div className="card card-p">
            <div className="card-hd"><div className="card-title">💳 Payment Method</div></div>
            <div className="pm-card">
              <div className="pm-brand">VISA</div>
              <div style={{flex:1,minWidth:0}}>
                <div className="pm-num">•••• •••• •••• 4242</div>
                <div className="pm-exp">Expires 08 / 2027 · Anwaar</div>
              </div>
            </div>
            <button className="btn btn-g btn-sm btn-full" style={{marginTop:10}} onClick={()=>setCardModal(true)}>
              Update card
            </button>
            <div style={{fontSize:10,color:'var(--tx-3)',marginTop:9,lineHeight:1.6,textAlign:'center'}}>
              🔒 Card details are tokenised and never stored on Quantoryx servers.
            </div>
          </div>

          <div className="card card-p">
            <div className="card-hd">
              <div>
                <div className="card-title">📊 Usage This Cycle</div>
                <div className="card-sub">Resets {fmtDay(nextReset)}</div>
              </div>
            </div>
            {uLoad?<SkelText lines={5}/>:usage.map(u=>{
              const unlimited=u.limit==='∞';
              const pct=unlimited?8:u.limit?Math.min(100,u.used/u.limit*100):0;
              const tone=pct>=90?'danger':pct>=70?'warn':'';
              return(
                <div key={u.label} className="usage-row">
                  <div className="usage-top">
                    <span className="usage-lbl">{u.label}</span>
                    <span className="usage-val">{fmtNum(u.used)} / {unlimited?'∞':fmtNum(u.limit)}</span>
                  </div>
                  <div className="usage-bar"><div className={cx('usage-fill',tone)} style={{width:`${pct}%`}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Confirm open={!!confirm} onClose={()=>setConfirm(null)} onConfirm={doSubscribe} loading={saving}
        tone="info" title={`Switch to ${confirm?.name}?`} confirmLabel={`Switch to ${confirm?.name}`}
        body={<>Your plan changes immediately and billing is prorated against the remainder of the current cycle.
          {confirm&&confirm.price[cycle]>0&&<> You will be charged <strong style={{color:'var(--tx-1)'}}>{fmtMoney(confirm.price[cycle],2)}</strong> {cycle==='mo'?'per month':'per year'}.</>}</>}/>

      <Modal open={cardModal} onClose={()=>setCardModal(false)} icon="💳" size="sm"
        title="Update Payment Method" sub="Your new card replaces the one currently on file."
        footer={
          <>
            <button className="btn btn-g btn-md" onClick={()=>setCardModal(false)}>Cancel</button>
            <button className="btn btn-p btn-md" onClick={()=>{ setCardModal(false); toast.success('Card updated','Future invoices will use the new card.'); }}>Save card</button>
          </>
        }>
        <div className="form-grp">
          <label className="form-lbl">Cardholder Name</label>
          <input className="form-inp" placeholder="Name as it appears on the card" defaultValue="Anwaar"/>
        </div>
        <div className="form-grp">
          <label className="form-lbl">Card Number</label>
          <input className="form-inp" placeholder="4242 4242 4242 4242" style={{fontFamily:'JetBrains Mono,monospace'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div className="form-grp">
            <label className="form-lbl">Expiry</label>
            <input className="form-inp" placeholder="MM / YY" style={{fontFamily:'JetBrains Mono,monospace'}}/>
          </div>
          <div className="form-grp">
            <label className="form-lbl">CVC</label>
            <input className="form-inp" placeholder="•••" style={{fontFamily:'JetBrains Mono,monospace'}}/>
          </div>
        </div>
      </Modal>
    </div>
  );
};

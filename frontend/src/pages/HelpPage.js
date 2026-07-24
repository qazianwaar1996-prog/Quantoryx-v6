/* ══════════════════════════════════════════════
   QUANTORYX v6 — HELP & DOCS
   Wires up the previously inert "Help & Docs" sidebar button.
   Reuses: PageHd, Empty, Kbd, toast, .card / .btn / .form-* (v5)
══════════════════════════════════════════════ */

const HelpPage=({go})=>{
  const {data:faq,loading:fLoad}=useAsync(()=>api.help.faq(),[]);
  const {data:docs,loading:dLoad}=useAsync(()=>api.help.docs(),[]);
  const shortcuts=api.help.shortcuts();
  const [section,setSection]=useState('start');
  const [open,setOpen]=useState(0);
  const [q,setQ]=useState('');
  const dq=useDebounced(q);
  const [sent,setSent]=useState(false);
  const [msg,setMsg]=useState({subject:'',body:''});

  const nav=[
    {id:'start',    icon:'🚀',label:'Getting Started'},
    {id:'guides',   icon:'📚',label:'Guides'},
    {id:'faq',      icon:'❓',label:'FAQ'},
    {id:'shortcuts',icon:'⌨',label:'Shortcuts'},
    {id:'contact',  icon:'✉️',label:'Contact Support'},
  ];

  const shownFaq=(faq||[]).filter(f=>!dq||fuzzy(dq,f.q)||fuzzy(dq,f.a));
  const shownDocs=(docs||[]).filter(d=>!dq||fuzzy(dq,d.title)||fuzzy(dq,d.desc));

  const steps=[
    {n:1,icon:'📋',t:'Create or pick a strategy',d:'Use the visual Strategy Builder, or start from one of the seven prebuilt strategies in your library.',go:'builder'},
    {n:2,icon:'▶',t:'Backtest it on history',d:'Choose an instrument, timeframe, and date range. Review Sharpe, drawdown, and the full trade list.',go:'backtest'},
    {n:3,icon:'⚙',t:'Optimize the parameters',d:'Run a grid or genetic search and read the 3D surface to find stable parameter islands, not lucky spikes.',go:'optimize'},
    {n:4,icon:'📡',t:'Go live with signals & alerts',d:'Enable live signals and configure alerts so the platform tells you the moment a setup appears.',go:'signals'},
  ];

  const send=()=>{
    if(!msg.subject.trim()||!msg.body.trim()){
      toast.error('Missing details','Add a subject and describe the issue.');
      return;
    }
    setSent(true);
    toast.success('Message sent','Support usually replies within 4 hours on the Pro plan.');
  };

  return(
    <div className="page fade-page">
      <PageHd title="Help & Docs" sub="Guides, answers, and shortcuts for getting the most out of Quantoryx">
        <div className="tbl-search" style={{maxWidth:260}}>
          <span style={{color:'var(--tx-3)',fontSize:12}}>🔍</span>
          <input placeholder="Search help…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <button className="btn btn-p btn-sm" onClick={()=>setSection('contact')}>✉️ Contact Support</button>
      </PageHd>

      <div className="help-grid">
        <div className="help-nav">
          {nav.map(n=>(
            <button key={n.id} className={cx('help-nav-i',section===n.id&&'on')} onClick={()=>setSection(n.id)}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          <div className="card card-p" style={{marginTop:12,background:'rgba(139,92,246,.06)',borderColor:'var(--bd-pu)'}}>
            <div style={{fontSize:11.5,fontWeight:700,color:'var(--tx-1)',marginBottom:4}}>🤖 Ask the AI</div>
            <div style={{fontSize:10.5,color:'var(--tx-2)',lineHeight:1.6,marginBottom:9}}>
              The assistant can answer platform questions as well as market ones.
            </div>
            <button className="btn btn-p btn-sm btn-full" onClick={()=>go('ai')}>Open assistant →</button>
          </div>
        </div>

        <div>
          {/* ── Getting started ── */}
          {section==='start'&&(
            <div className="stack" style={{gap:16}}>
              <div className="card card-p">
                <div className="card-hd">
                  <div>
                    <div className="card-title">🚀 Your first 10 minutes</div>
                    <div className="card-sub">Four steps from empty account to live signals</div>
                  </div>
                </div>
                <div className="stack" style={{gap:10}}>
                  {steps.map(s=>(
                    <div key={s.n} className="row" style={{gap:12,padding:'11px 13px',background:'var(--bg-card)',border:'1px solid var(--bd)',borderRadius:'var(--r)'}}>
                      <div className="mdl-hd-ico" style={{width:34,height:34}}>{s.icon}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:'var(--tx-1)'}}>
                          <span style={{color:'var(--pu-400)',marginRight:6}}>{s.n}.</span>{s.t}
                        </div>
                        <div style={{fontSize:11,color:'var(--tx-2)',marginTop:3,lineHeight:1.6}}>{s.d}</div>
                      </div>
                      <button className="btn btn-g btn-sm" onClick={()=>go(s.go)}>Open →</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card-p">
                <div className="card-hd"><div className="card-title">📖 Key concepts</div></div>
                <div className="docs-grid">
                  {[
                    ['Sharpe Ratio','Risk-adjusted return. Above 1.0 is decent, above 2.0 is excellent — but only if the sample is large enough.'],
                    ['Max Drawdown','The deepest peak-to-trough equity decline. It is the number that decides whether you can actually stick with a strategy.'],
                    ['Walk-Forward','Repeatedly optimize on one window and test on the next unseen window. The honest way to validate a strategy.'],
                    ['Market Regime','A classification of the current environment — Bull, Neutral, or Bear — that determines which strategies are likely to work.'],
                  ].map(([t,d])=>(
                    <div key={t} className="doc-card" style={{cursor:'default'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:'var(--tx-1)'}}>{t}</div>
                        <div style={{fontSize:11,color:'var(--tx-2)',marginTop:4,lineHeight:1.65}}>{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Guides ── */}
          {section==='guides'&&(
            <div className="card card-p">
              <div className="card-hd">
                <div className="card-title">📚 Documentation</div>
                <div style={{fontSize:11,color:'var(--tx-3)'}}>{shownDocs.length} article{shownDocs.length===1?'':'s'}</div>
              </div>
              {dLoad?<div className="docs-grid">{Array.from({length:4},(_,i)=><SkelCard key={i} rows={2}/>)}</div>:
               shownDocs.length===0?<Empty icon="🔍" title={`No guides match “${q}”`} sub="Try a different keyword, or ask the AI assistant."/>:(
                <div className="docs-grid">
                  {shownDocs.map(d=>(
                    <div key={d.title} className="doc-card" onClick={()=>toast.info(d.title,'Opening documentation…')}>
                      <div className="doc-ico">{d.icon}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:700,color:'var(--tx-1)'}}><Highlight text={d.title} q={dq}/></div>
                        <div style={{fontSize:11,color:'var(--tx-2)',marginTop:4,lineHeight:1.6}}>{d.desc}</div>
                        <div style={{fontSize:10,color:'var(--tx-3)',marginTop:6}}>⏱ {d.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FAQ ── */}
          {section==='faq'&&(
            <div className="card card-p">
              <div className="card-hd">
                <div className="card-title">❓ Frequently Asked Questions</div>
                <div style={{fontSize:11,color:'var(--tx-3)'}}>{shownFaq.length} answer{shownFaq.length===1?'':'s'}</div>
              </div>
              {fLoad?<SkelText lines={6}/>:
               shownFaq.length===0?<Empty icon="🔍" title={`Nothing matches “${q}”`} sub="Contact support and we will answer directly."/>:
               shownFaq.map((f,i)=>(
                <div key={f.q} className={cx('faq',open===i&&'on')}>
                  <button className="faq-q" onClick={()=>setOpen(open===i?-1:i)}>
                    <span style={{color:'var(--pu-400)'}}>Q</span>
                    <span style={{flex:1}}><Highlight text={f.q} q={dq}/></span>
                    <span className="faq-arr">▼</span>
                  </button>
                  {open===i&&<div className="faq-a">{f.a}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── Shortcuts ── */}
          {section==='shortcuts'&&(
            <div className="card card-p">
              <div className="card-hd">
                <div>
                  <div className="card-title">⌨ Keyboard Shortcuts</div>
                  <div className="card-sub">Every shortcut works from any page</div>
                </div>
              </div>
              {shortcuts.map(s=>(
                <div key={s.desc} className="kbd-tbl-row">
                  <span>{s.desc}</span>
                  <span className="kbd-combo">
                    {s.keys.map((k,i)=><React.Fragment key={k}>{i>0&&<span style={{color:'var(--tx-3)',fontSize:10}}>+</span>}<Kbd>{k}</Kbd></React.Fragment>)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Contact ── */}
          {section==='contact'&&(
            <div className="stack" style={{gap:16}}>
              <div className="card card-p">
                <div className="card-hd">
                  <div>
                    <div className="card-title">✉️ Contact Support</div>
                    <div className="card-sub">Pro plan · typical first response under 4 hours</div>
                  </div>
                </div>
                {sent?(
                  <>
                    <Empty icon="✅" title="Message sent" sub="We have your request and will reply to anwaar@quantoryx.io shortly. Ticket #QX-4821."/>
                    <div style={{textAlign:'center'}}>
                      <button className="btn btn-g btn-sm" onClick={()=>{ setSent(false); setMsg({subject:'',body:''}); }}>Send another message</button>
                    </div>
                  </>
                ):(
                  <>
                    <div className="form-grp">
                      <label className="form-lbl">Subject</label>
                      <input className="form-inp" placeholder="Briefly, what do you need help with?"
                        value={msg.subject} onChange={e=>setMsg(m=>({...m,subject:e.target.value}))}/>
                    </div>
                    <div className="form-grp" style={{marginTop:10}}>
                      <label className="form-lbl">Message</label>
                      <textarea className="form-inp" rows={5} style={{resize:'vertical',minHeight:110,lineHeight:1.6,padding:'9px 11px'}}
                        placeholder="Include the strategy, page, or backtest ID involved so we can reproduce the issue."
                        value={msg.body} onChange={e=>setMsg(m=>({...m,body:e.target.value}))}/>
                    </div>
                    <button className="btn btn-p btn-full btn-md" style={{marginTop:12}} onClick={send}>Send message</button>
                  </>
                )}
              </div>

              <div className="docs-grid">
                {[['💬','Live chat','Available 9am–9pm UTC for Pro and Quant plans.'],
                  ['📧','Email','support@quantoryx.io — always open.'],
                  ['🐦','Community','Join 4,200 traders in the Quantoryx Discord.'],
                  ['📄','Status page','Live uptime and incident history.']].map(([i,t,d])=>(
                  <div key={t} className="doc-card" onClick={()=>toast.info(t,'Opening…')}>
                    <div className="doc-ico">{i}</div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12.5,fontWeight:700,color:'var(--tx-1)'}}>{t}</div>
                      <div style={{fontSize:11,color:'var(--tx-2)',marginTop:4,lineHeight:1.6}}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

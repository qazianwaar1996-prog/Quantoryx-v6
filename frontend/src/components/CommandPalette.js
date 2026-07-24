/* ══════════════════════════════════════════════
   QUANTORYX v6 — COMMAND PALETTE (Ctrl + K)
   Fulfils the "Ctrl + K" affordance already rendered in the
   v5 Header (.hd-kbd) which previously had no global handler.
   Searches pages, strategies, reports and actions.
══════════════════════════════════════════════ */

const CMD_ACTIONS=[
  {id:'a-newbt',   group:'Actions',icon:'▶',label:'Run a new backtest',      sub:'Open the backtest configurator', go:'backtest'},
  {id:'a-opt',     group:'Actions',icon:'⚙',label:'Optimize parameters',     sub:'Grid & genetic search',          go:'optimize'},
  {id:'a-ai',      group:'Actions',icon:'🤖',label:'Ask the AI assistant',    sub:'Market analysis & setups',       go:'ai'},
  {id:'a-build',   group:'Actions',icon:'🧱',label:'Build a new strategy',    sub:'Visual strategy builder',        go:'builder'},
  {id:'a-alert',   group:'Actions',icon:'🔔',label:'Create a price alert',    sub:'Price, risk & indicator alerts', go:'alerts'},
  {id:'a-journal', group:'Actions',icon:'📓',label:'Add a journal entry',     sub:'Log a trade and reflection',     go:'journal'},
  {id:'a-theme',   group:'Actions',icon:'🌗',label:'Toggle dark / light mode',sub:'Switch the interface theme',     act:'theme'},
  {id:'a-help',    group:'Actions',icon:'❓',label:'Help & documentation',    sub:'Guides, FAQ and shortcuts',      go:'help'},
];

const CommandPalette=({open,onClose,go,onToggleTheme,pages=[],strategies=[],reports=[]})=>{
  const [q,setQ]=useState('');
  const [idx,setIdx]=useState(0);
  const inputRef=useRef(null);
  const listRef=useRef(null);

  useScrollLock(open);
  useEffect(()=>{ if(open){ setQ(''); setIdx(0); setTimeout(()=>inputRef.current?.focus(),40); } },[open]);

  /* Build the searchable index from live app data — no duplication */
  const items=useMemo(()=>{
    const nav=pages.map(p=>({id:`p-${p.id}`,group:'Navigation',icon:p.icon,label:p.label,sub:'Jump to page',go:p.id}));
    const strat=strategies.map(s=>({id:`s-${s.id}`,group:'Strategies',icon:'📋',label:s.name,sub:`${s.type} · Sharpe ${s.sharpe} · ${s.ret}`,go:'strategies'}));
    const rep=reports.map(r=>({id:`r-${r.id}`,group:'Reports',icon:r.icon,label:r.name,sub:`${r.date} · ${r.type} · ${r.size}`,go:'reports'}));
    return [...nav,...CMD_ACTIONS,...strat,...rep];
  },[pages,strategies,reports]);

  const filtered=useMemo(()=>{
    if(!q.trim()) return items.slice(0,14);
    return items.filter(i=>fuzzy(q,i.label)||fuzzy(q,i.sub||'')||fuzzy(q,i.group)).slice(0,24);
  },[items,q]);

  useEffect(()=>{ setIdx(0); },[q]);

  const run=useCallback(item=>{
    if(!item) return;
    onClose();
    if(item.act==='theme') onToggleTheme?.();
    else if(item.go) go(item.go);
  },[go,onClose,onToggleTheme]);

  const onKey=e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); setIdx(i=>Math.min(i+1,filtered.length-1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setIdx(i=>Math.max(i-1,0)); }
    else if(e.key==='Enter'){ e.preventDefault(); run(filtered[idx]); }
    else if(e.key==='Escape'){ e.preventDefault(); onClose(); }
  };

  /* keep the active row in view */
  useEffect(()=>{
    const el=listRef.current?.querySelector('.cp-item.on');
    el?.scrollIntoView({block:'nearest'});
  },[idx]);

  if(!open) return null;

  let lastGroup=null;
  return(
    <div className="ov" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="cp-w" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cp-inp-w">
          <span className="cp-inp-ico">🔍</span>
          <input ref={inputRef} className="cp-inp" placeholder="Search pages, strategies, reports, actions…"
            value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            aria-label="Search commands" autoComplete="off"/>
          <Kbd>Esc</Kbd>
        </div>

        <div className="cp-list" ref={listRef}>
          {filtered.length===0&&(
            <div style={{padding:'26px 16px',textAlign:'center'}}>
              <div style={{fontSize:26,marginBottom:8}}>🔍</div>
              <div style={{fontSize:12.5,fontWeight:600,color:'var(--tx-1)'}}>No results for “{q}”</div>
              <div style={{fontSize:11,color:'var(--tx-3)',marginTop:4}}>Try a page name, strategy, or action.</div>
            </div>
          )}
          {filtered.map((it,i)=>{
            const head=it.group!==lastGroup?(lastGroup=it.group):null;
            return(
              <React.Fragment key={it.id}>
                {head&&<div className="cp-grp">{head}</div>}
                <button className={cx('cp-item',i===idx&&'on')}
                  onMouseEnter={()=>setIdx(i)} onClick={()=>run(it)}>
                  <span className="cp-item-ico">{it.icon}</span>
                  <span style={{flex:1,minWidth:0}}>
                    <span className="cp-item-nm"><Highlight text={it.label} q={q}/></span>
                    {it.sub&&<span className="cp-item-sub" style={{display:'block'}}>{it.sub}</span>}
                  </span>
                  {i===idx&&<span className="cp-item-kbd"><Kbd>↵</Kbd></span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="cp-ft">
          <span className="cp-ft-k"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="cp-ft-k"><Kbd>↵</Kbd> select</span>
          <span className="cp-ft-k"><Kbd>Esc</Kbd> close</span>
          <span style={{marginLeft:'auto'}}>{filtered.length} result{filtered.length===1?'':'s'}</span>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   QUANTORYX v6 — HEADER MENUS
   NotificationBell · ProfileMenu · MobileMoreDrawer
   These attach to the existing v5 .hd-btn / .hd-avatar
   elements, which previously had no click handlers.
══════════════════════════════════════════════ */

const NOTIF_TONE={
  success:{bg:'rgba(16,185,129,.13)',fg:'var(--gr-400)'},
  signal: {bg:'rgba(139,92,246,.13)',fg:'var(--pu-400)'},
  warn:   {bg:'rgba(245,158,11,.13)',fg:'var(--ye-400)'},
  error:  {bg:'rgba(239,68,68,.13)', fg:'var(--re-400)'},
  info:   {bg:'rgba(59,130,246,.13)',fg:'var(--bl-400)'},
};

const NotificationBell=({go})=>{
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const ref=useDismiss(open,useCallback(()=>setOpen(false),[]));

  useEffect(()=>{
    api.notifications.list().then(d=>{ setItems(d); setLoading(false); });
  },[]);

  const unread=items.filter(n=>!n.read).length;

  const openItem=n=>{
    setItems(p=>p.map(x=>x.id===n.id?{...x,read:true}:x));
    api.notifications.markRead(n.id);
    setOpen(false);
    if(n.link) go(n.link);
  };
  const markAll=()=>{
    setItems(p=>p.map(x=>({...x,read:true})));
    api.notifications.markAllRead();
    toast.success('All caught up','Every notification marked as read.');
  };

  return(
    <div className="dd-anchor" ref={ref}>
      <button className={cx('hd-btn',open&&'on')} style={{position:'relative'}}
        onClick={()=>setOpen(o=>!o)} title="Notifications"
        aria-haspopup="true" aria-expanded={open} aria-label={`Notifications${unread?`, ${unread} unread`:''}`}>
        🔔
        {unread>0&&<span style={{position:'absolute',top:3,right:3,width:8,height:8,background:'var(--re-500)',borderRadius:'50%',border:'2px solid var(--bg-base)'}}/>}
      </button>

      {open&&(
        <div className="dd-pop dd-notif">
          <div className="dd-hd">
            <span className="dd-hd-t">Notifications{unread>0&&` · ${unread} new`}</span>
            {unread>0&&<button className="dd-hd-a" onClick={markAll}>Mark all read</button>}
          </div>

          <div className="dd-scroll">
            {loading&&<div style={{padding:14}}><SkelCard rows={2}/></div>}
            {!loading&&items.length===0&&<Empty icon="🔔" title="No notifications" sub="You're all caught up. New signals and reports will appear here."/>}
            {!loading&&items.map(n=>{
              const tone=NOTIF_TONE[n.type]||NOTIF_TONE.info;
              return(
                <button key={n.id} className={cx('dd-row',!n.read&&'unread')} onClick={()=>openItem(n)}>
                  <span className="dd-row-ico" style={{background:tone.bg,color:tone.fg}}>{n.icon}</span>
                  <span style={{flex:1,minWidth:0}}>
                    <span className="dd-row-t" style={{display:'block'}}>{n.title}</span>
                    <span className="dd-row-s" style={{display:'block'}}>{n.body}</span>
                    <span className="dd-row-tm" style={{display:'block'}}>{relTime(n.time)}</span>
                  </span>
                  {!n.read&&<span className="dd-unread-dot"/>}
                </button>
              );
            })}
          </div>

          <div className="dd-ft">
            <button className="dd-ft-btn" onClick={()=>{ setOpen(false); go('alerts'); }}>Manage alerts →</button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProfileMenu=({go,user,onLogout,onToggleTheme,dark})=>{
  const [open,setOpen]=useState(false);
  const ref=useDismiss(open,useCallback(()=>setOpen(false),[]));
  const initial=(user?.name||'A').charAt(0).toUpperCase();

  const items=[
    {icon:'👤',label:'Profile & account',go:'settings'},
    {icon:'💳',label:'Billing & plan',    go:'billing'},
    {icon:'📓',label:'Trade journal',     go:'journal'},
    {icon:'❓',label:'Help & docs',       go:'help',kbd:'?'},
  ];

  return(
    <div className="dd-anchor" ref={ref}>
      <button className="hd-avatar" onClick={()=>setOpen(o=>!o)}
        aria-haspopup="true" aria-expanded={open} aria-label="Account menu"
        style={{border:'none',padding:0}}>{initial}</button>

      {open&&(
        <div className="dd-pop dd-prof">
          <div className="dd-prof-hd">
            <div className="hd-avatar" style={{width:36,height:36,fontSize:14}}>{initial}</div>
            <div style={{minWidth:0}}>
              <div className="dd-prof-nm">{user?.name||'Anwaar'}</div>
              <div className="dd-prof-em">{user?.email||'anwaar@quantoryx.io'}</div>
              <span className="dd-prof-plan">{user?.plan||'Pro'} plan</span>
            </div>
          </div>

          <div className="dd-items">
            {items.map(i=>(
              <button key={i.label} className="dd-item" onClick={()=>{ setOpen(false); go(i.go); }}>
                <span>{i.icon}</span>{i.label}
                {i.kbd&&<span className="dd-item-kbd"><Kbd>{i.kbd}</Kbd></span>}
              </button>
            ))}
            <button className="dd-item" onClick={()=>{ onToggleTheme(); setOpen(false); }}>
              <span>{dark?'☀️':'🌙'}</span>{dark?'Light mode':'Dark mode'}
              <span className="dd-item-kbd"><Kbd>⌃⇧T</Kbd></span>
            </button>
            <div className="dd-sep"/>
            <button className="dd-item danger" onClick={()=>{ setOpen(false); onLogout(); }}>
              <span>🚪</span>Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Mobile "More" sheet: exposes every page the 5-slot
      bottom bar cannot fit (Backtest, Optimize, Reports,
      Regime, Alerts, Signals, Journal, Builder, Billing, Help) ── */
const MobileMoreDrawer=({open,onClose,page,go})=>{
  const items=[
    {id:'backtest', icon:'▶', label:'Backtest'},
    {id:'optimize', icon:'⚙', label:'Optimize'},
    {id:'builder',  icon:'🧱',label:'Builder'},
    {id:'signals',  icon:'📡',label:'Signals'},
    {id:'alerts',   icon:'🔔',label:'Alerts'},
    {id:'journal',  icon:'📓',label:'Journal'},
    {id:'reports',  icon:'📊',label:'Reports'},
    {id:'regime',   icon:'🌐',label:'Regime'},
    {id:'billing',  icon:'💳',label:'Billing'},
    {id:'settings', icon:'⚙', label:'Settings'},
    {id:'help',     icon:'❓',label:'Help'},
  ];
  return(
    <Drawer open={open} onClose={onClose} title="All modules">
      <div className="drw-grid">
        {items.map(i=>(
          <button key={i.id} className={cx('drw-btn',page===i.id&&'on')}
            onClick={()=>{ onClose(); go(i.id); }}>
            <span className="drw-btn-ico">{i.icon}</span>{i.label}
          </button>
        ))}
      </div>
    </Drawer>
  );
};

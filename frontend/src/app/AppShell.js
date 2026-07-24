/* ══════════════════════════════════════════════
   QUANTORYX v6 — APP SHELL (backend-integrated)

   Extends the v5 shell WITHOUT modifying it. The v5 components
   (Sidebar, Header, MobNav, PageWrap, PageHd, Empty, Toggle,
   MiniLine, Spark, ChartTip and every v5 page) remain declared
   and are reused; the live pages replace only the data source.
══════════════════════════════════════════════ */

const NAV_V6=[
  {id:'dashboard', icon:'⬛',label:'Dashboard'},
  {id:'strategies',icon:'📋',label:'Strategies'},
  {id:'backtest',  icon:'▶', label:'Backtest'},
  {id:'optimize',  icon:'⚙', label:'Optimize'},
  {id:'ai',        icon:'🤖',label:'AI Assistant',dot:true},
  {id:'builder',   icon:'🧱',label:'Builder',badge:'New'},
  {id:'signals',   icon:'📡',label:'Live Signals'},
  {id:'alerts',    icon:'🔔',label:'Alerts'},
  {id:'portfolio', icon:'💼',label:'Portfolio'},
  {id:'reports',   icon:'📊',label:'Reports'},
  {id:'regime',    icon:'🌐',label:'Market Regime'},
  {id:'journal',   icon:'📓',label:'Trade Journal'},
  {id:'settings',  icon:'⚙', label:'Settings'},
];

const SidebarV6=({page,go,onLogout,wsState})=>(
  <nav className="sb">
    {NAV_V6.map(n=>(
      <button key={n.id} className={cx('sb-nav',page===n.id&&'on')} onClick={()=>go(n.id)}>
        <span className="sb-icon">{n.icon}</span>
        <span className="sb-lbl">{n.label}</span>
        {n.badge&&<span className="sb-badge">{n.badge}</span>}
        {n.dot&&<span className="sb-dot"/>}
      </button>
    ))}
    <div className="sb-spacer"/>
    <div className="sb-ai">
      <div style={{fontSize:22,marginBottom:4}}>🧠</div>
      <div className="sb-ai-title">Quantoryx AI</div>
      <div className="sb-ai-sub">Live decision engine.</div>
      <button className="sb-ai-btn" onClick={()=>go('ai')}>▶ Run AI Analysis →</button>
    </div>
    <div className="sb-footer">
      <div className="row" style={{gap:6,padding:'4px 12px',fontSize:10,color:'var(--tx-3)'}}>
        <span style={{width:7,height:7,borderRadius:'50%',
          background:wsState==='open'?'var(--gr-500)':wsState==='error'?'var(--re-500)':'var(--tx-3)',
          animation:wsState==='open'?'pulse 1.8s infinite':'none'}}/>
        {wsState==='open'?'Live socket':wsState==='error'?'Socket error':'Socket idle'}
      </div>
      <button className={cx('sb-nav',page==='billing'&&'on')} onClick={()=>go('billing')}>
        <span className="sb-icon">💳</span><span className="sb-lbl">Billing</span>
      </button>
      <button className={cx('sb-nav',page==='help'&&'on')} onClick={()=>go('help')}>
        <span className="sb-icon">❓</span><span className="sb-lbl">Help & Docs</span>
      </button>
      <button className="sb-nav" onClick={onLogout}>
        <span className="sb-icon">🚪</span><span className="sb-lbl">Logout</span>
      </button>
    </div>
  </nav>
);

const HeaderV6=({dark,toggleTheme,go,onOpenPalette,user,onLogout,apiUp})=>(
  <header className="hd">
    <div className="hd-logo" onClick={()=>go('dashboard')} style={{cursor:'pointer'}}>
      <div className="hd-logo-icon">Q</div>
      <div style={{display:'flex',flexDirection:'column',lineHeight:1}}>
        <span className="hd-logo-name">QUANTORYX</span>
        <span className="hd-logo-tag">AI-Powered Trading Platform</span>
      </div>
    </div>

    <button className="hd-search" onClick={onOpenPalette}
      style={{border:'1px solid var(--bd)',textAlign:'left',cursor:'text'}} aria-label="Open command palette">
      <span className="hd-search-icon">🔍</span>
      <span style={{flex:1,color:'var(--tx-3)',fontSize:13}}>Search strategies, pages, actions…</span>
      <span className="hd-kbd">Ctrl + K</span>
    </button>

    <div className="hd-gap"/>
    <div className="hd-mkt">
      <div className="hd-dot" style={{background:apiUp?'var(--gr-500)':'var(--re-500)'}}/>
      {apiUp?'API Connected':'API Offline'}
    </div>

    <div className="hd-actions">
      <NotificationBell go={go}/>
      <button className="hd-btn" onClick={toggleTheme} title={dark?'Switch to light mode':'Switch to dark mode'}>
        {dark?'☀️':'🌙'}
      </button>
      <button className="hd-btn" onClick={()=>go('settings')} title="Settings">⚙️</button>
      <ProfileMenu go={go} user={user} onLogout={onLogout} onToggleTheme={toggleTheme} dark={dark}/>
    </div>
  </header>
);

const MobNavV6=({page,go,onMore})=>{
  const primary=[
    {id:'dashboard',i:'⬛',l:'Home'},
    {id:'strategies',i:'📋',l:'Strategy'},
    {id:'ai',i:'🤖',l:'AI Chat'},
    {id:'portfolio',i:'💼',l:'Portfolio'},
  ];
  const inPrimary=primary.some(p=>p.id===page);
  return(
    <nav className="mob-nav">
      <div className="mob-nav-items">
        {primary.map(n=>(
          <button key={n.id} className={cx('mob-btn',page===n.id&&'on')} onClick={()=>go(n.id)}>
            <span className="mob-ico">{n.i}</span>{n.l}
          </button>
        ))}
        <button className={cx('mob-btn',!inPrimary&&'on')} onClick={onMore}>
          <span className="mob-ico">⋯</span>More
        </button>
      </div>
    </nav>
  );
};

/* ══════════════════════════════════════════════
   ROOT — AppV6
══════════════════════════════════════════════ */
const AppV6=()=>{
  const [dark,setDark]=usePersisted('theme.dark',true);
  const [page,setPage]=usePersisted('nav.page','dashboard');
  const [user,setUser]=useState(null);
  const [booting,setBooting]=useState(true);
  const [apiUp,setApiUp]=useState(true);
  const [wsState,setWsState]=useState('idle');
  const [palette,setPalette]=useState(false);
  const [more,setMore]=useState(false);
  const [logoutAsk,setLogoutAsk]=useState(false);
  const [strategies,setStrategies]=useState([]);

  useEffect(()=>{ document.body.classList.toggle('lm',!dark); },[dark]);
  const toggleTheme=useCallback(()=>setDark(d=>!d),[setDark]);

  /* ── Session restore: a stored token means we can skip login ── */
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{ await api.system.health(); if(alive) setApiUp(true); }
      catch{ if(alive) setApiUp(false); }
      if(api.isAuthed()){
        try{ const me=await api.auth.me(); if(alive) setUser(me); }
        catch{ api.tokens.clear(); }
      }
      if(alive) setBooting(false);
    })();
    return()=>{ alive=false; };
  },[]);

  /* ── Forced logout when refresh fails ── */
  useEffect(()=>api.events.subscribe(e=>{
    if(e.type==='logout'){
      setUser(null);
      if(e.reason==='expired') toast.warn('Session expired','Please sign in again.');
    }
  }),[]);

  /* ── Periodic API health probe ── */
  useInterval(()=>{
    api.system.health().then(()=>setApiUp(true)).catch(()=>setApiUp(false));
  },user?45000:null);

  /* ── Strategy catalogue for the command palette ── */
  useEffect(()=>{
    if(!user) return;
    api.strategies.list().then(setStrategies).catch(()=>{});
  },[user]);

  /* ── WebSocket: live prices, orders, notifications ── */
  useEffect(()=>{
    if(!user?.id) return;
    const close=api.ws.connect(user.id,{
      onStatus:setWsState,
      onMessage:m=>{
        if(!m||!m.type) return;
        if(m.type==='NOTIFICATION'){
          toast.info(m.title||'Notification',m.message||'');
        }else if(m.type==='SIGNAL'){
          toast.success('New signal',`${m.symbol||''} ${m.action||''}`.trim());
        }
      },
    });
    return close;
  },[user?.id]);

  const go=useCallback(p=>{
    setPage(p); setPalette(false); setMore(false);
    if(window.location.hash!==`#/${p}`) window.location.hash=`#/${p}`;
  },[setPage]);

  useEffect(()=>{
    const sync=()=>{
      const h=window.location.hash.replace(/^#\/?/,'');
      if(h&&h!==page) setPage(h);
    };
    sync();
    window.addEventListener('hashchange',sync);
    return()=>window.removeEventListener('hashchange',sync);
  },[page,setPage]);

  useHotkeys(useMemo(()=>({
    'ctrl+k':()=>setPalette(p=>!p),
    'ctrl+shift+t':toggleTheme,
    'g d':()=>go('dashboard'), 'g s':()=>go('strategies'),
    'g b':()=>go('backtest'),  'g o':()=>go('optimize'),
    'g a':()=>go('ai'),        'g p':()=>go('portfolio'),
    'g r':()=>go('reports'),   'g j':()=>go('journal'),
    'g l':()=>go('signals'),   '?':()=>go('help'),
  }),[go,toggleTheme]),!!user);

  const doLogout=async()=>{
    setLogoutAsk(false);
    await api.auth.logout();
    setUser(null); setPage('dashboard');
    toast.info('Signed out','See you next session.');
  };

  /* ── Boot splash ── */
  if(booting){
    return(
      <div className="login-page">
        <div className="login-card" style={{textAlign:'center',padding:'40px 30px'}}>
          <div className="login-logo-ico">Q</div>
          <div className="login-title" style={{marginTop:12}}>Quantoryx</div>
          <div className="row" style={{gap:9,justifyContent:'center',marginTop:16,color:'var(--tx-2)',fontSize:12}}>
            <Spinner dark/> Connecting to backend…
          </div>
        </div>
      </div>
    );
  }

  /* ── Protected: everything below requires a session ── */
  if(!user){
    return(
      <>
        {!apiUp&&(
          <div style={{position:'fixed',top:0,left:0,right:0,zIndex:999,padding:'8px 14px',
            background:'rgba(239,68,68,.14)',borderBottom:'1px solid rgba(239,68,68,.3)',
            color:'var(--tx-err)',fontSize:11.5,textAlign:'center',backdropFilter:'blur(10px)'}}>
            ⚠ Backend unreachable at <strong>{api._base}</strong> — start the API server, then sign in.
          </div>
        )}
        <LiveAuthPage onAuthed={setUser}/>
        <ToastHost/>
      </>
    );
  }

  const renderPage=()=>{
    switch(page){
      /* live, backend-bound */
      case 'dashboard':  return <LiveDashboard go={go}/>;
      case 'strategies': return <LiveStrategiesPage go={go}/>;
      case 'backtest':   return <LiveBacktestPage go={go}/>;
      case 'optimize':   return <LiveOptimizePage go={go}/>;
      case 'portfolio':  return <LivePortfolioPage go={go}/>;
      case 'reports':    return <LiveReportsPage/>;
      case 'regime':     return <LiveRegimePage/>;
      case 'ai':         return <LiveAIPage go={go}/>;
      case 'settings':   return <LiveSettingsPage dark={dark} toggleTheme={toggleTheme}
                                  user={user} onUserUpdate={setUser}/>;
      /* fixture-backed until backend routes exist */
      case 'builder':    return <BuilderPage go={go}/>;
      case 'signals':    return <SignalsPage go={go}/>;
      case 'alerts':     return <AlertsPage go={go}/>;
      case 'journal':    return <JournalPage go={go}/>;
      case 'billing':    return <BillingPage go={go}/>;
      case 'help':       return <HelpPage go={go}/>;
      default:           return <NotFoundPage go={go} page={page}/>;
    }
  };

  return(
    <div className={cx('shell',!dark&&'lm')}>
      <HeaderV6 dark={dark} toggleTheme={toggleTheme} go={go} user={user} apiUp={apiUp}
        onOpenPalette={()=>setPalette(true)} onLogout={()=>setLogoutAsk(true)}/>
      <SidebarV6 page={page} go={go} onLogout={()=>setLogoutAsk(true)} wsState={wsState}/>

      <PageWrap k={page}>
        <ErrorBoundary go={go} resetKey={page}>{renderPage()}</ErrorBoundary>
      </PageWrap>

      <MobNavV6 page={page} go={go} onMore={()=>setMore(true)}/>

      <CommandPalette open={palette} onClose={()=>setPalette(false)} go={go}
        onToggleTheme={toggleTheme} pages={NAV_V6}
        strategies={strategies.map(s=>({id:s.id,name:s.name,type:s.type,sharpe:'—',ret:s.key}))}
        reports={[]}/>

      <MobileMoreDrawer open={more} onClose={()=>setMore(false)} page={page} go={go}/>

      <Confirm open={logoutAsk} onClose={()=>setLogoutAsk(false)} onConfirm={doLogout}
        tone="warn" title="Sign out of Quantoryx?" confirmLabel="Sign out"
        body="Your refresh token will be revoked on the server and you'll need to sign in again."/>

      <ToastHost/>
    </div>
  );
};

ReactDOM.render(<AppV6/>,document.getElementById('root'));

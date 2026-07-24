/* ══════════════════════════════════════════════
   QUANTORYX v6 — AUTH SCREENS (live backend)
   POST /api/auth/login · /api/auth/register
   Reuses the v5 .login-* design language exactly.
══════════════════════════════════════════════ */

const LiveAuthPage=({onAuthed})=>{
  const [tab,setTab]=useState('login');
  const [f,setF]=useState({u:'',p:'',email:'',name:'',confirm:''});
  const [err,setErr]=useState('');
  const [errs,setErrs]=useState({});
  const [loading,setLoading]=useState(false);
  const [forgot,setForgot]=useState(false);

  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));

  const submit=async()=>{
    setErr(''); setErrs({});
    const e={};
    if(!f.u.trim()) e.u='Username is required.';
    if(!f.p) e.p='Password is required.';
    if(tab==='register'){
      if(!isEmail(f.email)) e.email='Enter a valid email address.';
      if(pwStrength(f.p)<2) e.p='Choose a stronger password (8+ chars, mixed case, a digit).';
      if(f.p!==f.confirm) e.confirm='Passwords do not match.';
    }
    setErrs(e);
    if(Object.keys(e).length) return;

    setLoading(true);
    try{
      const res=tab==='login'
        ? await api.auth.login({u:f.u.trim(),p:f.p})
        : await api.auth.register({username:f.u.trim(),email:f.email.trim(),password:f.p,fullName:f.name.trim()||f.u.trim()});
      toast.success(tab==='login'?'Welcome back':'Account created',`Signed in as ${res.user.name}.`);
      onAuthed(res.user);
    }catch(ex){
      setErr(ex.status===401?'Invalid credentials. Please try again.':
             ex.status===0||ex.name==='AbortError'?'Cannot reach the backend. Is the API running?':
             ex.message);
    }finally{ setLoading(false); }
  };

  if(forgot) return <ForgotPassword onBack={()=>setForgot(false)}/>;

  return(
    <div className="login-page">
      <div className="login-glow" style={{width:400,height:400,background:'rgba(139,92,246,.07)',top:-100,right:-100}}/>
      <div className="login-glow" style={{width:300,height:300,background:'rgba(59,130,246,.05)',bottom:-80,left:-80}}/>
      <div className="login-card">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div className="login-logo-ico">Q</div>
          <div className="login-title">Welcome to Quantoryx</div>
          <div className="login-sub">AI-Powered Trading Platform v6.0</div>
        </div>

        <div className="login-tabs">
          {['login','register'].map(t=>(
            <button key={t} className={cx('login-tab',tab===t&&'on')}
              onClick={()=>{setTab(t);setErr('');setErrs({});}}>
              {t==='login'?'Sign In':'Register'}
            </button>
          ))}
        </div>

        {err&&<div className="login-err">⚠️ {err}</div>}

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label className="form-lbl">Username</label>
            <input className={cx('login-inp',errs.u&&'inp-err')} placeholder="Enter your username"
              value={f.u} onChange={set('u')} onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/>
            <FieldError>{errs.u}</FieldError>
          </div>

          {tab==='register'&&(
            <>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <label className="form-lbl">Full Name</label>
                <input className="login-inp" placeholder="Your display name" value={f.name} onChange={set('name')}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <label className="form-lbl">Email</label>
                <input className={cx('login-inp',errs.email&&'inp-err')} type="email" placeholder="your@email.com"
                  value={f.email} onChange={set('email')}/>
                <FieldError>{errs.email}</FieldError>
              </div>
            </>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label className="form-lbl">Password</label>
            <input className={cx('login-inp',errs.p&&'inp-err')} type="password" placeholder="••••••••"
              value={f.p} onChange={set('p')} onKeyDown={e=>e.key==='Enter'&&submit()}/>
            {tab==='register'&&<PwMeter value={f.p}/>}
            <FieldError>{errs.p}</FieldError>
          </div>

          {tab==='register'&&(
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label className="form-lbl">Confirm Password</label>
              <input className={cx('login-inp',errs.confirm&&'inp-err')} type="password" placeholder="••••••••"
                value={f.confirm} onChange={set('confirm')} onKeyDown={e=>e.key==='Enter'&&submit()}/>
              <FieldError>{errs.confirm}</FieldError>
            </div>
          )}

          <button className="btn btn-p btn-full" style={{padding:10,fontSize:14,marginTop:6}}
            onClick={submit} disabled={loading}>
            {loading?<><Spinner/> {tab==='login'?'Signing in…':'Creating account…'}</>
                    :(tab==='login'?'→ Sign In':'Create Account')}
          </button>

          {tab==='login'&&(
            <button className="btn btn-g btn-full" style={{padding:8,fontSize:12}} onClick={()=>setForgot(true)}>
              Forgot your password?
            </button>
          )}
        </div>

        <div className="login-demo">
          🔗 Connected to <strong>{api._base}</strong> — real accounts, JWT authentication.
        </div>

        <div className="login-feats">
          {[['🤖','AI Decision Engine'],['📊','Live Analytics'],['⚡','Real Backtesting'],['🛡','JWT Secured']].map(([i,t])=>(
            <div key={t} className="login-feat"><span>{i}</span><span>{t}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
};

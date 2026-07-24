/* ══════════════════════════════════════════════
   QUANTORYX v6 — ERROR STATES
   NotFoundPage · ErrorBoundary · ForgotPassword
══════════════════════════════════════════════ */

/* ── 404 ── */
const NotFoundPage=({go,page})=>(
  <div className="page fade-page">
    <div className="err-page">
      <div className="err-code">404</div>
      <div className="err-ttl">This module doesn’t exist</div>
      <div className="err-sub">
        {page?<>We couldn’t find a page called <strong style={{color:'var(--tx-1)'}}>“{page}”</strong>. </>:null}
        It may have been renamed, or the link that brought you here is out of date.
      </div>
      <div className="err-acts">
        <button className="btn btn-p btn-md" onClick={()=>go('dashboard')}>⬛ Back to Dashboard</button>
        <button className="btn btn-g btn-md" onClick={()=>go('ai')}>🤖 Ask the AI Assistant</button>
        <button className="btn btn-g btn-md" onClick={()=>go('help')}>❓ Help & Docs</button>
      </div>
    </div>
  </div>
);

/* ── Runtime error boundary ── */
class ErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null,info:null,key:p.resetKey}; }
  static getDerivedStateFromError(err){ return {err}; }
  /* Clear the error when the route changes, otherwise one crashing
     page would keep the fallback pinned across every later navigation. */
  static getDerivedStateFromProps(props,state){
    if(props.resetKey!==state.key) return {key:props.resetKey,err:null,info:null};
    return null;
  }
  componentDidCatch(err,info){
    this.setState({info});
    log.error('render','Uncaught error in component tree',
      {error:err?.message,stack:String(err?.stack||'').split('\n').slice(0,4).join(' | '),
       component:String(info?.componentStack||'').trim().split('\n')[0]});
  }
  render(){
    if(!this.state.err) return this.props.children;
    return(
      <div className="page fade-page">
        <div className="err-page">
          <div style={{fontSize:44}}>💥</div>
          <div className="err-ttl">Something broke while rendering</div>
          <div className="err-sub">
            The interface hit an unexpected error. Your data is safe — reloading the module usually clears it.
          </div>
          <div className="err-acts">
            <button className="btn btn-p btn-md" onClick={()=>this.setState({err:null,info:null})}>↻ Try again</button>
            <button className="btn btn-g btn-md" onClick={()=>window.location.reload()}>⟳ Reload app</button>
            {this.props.go&&<button className="btn btn-g btn-md" onClick={()=>{ this.setState({err:null}); this.props.go('dashboard'); }}>⬛ Dashboard</button>}
          </div>
          <pre className="err-trace">{String(this.state.err?.stack||this.state.err)}</pre>
        </div>
      </div>
    );
  }
}

/* ── Forgot password (rendered by the Login screen) ── */
const ForgotPassword=({onBack})=>{
  const [email,setEmail]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const [sent,setSent]=useState(false);

  const submit=async()=>{
    if(!isEmail(email)){ setErr('Enter a valid email address.'); return; }
    setErr(''); setLoading(true);
    await api.auth.forgot(email);
    setLoading(false); setSent(true);
  };

  return(
    <div className="login-page">
      <div className="login-glow" style={{width:400,height:400,background:'rgba(139,92,246,.07)',top:-100,right:-100}}/>
      <div className="login-glow" style={{width:300,height:300,background:'rgba(59,130,246,.05)',bottom:-80,left:-80}}/>
      <div className="login-card">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div className="login-logo-ico">Q</div>
          <div className="login-title">{sent?'Check your inbox':'Reset your password'}</div>
          <div className="login-sub">{sent?'We sent you a secure reset link':'We’ll email you a link to set a new one'}</div>
        </div>

        {sent?(
          <>
            <div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.22)',borderRadius:8,padding:'12px 14px',fontSize:12,color:'var(--tx-ok)',lineHeight:1.7}}>
              ✓ If an account exists for <strong>{email}</strong>, a reset link is on its way. The link expires in 30 minutes.
            </div>
            <button className="btn btn-p btn-full" style={{padding:10,fontSize:14,marginTop:14}} onClick={onBack}>
              ← Back to sign in
            </button>
          </>
        ):(
          <>
            {err&&<div className="login-err">⚠️ {err}</div>}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <label className="form-lbl">Email Address</label>
                <input className={cx('login-inp',err&&'inp-err')} type="email" placeholder="your@email.com"
                  value={email} onChange={e=>setEmail(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/>
              </div>
              <button className="btn btn-p btn-full" style={{padding:10,fontSize:14,marginTop:6}} onClick={submit} disabled={loading}>
                {loading?<><Spinner/> Sending link…</>:'Send reset link'}
              </button>
              <button className="btn btn-g btn-full" style={{padding:9}} onClick={onBack}>← Back to sign in</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   QUANTORYX v6 — LIVE SETTINGS
   GET/PUT /api/portfolio/settings · PUT /api/auth/profile
   POST /api/auth/change-password · GET /api/auth/me
   Reuses v5 .settings-* classes and the Toggle primitive.
══════════════════════════════════════════════ */

const LiveSettingsPage=({dark,toggleTheme,user,onUserUpdate})=>{
  const {symbols,timeframes}=useMarketMeta();
  const st=useAsync(()=>api.portfolio.settings(),[]);
  const [section,setSection]=useState('profile');
  const [form,setForm]=useState(null);
  const [profile,setProfile]=useState({name:user?.name||'',email:user?.email||''});
  const [pw,setPw]=useState({old:'',next:'',confirm:''});
  const [saving,setSaving]=useState(false);
  const [errs,setErrs]=useState({});

  useEffect(()=>{ if(st.data) setForm(st.data); },[st.data]);
  useEffect(()=>{ if(user) setProfile({name:user.name||'',email:user.email||''}); },[user]);

  const nav=[
    {id:'profile',icon:'👤',label:'Profile'},
    {id:'trading',icon:'⚙',label:'Trading'},
    {id:'appearance',icon:'🎨',label:'Appearance'},
    {id:'security',icon:'🛡',label:'Security'},
    {id:'system',icon:'📡',label:'System'},
  ];

  const saveTrading=async()=>{
    setSaving(true);
    try{
      const saved=await api.portfolio.saveSettings(form);
      setForm(saved);
      toast.success('Settings saved','Trading preferences updated on the backend.');
    }catch(e){ toast.error('Save failed',e.message); }
    finally{ setSaving(false); }
  };

  const saveProfile=async()=>{
    const e={};
    if(!profile.name.trim()) e.name='Name cannot be empty.';
    if(!isEmail(profile.email)) e.email='Enter a valid email address.';
    setErrs(e); if(Object.keys(e).length) return;
    setSaving(true);
    try{
      const u=await api.auth.updateProfile(profile);
      onUserUpdate?.(u);
      toast.success('Profile updated','Your details were saved.');
    }catch(err){ toast.error('Update failed',err.message); }
    finally{ setSaving(false); }
  };

  const changePw=async()=>{
    const e={};
    if(!pw.old) e.old='Enter your current password.';
    if(pwStrength(pw.next)<2) e.next='Choose a stronger password.';
    if(pw.next!==pw.confirm) e.confirm='Passwords do not match.';
    setErrs(e); if(Object.keys(e).length) return;
    setSaving(true);
    try{
      await api.auth.changePassword(pw.old,pw.next);
      setPw({old:'',next:'',confirm:''});
      toast.success('Password changed','Use your new password next time you sign in.');
    }catch(err){ toast.error('Change failed',err.message); }
    finally{ setSaving(false); }
  };

  const isAdmin=api.isAdmin();
  const sys=useAsync(()=>Promise.all([
    api.system.health().catch(e=>({error:e.message})),
    api.system.version().catch(e=>({error:e.message})),
    api.system.status().catch(e=>({error:e.message})),
    isAdmin?api.system.systemHealth().catch(e=>({error:e.message})):Promise.resolve(null),
  ]),[isAdmin]);

  return(
    <div className="page fade-page">
      <PageHd title="Settings" sub="Profile, trading preferences, and platform configuration"/>

      <div className="settings-layout">
        <div className="settings-nav">
          {nav.map(n=>(
            <button key={n.id} className={cx('settings-nav-item',section===n.id&&'on')} onClick={()=>setSection(n.id)}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {/* ── Profile ── */}
          {section==='profile'&&(
            <div className="settings-section">
              <div className="settings-section-title">Profile Information</div>
              <div className="settings-section-sub">Synced with <code style={{fontFamily:'JetBrains Mono,monospace'}}>/api/auth/me</code>.</div>
              <div className="avatar-upload" style={{display:'flex',gap:14,alignItems:'center',margin:'14px 0'}}>
                <div className="avatar-lg">{(profile.name||'A').charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--tx-1)'}}>{user?.name||'—'}</div>
                  <div style={{fontSize:11,color:'var(--tx-3)',marginTop:2}}>
                    {user?.role||'user'} · {user?.plan||'Pro'} plan
                  </div>
                  <div style={{fontSize:10,color:'var(--tx-3)',marginTop:2,fontFamily:'JetBrains Mono,monospace'}}>
                    id: {user?.id?.slice(0,8)}…
                  </div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-grp">
                  <label className="form-lbl">Full Name</label>
                  <input className={cx('form-inp',errs.name&&'inp-err')} aria-label="Full name" value={profile.name}
                    onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/>
                  <FieldError>{errs.name}</FieldError>
                </div>
                <div className="form-grp">
                  <label className="form-lbl">Email</label>
                  <input className={cx('form-inp',errs.email&&'inp-err')} aria-label="Email address" value={profile.email}
                    onChange={e=>setProfile(p=>({...p,email:e.target.value}))}/>
                  <FieldError>{errs.email}</FieldError>
                </div>
                <div className="form-grp">
                  <label className="form-lbl">Username</label>
                  <input className="form-inp" aria-label="Username (read only)" value={user?.username||''} disabled/>
                </div>
                <div className="form-grp">
                  <label className="form-lbl">Role</label>
                  <input className="form-inp" aria-label="Role (read only)" value={user?.role||''} disabled/>
                </div>
              </div>
              <button className="btn btn-p btn-md" style={{marginTop:14}} onClick={saveProfile} disabled={saving}>
                {saving?<><Spinner/> Saving…</>:'💾 Save Profile'}
              </button>
            </div>
          )}

          {/* ── Trading ── */}
          {section==='trading'&&(
            <div className="settings-section">
              <div className="settings-section-title">Trading Preferences</div>
              <div className="settings-section-sub">
                Persisted via <code style={{fontFamily:'JetBrains Mono,monospace'}}>PUT /api/portfolio/settings</code>.
              </div>
              {st.loading||!form?<SkelText lines={6}/>:(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}>
                    <div className="form-grp">
                      <label className="form-lbl">Default Symbol</label>
                      <select className="form-sel" value={form.symbol}
                        onChange={e=>setForm(f=>({...f,symbol:e.target.value}))}>
                        {symbols.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="form-grp">
                      <label className="form-lbl">Default Timeframe</label>
                      <select className="form-sel" value={form.timeframe}
                        onChange={e=>setForm(f=>({...f,timeframe:e.target.value}))}>
                        {timeframes.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                    {[['Risk per trade (%)','riskPerTrade'],['Leverage','leverage'],
                      ['Spread','spread'],['AI confidence threshold','confidenceThreshold']].map(([l,k])=>(
                      <div key={k} className="form-grp">
                        <label className="form-lbl">{l}</label>
                        <input className="form-inp" type="number" step="any" aria-label={l} value={form[k]}
                          onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-p btn-md" style={{marginTop:14}} onClick={saveTrading} disabled={saving}>
                    {saving?<><Spinner/> Saving…</>:'💾 Save Trading Settings'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Appearance ── */}
          {section==='appearance'&&(
            <div className="settings-section">
              <div className="settings-section-title">Appearance</div>
              <div className="settings-section-sub">Stored locally in your browser.</div>
              <div className="settings-row" style={{display:'flex',alignItems:'center',padding:'12px 0',borderBottom:'1px solid var(--bd)'}}>
                <div style={{flex:1}}>
                  <div className="settings-row-lbl">Dark mode</div>
                  <div className="settings-row-sub">Toggle between the dark and light theme</div>
                </div>
                <Toggle on={dark} onChange={toggleTheme}/>
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {section==='security'&&(
            <div className="settings-section">
              <div className="settings-section-title">Security</div>
              <div className="settings-section-sub">
                JWT access + refresh tokens. Changing your password revokes existing sessions.
              </div>
              <div style={{display:'grid',gap:12,maxWidth:420,marginTop:12}}>
                <div className="form-grp">
                  <label className="form-lbl">Current Password</label>
                  <input className={cx('form-inp',errs.old&&'inp-err')} type="password" aria-label="Current password" autoComplete="current-password" value={pw.old}
                    onChange={e=>setPw(p=>({...p,old:e.target.value}))}/>
                  <FieldError>{errs.old}</FieldError>
                </div>
                <div className="form-grp">
                  <label className="form-lbl">New Password</label>
                  <input className={cx('form-inp',errs.next&&'inp-err')} type="password" aria-label="New password" autoComplete="new-password" value={pw.next}
                    onChange={e=>setPw(p=>({...p,next:e.target.value}))}/>
                  <PwMeter value={pw.next}/>
                  <FieldError>{errs.next}</FieldError>
                </div>
                <div className="form-grp">
                  <label className="form-lbl">Confirm New Password</label>
                  <input className={cx('form-inp',errs.confirm&&'inp-err')} type="password" aria-label="Confirm new password" autoComplete="new-password" value={pw.confirm}
                    onChange={e=>setPw(p=>({...p,confirm:e.target.value}))}/>
                  <FieldError>{errs.confirm}</FieldError>
                </div>
                <button className="btn btn-p btn-md" onClick={changePw} disabled={saving}>
                  {saving?<><Spinner/> Updating…</>:'🛡 Change Password'}
                </button>
              </div>
            </div>
          )}

          {/* ── System ── */}
          {section==='system'&&(
            <div className="settings-section">
              <div className="settings-section-title">System Health</div>
              <div className="settings-section-sub">Live status from the backend.</div>
              {sys.loading?<SkelText lines={5}/>:(
                <div className="code-prev" style={{marginTop:12}}>
                  {JSON.stringify({health:sys.data?.[0],version:sys.data?.[1],status:sys.data?.[2],
                    ...(sys.data?.[3]?{systemHealth:sys.data[3]}:{})},null,2)}
                </div>
              )}
              {!isAdmin&&(
                <div style={{fontSize:10.5,color:'var(--tx-3)',marginTop:8,lineHeight:1.6}}>
                  🔒 Detailed system diagnostics require an admin role. Signed in as
                  {' '}<strong style={{color:'var(--tx-2)'}}>{user?.role||'user'}</strong>.
                </div>
              )}
              <button className="btn btn-g btn-sm" style={{marginTop:12}} onClick={sys.refetch} aria-label="Refresh system health" title="Refresh">↻ Refresh</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

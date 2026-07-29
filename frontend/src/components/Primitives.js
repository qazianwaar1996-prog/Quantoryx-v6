/* ══════════════════════════════════════════════
   QUANTORYX v6 — UI PRIMITIVES
   Modal · Confirm · Toast · Skeleton · Spinner · Kbd · Drawer
   Styling comes from styles/extensions.css + v5 base classes.
══════════════════════════════════════════════ */

/* ── Kbd chip ── */
const Kbd=({children})=><span className="kbd">{children}</span>;

/* ── Spinner ── */
const Spinner=({dark=false})=><span className={cx('spinner',dark&&'dark')}/>;

/* ── Skeleton primitives (reuse v5 .skel shimmer) ── */
const Skel=({w='100%',h=11,r=4,style})=>(
  <div className="skel" style={{width:w,height:h,borderRadius:r,...style}}/>
);
const SkelText=({lines=3,w=['100%','92%','70%']})=>(
  <div className="stack">
    {Array.from({length:lines},(_,i)=><Skel key={i} w={w[i%w.length]} style={{marginBottom:8}}/>)}
  </div>
);
const SkelCard=({rows=3})=>(
  <div className="card card-p">
    <div className="skel-row">
      <Skel w={30} h={30} r="50%"/>
      <div style={{flex:1}}><Skel w="45%" h={11}/><Skel w="28%" h={9} style={{marginTop:6}}/></div>
    </div>
    <SkelText lines={rows}/>
  </div>
);
const SkelTable=({rows=6,cols=5})=>(
  <div className="stack" style={{gap:2}}>
    {Array.from({length:rows},(_,r)=>(
      <div key={r} className="row" style={{gap:10,padding:'9px 4px',borderBottom:'1px solid var(--bd)'}}>
        {Array.from({length:cols},(_,c)=><Skel key={c} w={c===0?'18%':'14%'} h={10}/>)}
      </div>
    ))}
  </div>
);

/* ── Modal ── */
const Modal=({open,onClose,title,sub,icon='◆',size='',children,footer,closeOnOverlay=true})=>{
  const ref=useRef(null);
  useScrollLock(open);
  useFocusTrap(open,ref);
  useEffect(()=>{
    if(!open) return;
    const onKey=e=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[open,onClose]);
  if(!open) return null;
  return(
    <div className="ov" onMouseDown={e=>{ if(closeOnOverlay&&e.target===e.currentTarget) onClose(); }}>
      <div ref={ref} className={cx('mdl-w',size)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mdl-hd">
          <div className="mdl-hd-ico">{icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="mdl-ttl">{title}</div>
            {sub&&<div className="mdl-sub">{sub}</div>}
          </div>
          <button className="mdl-x" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="mdl-bd">{children}</div>
        {footer&&<div className="mdl-ft">{footer}</div>}
      </div>
    </div>
  );
};

/* ── Confirm dialog ── */
const Confirm=({open,onClose,onConfirm,title,body,confirmLabel='Confirm',tone='danger',loading=false})=>{
  const ico=tone==='danger'?'🗑':tone==='warn'?'⚠':'ℹ';
  return(
    <Modal open={open} onClose={onClose} size="sm" title={title} icon={ico}
      footer={
        <>
          <button className="btn btn-g btn-md" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={cx('btn','btn-md',tone==='danger'?'btn-d':'btn-p')} onClick={onConfirm} disabled={loading}>
            {loading?<><Spinner/> Working…</>:confirmLabel}
          </button>
        </>
      }>
      <div className={cx('cf-ico',tone)}>{ico}</div>
      <div style={{fontSize:12.5,color:'var(--tx-2)',lineHeight:1.75,textAlign:'center'}}>{body}</div>
    </Modal>
  );
};

/* ══════════════════════════════════════════════
   TOAST SYSTEM
   Global bus so any component can call toast.success(...)
   without prop-drilling. Upgrades the single v5 .toast.
══════════════════════════════════════════════ */
const ToastBus=(()=>{
  let listeners=[];
  const emit=t=>listeners.forEach(l=>l(t));
  const push=(tone,title,message)=>emit({id:uid(),tone,title,message});
  return{
    subscribe(fn){ listeners.push(fn); return()=>{ listeners=listeners.filter(l=>l!==fn); }; },
    success:(t,m)=>push('ok',t,m),
    error:  (t,m)=>push('err',t,m),
    warn:   (t,m)=>push('warn',t,m),
    info:   (t,m)=>push('info',t,m),
  };
})();
const toast=ToastBus;

const TOAST_ICON={ok:'✓',err:'✕',warn:'⚠',info:'ℹ'};

const ToastHost=({duration=4200})=>{
  const [items,setItems]=useState([]);
  useEffect(()=>ToastBus.subscribe(t=>{
    setItems(p=>[...p,t].slice(-4));
    setTimeout(()=>setItems(p=>p.filter(x=>x.id!==t.id)),duration);
  }),[duration]);
  const dismiss=id=>setItems(p=>p.filter(x=>x.id!==id));
  if(!items.length) return null;
  return(
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map(t=>(
        <div key={t.id} className={cx('toast-i',t.tone)}>
          <span className="toast-ico">{TOAST_ICON[t.tone]}</span>
          <div style={{flex:1,minWidth:0}}>
            <div className="toast-t">{t.title}</div>
            {t.message&&<div className="toast-m">{t.message}</div>}
          </div>
          <button className="toast-x" onClick={()=>dismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
};

/* ── Bottom drawer (mobile "More" sheet) ── */
const Drawer=({open,onClose,title,children})=>{
  const ref=useDismiss(open,onClose);
  useScrollLock(open);
  if(!open) return null;
  return(
    <div className="ov" style={{alignItems:'flex-end'}}>
      <div ref={ref} className="drw" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drw-grab"/>
        {title&&<div className="drw-ttl">{title}</div>}
        {children}
      </div>
    </div>
  );
};

/* ── Inline field error + password meter ── */
const FieldError=({children})=>children?<div className="field-err">⚠ {children}</div>:null;

const PwMeter=({value})=>{
  const s=pwStrength(value);
  const cls=s<=1?'w':s<=2?'m':'s';
  const lbl=!value?'':s<=1?'Weak':s<=2?'Fair':s<=3?'Good':'Strong';
  const col=s<=1?'var(--tx-err)':s<=2?'var(--tx-wrn)':'var(--tx-ok)';
  return(
    <div>
      <div className="pw-meter">
        {[0,1,2,3].map(i=><div key={i} className={cx('pw-seg',i<s&&cls)}/>)}
      </div>
      {lbl&&<div className="pw-lbl" style={{color:col}}>{lbl} password</div>}
    </div>
  );
};

/* ── Copy button ── */
const CopyBtn=({text,label='Copy'})=>{
  const [copied,copy]=useCopy();
  return <button className="copy-btn" onClick={()=>copy(text)}>{copied?'✓ Copied':label}</button>;
};

/* ── Highlighted text for search results ── */
const Highlight=({text,q})=>(
  <>{splitMatch(text,q).map((p,i)=>p.m?<mark key={i} className="hl">{p.t}</mark>:<span key={i}>{p.t}</span>)}</>
);

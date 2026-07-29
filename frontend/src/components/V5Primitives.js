/* ══════════════════════════════════════════════
   QUANTORYX v6 — v5 SHARED PRIMITIVES (verbatim)

   Extracted BYTE-FOR-BYTE from Quantoryx-v5-Complete.html so the
   production bundle can drop the ~110 KB of v5 page code that the
   live backend-bound pages replaced, without changing a single
   pixel of the design system.

   Source lines in the v5 base:
     ChartTip  ~1044   PageHd  ~2269   Empty    ~2279
     Toggle    ~2290   MiniLine ~2299  PageWrap ~2174

   Do not restyle. These are the canonical v5 components.
══════════════════════════════════════════════ */

const ChartTip=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return(
    <div className="chart-tip">
      <div className="tip-lbl">{label}</div>
      {payload.map((p,i)=>(
        <div key={i} className="tip-row">
          <div className="tip-dot" style={{background:p.color}}/>
          <span style={{color:'var(--tx-2)'}}>{p.name}</span>
          <span className="tip-val">${(p.value/1000).toFixed(1)}K</span>
        </div>
      ))}
    </div>
  );
};

const PageHd=({title,sub,children})=>(
  <div className="pg-hd">
    <div><div className="pg-title">{title}</div>{sub&&<div className="pg-sub">{sub}</div>}</div>
    {children&&<div className="pg-acts">{children}</div>}
  </div>
);

const Empty=({icon,title,sub})=>(
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'40px 20px',textAlign:'center'}}>
    <div style={{fontSize:40}}>{icon}</div>
    <div style={{fontSize:14,fontWeight:700,color:'var(--tx-1)'}}>{title}</div>
    <div style={{fontSize:12,color:'var(--tx-2)',maxWidth:280,lineHeight:1.6}}>{sub}</div>
  </div>
);

const Toggle=({on,onChange})=>(
  <button className={`toggle ${on?'on':'off'}`} onClick={()=>onChange(!on)} role="switch" aria-checked={!!on}>
    <div className="toggle-thumb"/>
  </button>
);

const MiniLine=({data,color,height=60})=>(
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{top:4,right:0,bottom:0,left:0}}>
      <defs>
        <linearGradient id={`mg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={.25}/>
          <stop offset="95%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={1.5} fill={`url(#mg${color.replace('#','')})`} dot={false}/>
    </AreaChart>
  </ResponsiveContainer>
);

const PageWrap=({k,children})=>{
  const [vis,setVis]=useState(false);
  useEffect(()=>{setVis(false);const t=requestAnimationFrame(()=>requestAnimationFrame(()=>setVis(true)));return()=>cancelAnimationFrame(t);},[k]);
  return(
    <div className="page-wrap" style={{opacity:vis?1:0,transform:vis?'none':'translateY(5px)',transition:'opacity .22s ease,transform .22s ease'}}>
      {children}
    </div>
  );
};

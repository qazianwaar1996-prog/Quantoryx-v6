/* ══════════════════════════════════════════════
   QUANTORYX v6 — SHARED HOOKS
   Depends on: React (UMD global), utils.js
══════════════════════════════════════════════ */

/* ── Close on outside click / Escape ── */
const useDismiss=(open,onClose)=>{
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const onDown=e=>{ if(ref.current&&!ref.current.contains(e.target)) onClose(); };
    const onKey=e=>{ if(e.key==='Escape'){ e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown',onDown);
    document.addEventListener('keydown',onKey);
    return()=>{ document.removeEventListener('mousedown',onDown); document.removeEventListener('keydown',onKey); };
  },[open,onClose]);
  return ref;
};

/* ── Lock body scroll while an overlay is open ── */
const useScrollLock=locked=>{
  useEffect(()=>{
    if(!locked) return;
    const prev=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{ document.body.style.overflow=prev; };
  },[locked]);
};

/* ── Trap focus inside an overlay (a11y) ── */
const useFocusTrap=(open,ref)=>{
  useEffect(()=>{
    if(!open||!ref.current) return;
    const node=ref.current;
    const sel='button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const first=node.querySelectorAll(sel)[0];
    first?.focus?.();
    const onKey=e=>{
      if(e.key!=='Tab') return;
      const f=[...node.querySelectorAll(sel)].filter(el=>!el.disabled&&el.offsetParent!==null);
      if(!f.length) return;
      const a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); }
      else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); }
    };
    node.addEventListener('keydown',onKey);
    return()=>node.removeEventListener('keydown',onKey);
  },[open,ref]);
};

/* ── Async data loader with loading / error / refetch ── */
const useAsync=(fn,deps=[])=>{
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [nonce,setNonce]=useState(0);
  useEffect(()=>{
    let alive=true;
    setLoading(true); setError(null);
    Promise.resolve(fn())
      .then(d=>{ if(alive){ setData(d); setLoading(false); } })
      .catch(e=>{ if(alive){ setError(e); setLoading(false); } });
    return()=>{ alive=false; };
  },[...deps,nonce]);
  return {data,loading,error,refetch:()=>setNonce(n=>n+1),setData};
};

/* ── Persisted state (safe if storage is unavailable) ── */
const usePersisted=(key,initial)=>{
  const [v,setV]=useState(()=>{
    try{ const raw=localStorage.getItem(`qx.${key}`); return raw?JSON.parse(raw):initial; }
    catch{ return initial; }
  });
  useEffect(()=>{
    try{ localStorage.setItem(`qx.${key}`,JSON.stringify(v)); }catch{}
  },[key,v]);
  return [v,setV];
};

/* ── Global hotkeys. map: {'ctrl+k':fn,'esc':fn,'g d':fn} ── */
const useHotkeys=(map,enabled=true)=>{
  const seq=useRef({key:'',at:0});
  useEffect(()=>{
    if(!enabled) return;
    const onKey=e=>{
      const tag=(e.target.tagName||'').toLowerCase();
      const typing=tag==='input'||tag==='textarea'||e.target.isContentEditable;
      const k=e.key.toLowerCase();
      const combo=`${e.ctrlKey||e.metaKey?'ctrl+':''}${e.shiftKey?'shift+':''}${k==='escape'?'esc':k}`;
      if(map[combo]){ e.preventDefault(); map[combo](e); seq.current={key:'',at:0}; return; }
      if(typing) return;
      // two-key sequences e.g. "g d"
      const now=Date.now();
      if(seq.current.key&&now-seq.current.at<900){
        const pair=`${seq.current.key} ${k}`;
        if(map[pair]){ e.preventDefault(); map[pair](e); seq.current={key:'',at:0}; return; }
      }
      seq.current=/^[a-z]$/.test(k)?{key:k,at:now}:{key:'',at:0};
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[map,enabled]);
};


/* ── Debounced value (search inputs) ── */
const useDebounced=(value,ms=220)=>{
  const [v,setV]=useState(value);
  useEffect(()=>{ const t=setTimeout(()=>setV(value),ms); return()=>clearTimeout(t); },[value,ms]);
  return v;
};

/* ── setInterval that respects re-renders (live tickers) ── */
const useInterval=(fn,ms)=>{
  const saved=useRef(fn);
  useEffect(()=>{ saved.current=fn; },[fn]);
  useEffect(()=>{
    if(ms==null) return;
    const id=setInterval(()=>saved.current(),ms);
    return()=>clearInterval(id);
  },[ms]);
};

/* ── Copy to clipboard with transient "copied" flag ── */
const useCopy=(ms=1600)=>{
  const [copied,setCopied]=useState(false);
  const copy=useCallback(async text=>{
    try{ await navigator.clipboard.writeText(text); }
    catch{
      const ta=document.createElement('textarea');
      ta.value=text; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch{}
      document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(()=>setCopied(false),ms);
  },[ms]);
  return [copied,copy];
};

/* ══════════════════════════════════════════════
   QUANTORYX v6 — UTILITIES
   Pure helpers. No React, no DOM side-effects.
══════════════════════════════════════════════ */

/* ── Formatters ── */
const fmtMoney=(n,dp=2)=>{
  const s=n<0?'−':'';
  return `${s}$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp})}`;
};
const fmtPct=(n,dp=2)=>`${n>=0?'+':'−'}${Math.abs(n).toFixed(dp)}%`;
const fmtNum=(n,dp=0)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp});
const fmtTime=d=>new Date(d).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
const fmtDate=d=>new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const relTime=d=>{
  const s=Math.floor((Date.now()-new Date(d).getTime())/1000);
  if(s<60) return 'just now';
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  if(s<604800) return `${Math.floor(s/86400)}d ago`;
  return fmtDate(d);
};

/* ── Class name join (matches v5 template-literal style) ── */
const cx=(...a)=>a.filter(Boolean).join(' ');

/* ── Colour helper mirroring v5 .up/.down/.neu ── */
const dirClass=n=>n>0?'up':n<0?'down':'neu';

/* ── Fuzzy match for the command palette / global search ── */
const fuzzy=(needle,hay)=>{
  if(!needle) return true;
  const n=needle.toLowerCase(),h=String(hay).toLowerCase();
  if(h.includes(n)) return true;
  let i=0;
  for(const ch of h){ if(ch===n[i]) i++; if(i===n.length) return true; }
  return false;
};

/* ── Highlight matched substring → array of React-safe parts ── */
const splitMatch=(text,q)=>{
  if(!q) return [{t:text,m:false}];
  const i=String(text).toLowerCase().indexOf(q.toLowerCase());
  if(i<0) return [{t:text,m:false}];
  return [
    {t:text.slice(0,i),m:false},
    {t:text.slice(i,i+q.length),m:true},
    {t:text.slice(i+q.length),m:false},
  ].filter(p=>p.t);
};

/* ── Misc ── */
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const uid=()=>Math.random().toString(36).slice(2,10);
const pwStrength=p=>{
  let s=0;
  if(p.length>=8) s++;
  if(/[A-Z]/.test(p)&&/[a-z]/.test(p)) s++;
  if(/\d/.test(p)) s++;
  if(/[^A-Za-z0-9]/.test(p)) s++;
  return clamp(s,0,4);
};
const isEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

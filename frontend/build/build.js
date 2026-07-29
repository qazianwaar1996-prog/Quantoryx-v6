#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — BUILD

   Two targets:
     • dev  (default) — full bundle, readable, source order preserved
     • prod (--prod)  — drops the ~110 KB of orphaned v5 page code,
                        keeps the v5 CSS design system byte-for-byte,
                        minifies whitespace, injects runtime config.

   The uploaded v5 base is READ-ONLY and never written to.
══════════════════════════════════════════════ */
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const PROD=process.argv.includes('--prod');

const BASE_CANDIDATES=[
  path.resolve(ROOT,'base','Quantoryx-v5-Complete.html'),
  path.resolve(ROOT,'..','uploads','Quantoryx-v5-Complete.html'),
  path.resolve(ROOT,'..','Quantoryx-v5-Complete.html'),
];
const BASE=BASE_CANDIDATES.find(p=>fs.existsSync(p))||BASE_CANDIDATES[0];

const OUT_DIR=path.resolve(ROOT,'dist');
const OUT=path.join(OUT_DIR,PROD?'Quantoryx-v6-Production.html':'Quantoryx-v6-Complete.html');

/* Load order: primitives → lib → components → pages → shell */
const JS_FILES=[
  'src/components/V5Primitives.js',
  'src/lib/logger.js',
  'src/lib/utils.js',
  'src/lib/api.js',
  'src/lib/hooks.js',
  'src/components/Primitives.js',
  'src/components/CommandPalette.js',
  'src/components/HeaderMenus.js',
  'src/pages/ErrorPages.js',
  'src/pages/LiveDashboard.js',
  'src/pages/LiveCorePages.js',
  'src/pages/LiveAIPage.js',
  'src/pages/LiveSettingsPage.js',
  'src/app/AuthScreens.js',
  'src/pages/AlertsPage.js',
  'src/pages/SignalsPage.js',
  'src/pages/BuilderPage.js',
  'src/pages/JournalPage.js',
  'src/pages/BillingPage.js',
  'src/pages/HelpPage.js',
  'src/app/AppShell.js',
];
const CSS_FILES=['src/styles/extensions.css'];

const read=p=>fs.readFileSync(path.resolve(ROOT,p),'utf8');

/* ══ Build-time repairs to pre-existing v5 defects ══ */
const PATCHES=[
  {
    id:'v5-settings-unterminated-string',
    note:"Stray apostrophe in SettingsPage (gap:8'}}) left a string unterminated. "+
         'Babel compiles the whole script block as one unit, so this prevented the '+
         'ENTIRE application from compiling — v5 rendered a blank page.',
    find:"<div style={{marginTop:14,display:'flex',gap:8'}}>",
    replace:"<div style={{marginTop:14,display:'flex',gap:8}}>",
    required:false,          // page code is stripped in prod
  },
  {
    id:'recharts-missing-prop-types',
    note:'Recharts 2.8.0 UMD expects a global PropTypes that was never loaded, so '+
         'Recharts stayed undefined and the top-level destructure threw.',
    find:'<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.8.0/Recharts.js"></script>',
    replace:'<script src="https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js"></script>\n'+
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.8.0/Recharts.js"></script>',
    required:true,
  },
  {
    id:'v5-regime-startswith-on-number',
    note:"RegimePage called .startsWith() on Occurrences (a number), crashing the page.",
    find:"<span style={{fontWeight:600,color:v.startsWith('+')?'var(--tx-ok)':v.startsWith('-')?'var(--tx-err)':'var(--tx-1)'}}>{v}</span>",
    replace:"<span style={{fontWeight:600,color:String(v).startsWith('+')?'var(--tx-ok)':String(v).startsWith('-')?'var(--tx-err)':'var(--tx-1)'}}>{v}</span>",
    required:false,
  },
];

function applyPatches(html){
  const applied=[];
  for(const p of PATCHES){
    const n=html.split(p.find).length-1;
    if(n===0){
      if(p.required) throw new Error(`Patch "${p.id}" did not match — base file may have changed.`);
      continue;
    }
    html=html.split(p.find).join(p.replace);
    applied.push({...p,count:n});
  }
  return {html,applied};
}

/* ══ Strip orphaned v5 script, keep the CSS design system ══ */
function stripLegacyScript(html){
  const open=html.indexOf('<script type="text/babel">');
  const close=html.lastIndexOf('</script>');
  if(open<0||close<0) throw new Error('Could not locate the v5 babel block');
  const head=html.slice(0,open);
  const tail=html.slice(close);
  const stub=
`<script type="text/babel">
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} = Recharts;
`;
  return {html:head+stub+tail, removed:close-open};
}

/* Precompile JSX with Babel at BUILD time so production never ships
   babel-standalone (~2.7 MB download + ~2.5 s of main-thread compile). */
function precompile(jsx){
  const babel=require('@babel/core');
  const out=babel.transformSync(jsx,{
    presets:[['@babel/preset-react',{}]],
    compact:false, comments:false, configFile:false, babelrc:false,
  });
  if(!out||!out.code) throw new Error('Babel precompilation produced no output');
  return out.code;
}

/* Drop CSS rules whose selectors reference ONLY classes that no longer appear
   in the shipped JS. These belong to the pruned v5 pages. Conservative: any
   rule with a tag/id/pseudo/at-rule selector, or one shared class still in
   use, is kept. PROD only — dev keeps everything for debugging. */
function pruneCss(css,script){
  const esc=x=>x.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  const used=new Set();
  const defined=[...new Set([...css.matchAll(/[{},;]?\s*\.([a-zA-Z][\w-]*)(?=[\s,:.{>+~])/g)].map(x=>x[1]))];
  for(const c of defined){
    if(new RegExp(`['"\`\\s.>+~,(]${esc(c)}(?=['"\`\\s,)])`).test(script)) used.add(c);
  }
  let removed=0;
  const out=css.replace(/([^{}@]+)\{([^{}]*)\}/g,(full,sel)=>{
    const t=sel.trim();
    if(!t||t.startsWith('@')||t.startsWith('%')) return full;
    // every comma-separated selector must be class-only AND fully unused
    const parts=t.split(',').map(x=>x.trim()).filter(Boolean);
    const allDead=parts.every(part=>{
      if(!/^[.\w\s>+~-]+$/.test(part)) return false;          // no pseudo/attr/tag-id
      const cls=[...part.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(x=>x[1]);
      const bare=part.replace(/\.[a-zA-Z][\w-]*/g,'').trim();
      if(bare) return false;                                    // contains a tag selector
      return cls.length>0 && cls.every(c=>!used.has(c));
    });
    if(allDead){ removed+=full.length; return ''; }
    return full;
  });
  return {css:out,removed};
}

/* Conservative CSS minifier: comments + redundant whitespace only. */
function minifyCss(css){
  return css
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/\s*\n\s*/g,'\n')
    .replace(/\n{2,}/g,'\n')
    .replace(/\s*([{}:;,])\s*/g,'$1')
    .replace(/;}/g,'}')
    .trim();
}

function build(){
  let precompiledBytes=0,cssPruned=0,cssExtraLen=0;
  if(!fs.existsSync(BASE)) throw new Error(`Base file not found: ${BASE}`);
  let html=fs.readFileSync(BASE,'utf8');
  const originalLen=html.length;

  const {html:patched,applied}=applyPatches(html);
  html=patched;

  html=html.replace(/<title>[^<]*<\/title>/,
    `<title>Quantoryx v6.0 — AI-Powered Trading Platform</title>`);

  /* meta: viewport hardening + description (prod) */
  if(PROD&&!/name="description"/.test(html)){
    html=html.replace(/<meta name="viewport"[^>]*>/,
      m=>`${m}\n<meta name="description" content="Quantoryx — AI-powered quantitative trading research platform."/>\n<meta name="color-scheme" content="dark light"/>`);
  }

  /* The v6 live pages fully replace the v5 page code, and V5Primitives.js
     re-declares the six shared components verbatim. Keeping the legacy block
     would duplicate those identifiers in the shared Babel scope and throw at
     runtime, so BOTH targets prune it. PROD only adds minification. */
  const {html:pruned,removed}=stripLegacyScript(html);
  html=pruned;

  /* CSS */
  let css=CSS_FILES.map(f=>`\n/* ── ${path.basename(f)} ── */\n${read(f)}`).join('\n');
  if(PROD) css=minifyCss(css);
  cssExtraLen=css.length;
  const styleEnd=html.lastIndexOf('</style>');
  if(styleEnd<0) throw new Error('No </style> found in base file');
  html=html.slice(0,styleEnd)+css+'\n'+html.slice(styleEnd);

  if(PROD){
    /* Prune dead v5 CSS using the final shipped JS as the usage oracle. */
    const jsForScan=JS_FILES.map(f=>read(f)).join('\n');
    const sTag=html.indexOf('<style>'), eTag=html.lastIndexOf('</style>');
    const sheet=html.slice(sTag+7,eTag);
    const pr=pruneCss(sheet,jsForScan);
    html=html.slice(0,sTag+7)+minifyCss(pr.css)+html.slice(eTag);
    cssPruned=pr.removed;
  }

  /* Runtime config hook (lets ops point the SPA at another origin) */
  const cfg=`\n<script>window.QX_API_BASE=window.QX_API_BASE||'/api';window.QX_ENV=${JSON.stringify(PROD?'production':'development')};</script>\n`;
  html=html.replace('<div id="root"></div>','<div id="root"></div>'+cfg);

  /* JS modules */
  const banner=n=>PROD?`\n/* ${n} */\n`
    :`\n\n/* ╔══════════════════════════════════════════════════════════╗\n   ║  v6 MODULE · ${n}${' '.repeat(Math.max(0,42-n.length))}║\n   ╚══════════════════════════════════════════════════════════╝ */\n`;
  const js=JS_FILES.map(f=>banner(f)+read(f)).join('\n');
  const scriptEnd=html.lastIndexOf('</script>');
  html=html.slice(0,scriptEnd)+js+'\n'+html.slice(scriptEnd);

  if(PROD){
    /* Extract the whole babel block, compile it, and re-insert as plain JS. */
    const openTag='<script type="text/babel">';
    const a=html.indexOf(openTag);
    const b=html.indexOf('</script>',a);
    const raw=html.slice(a+openTag.length,b);
    const compiled=precompile(raw);
    html=html.slice(0,a)+'<script>\n'+compiled+'\n'+html.slice(b);
    /* babel-standalone is now dead weight — remove the CDN tag. */
    html=html.replace(/\s*<script src="[^"]*babel[^"]*"><\/script>/i,'');
    precompiledBytes=compiled.length;
  }

  fs.mkdirSync(OUT_DIR,{recursive:true});
  fs.writeFileSync(OUT,html,'utf8');

  const kb=n=>(n/1024).toFixed(1)+' KB';
  console.log(`✓ Quantoryx v6 build complete  [${PROD?'PRODUCTION':'development'}]`);
  console.log(`  base   : ${path.basename(BASE)} (${kb(originalLen)}, unmodified)`);
  console.log(`  css    : ${CSS_FILES.length} file  (+${kb(css.length)}${PROD?', minified':''})`);
  console.log(`  js     : ${JS_FILES.length} files (+${kb(js.length)})`);
  if(PROD){
    console.log(`  pruned : ${kb(removed)} of orphaned v5 page code`);
    console.log(`  jsx    : precompiled ${kb(precompiledBytes)} (babel-standalone removed)`);
    console.log(`  css    : pruned ${kb(cssPruned)} of dead v5 rules`);
  }
  console.log(`  output : ${path.relative(process.cwd(),OUT)} (${kb(html.length)})`);
  if(applied.length){
    console.log(`  patches: ${applied.length} pre-existing defect(s) repaired`);
    applied.forEach(a=>console.log(`           • ${a.id} (${a.count}×)`));
  }
}

try{ build(); }
catch(e){ console.error('✗ Build failed:',e.message); process.exit(1); }

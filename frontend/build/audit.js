#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — PHASE 7 CODE AUDIT
   Static analysis over the built bundle:
     • dead code (declared, never referenced)
     • duplicate identifiers
     • unused CSS classes
     • accessibility gaps in v6 markup
     • bundle composition
══════════════════════════════════════════════ */
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const FILE=process.env.QX_AUDIT_FILE||path.join(ROOT,'dist','Quantoryx-v6-Complete.html');
const html=fs.readFileSync(FILE,'utf8');

const script=html.slice(
  html.indexOf('>',html.indexOf('<script type="text/babel">'))+1,
  html.lastIndexOf('</script>'));
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');

const V6_MARK='v6 MODULE';
const v6Start=script.indexOf(V6_MARK);
const v5=script.slice(0,v6Start<0?script.length:v6Start);
const v6=v6Start<0?'':script.slice(v6Start);

const kb=n=>(n/1024).toFixed(1)+' KB';
console.log('══ BUNDLE ══');
console.log(`  total html   ${kb(html.length)}`);
console.log(`  css          ${kb(css.length)}`);
console.log(`  v5 script    ${kb(v5.length)}`);
console.log(`  v6 script    ${kb(v6.length)}`);

/* ── declarations ── */
const declRe=/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const decl=new Map();
let m;
while((m=declRe.exec(script))) decl.set(m[1],(decl.get(m[1])||0)+1);

console.log('\n══ DEAD CODE (declared, referenced ≤1×) ══');
const dead=[];
for(const [name] of decl){
  const uses=(script.match(new RegExp(`\\b${name.replace(/\$/g,'\\$')}\\b`,'g'))||[]).length;
  if(uses<=1) dead.push({name,uses,inV6:v6.includes(`const ${name}`)||v6.includes(`function ${name}`)});
}
if(dead.length){
  dead.sort((a,b)=>Number(a.inV6)-Number(b.inV6));
  dead.forEach(d=>console.log(`  ${d.inV6?'[v6]':'[v5]'} ${d.name}  (${d.uses} ref)`));
  console.log(`  → ${dead.length} unreferenced top-level identifier(s)`);
}else console.log('  none');

/* ── duplicates ── */
console.log('\n══ DUPLICATE DECLARATIONS ══');
const dupes=[...decl].filter(([,c])=>c>1);
dupes.length?dupes.forEach(([n,c])=>console.log(`  ✗ ${n} ×${c}`)):console.log('  none');

/* ── unused CSS ── */
console.log('\n══ UNUSED CSS CLASSES ══');
const defined=new Set([...css.matchAll(/[{},;]?\s*\.([a-zA-Z][\w-]*)(?=[\s,:.{>+~])/g)].map(x=>x[1]));
/* A class counts as used if it appears as a quoted token, inside a template
   literal, or as a cx() argument. Escape regex metachars in the name. */
const esc=x=>x.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
const unused=[...defined].filter(c=>{
  const n=esc(c);
  return !new RegExp(`['"\`\\s.>+~,(]${n}(?=['"\`\\s,)])`).test(script);
});
let deadCssBytes=0,deadRules=0;
for(const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const sel=m[1].trim();
  const classes=[...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(x=>x[1]);
  if(classes.length&&classes.every(c=>unused.includes(c))){ deadCssBytes+=m[0].length; deadRules++; }
}
console.log(`  defined ${defined.size} · unused ${unused.length} · fully-dead rules ${deadRules} (${(deadCssBytes/1024).toFixed(1)} KB)`);
if(unused.length) console.log('  '+unused.slice(0,30).join(' '));

/* ── accessibility scan of v6 markup ── */
console.log('\n══ ACCESSIBILITY (v6 markup) ══');
const iconOnly=[...v6.matchAll(/<button([^>]*)>\s*\{?['"]?([🔔⚙️☀️🌙✕✎🗑↻⬇🔍⋯▶⏸])/gu)];
const noLabel=iconOnly.filter(x=>!/aria-label|title=/.test(x[1]));
noLabel.length?console.log(`  ⚠ ${noLabel.length} icon-only button(s) without aria-label/title`)
              :console.log('  ✓ icon-only buttons labelled');
const inputs=[...v6.matchAll(/<input(?![^>]*type=["']hidden)([^>]*)>/g)];
const unlabelled=inputs.filter(x=>!/aria-label|placeholder|id=/.test(x[1]));
unlabelled.length?console.log(`  ⚠ ${unlabelled.length} input(s) with no label affordance`)
                 :console.log(`  ✓ all ${inputs.length} inputs have a label affordance`);
console.log(`  dialogs with role/aria-modal: ${(v6.match(/aria-modal=/g)||[]).length}`);
console.log(`  aria-label attributes in v6:  ${(v6.match(/aria-label=/g)||[]).length}`);

/* ── console.* left in shipping code ── */
console.log('\n══ LOGGING ══');
const logs=[...script.matchAll(/console\.(log|debug|info|warn|error)\(/g)].map(x=>x[1]);
const tally=logs.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{});
console.log('  '+(Object.keys(tally).length?JSON.stringify(tally):'none'));

/* ── inline style density (perf smell) ── */
const inlineStyles=(v6.match(/style=\{\{/g)||[]).length;
console.log(`\n══ INLINE STYLE OBJECTS IN v6: ${inlineStyles} ══`);

console.log('\n'+'─'.repeat(54));
console.log(`dead=${dead.length} dupes=${dupes.length} unusedCss=${unused.length}`);

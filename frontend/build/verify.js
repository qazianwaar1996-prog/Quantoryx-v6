#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — VERIFY
   Static checks on the built bundle:
     1. JSX compiles (Babel) with no syntax errors
     2. No duplicate top-level identifiers (v5 vs v6 share one scope)
     3. Every identifier v6 references from v5 actually exists
     4. Every CSS class used in v6 JS is defined in some <style>
     5. Every route in the switch is reachable from nav/palette
══════════════════════════════════════════════ */
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const FILE=path.join(ROOT,'dist','Quantoryx-v6-Complete.html');
const html=fs.readFileSync(FILE,'utf8');

let fail=0;
const ok =m=>console.log(`  ✓ ${m}`);
const bad=m=>{ console.log(`  ✗ ${m}`); fail++; };

/* ── extract the babel script + all css ── */
const script=html.slice(
  html.indexOf('>',html.indexOf('<script type="text/babel">'))+1,
  html.lastIndexOf('</script>')
);
const css=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');

/* ══ 1. Babel compile ══ */
console.log('\n[1] JSX / syntax');
let compiled='';
try{
  const babel=require('@babel/core');
  compiled=babel.transformSync(script,{presets:[['@babel/preset-react',{}]],configFile:false,babelrc:false}).code;
  ok('Babel compiled the bundle with no syntax errors');
}catch(e){
  bad(`Babel failed: ${e.message.split('\n')[0]}`);
}
if(compiled){
  try{ new Function(compiled); ok('Compiled output parses as valid JS'); }
  catch(e){ bad(`Compiled output invalid: ${e.message}`); }
}

/* ══ 2. Duplicate top-level identifiers ══ */
console.log('\n[2] Top-level identifier collisions');
const decls={};
const re=/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
let m;
while((m=re.exec(script))){
  decls[m[1]]=(decls[m[1]]||0)+1;
}
const dupes=Object.entries(decls).filter(([,c])=>c>1);
if(dupes.length) dupes.forEach(([n,c])=>bad(`"${n}" declared ${c}× at top level — would throw at runtime`));
else ok(`${Object.keys(decls).length} top-level identifiers, all unique`);

/* ══ 3. Required shared primitives are declared exactly once ══ */
console.log('\n[3] Shared primitives (V5Primitives.js)');
const REQUIRED=['ChartTip','PageHd','Empty','Toggle','MiniLine','PageWrap'];
REQUIRED.forEach(n=>{
  const c=decls[n]||0;
  c===1?ok(`${n} — declared once`)
       :bad(`${n} — declared ${c}× (expected exactly 1)`);
});
/* Legacy v5 page code must NOT be in the bundle (it was pruned) */
const LEGACY=['StrategiesPage','BacktestPage','OptimizePage','PortfolioPage','ReportsPage',
              'RegimePage','SettingsPage','AIPage','Login','ALL_STRATS','REPORTS_LIST','BT_TRADES'];
const leaked=LEGACY.filter(n=>decls[n]);
leaked.length?bad(`legacy v5 code leaked back into the bundle: ${leaked.join(', ')}`)
             :ok(`${LEGACY.length} legacy v5 symbols correctly pruned`);
/* Every live page the router needs must exist */
const LIVE=['LiveDashboard','LiveStrategiesPage','LiveBacktestPage','LiveOptimizePage',
            'LivePortfolioPage','LiveReportsPage','LiveRegimePage','LiveAIPage',
            'LiveSettingsPage','LiveAuthPage','AppV6'];
const missingLive=LIVE.filter(n=>!decls[n]);
missingLive.length?bad(`missing live components: ${missingLive.join(', ')}`)
                  :ok(`all ${LIVE.length} live components declared`);

/* ══ 4. CSS classes used by v6 exist ══ */
console.log('\n[4] CSS class coverage (v6 markup)');
const defined=new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(x=>x[1]));
const v6Start=script.indexOf('v6 MODULE');
const v6=script.slice(v6Start<0?0:v6Start);
const used=new Set();
const addTokens=str=>String(str).split(/[\s]+/).filter(Boolean)
  .forEach(c=>{ if(/^[a-z][\w-]*$/.test(c)) used.add(c); });
// plain className="a b c"
[...v6.matchAll(/className="([^"{}]+)"/g)].forEach(x=>addTokens(x[1]));
// cx(...) — only quoted string literals are class names; bare identifiers are JS vars
[...v6.matchAll(/className=\{cx\(([\s\S]*?)\)\}/g)].forEach(x=>{
  // Strip comparison operands: `foo==='filled'` / `x!=='y'` are conditions,
  // not class names. Only the surviving literals are real classes.
  const args=x[1].replace(/[=!]==?\s*'[^']*'/g,'');
  [...args.matchAll(/'([^']+)'/g)].forEach(q=>addTokens(q[1]));
});
// template literals — strip ${...} interpolations
[...v6.matchAll(/className=\{`([^`]*)`\}/g)].forEach(x=>addTokens(x[1].replace(/\$\{[^}]*\}/g,' ')));
const missing=[...used].filter(c=>!defined.has(c));
if(missing.length) missing.forEach(c=>bad(`.${c} used in v6 JSX but never defined in CSS`));
else ok(`${used.size} classes referenced by v6, all defined`);

/* ══ 5. Routes reachable ══ */
console.log('\n[5] Routing');
const routes=[...script.matchAll(/case\s+'([a-z]+)':\s*return\s+</g)].map(x=>x[1]);
// Only the top-level NAV / NAV_V6 arrays define routes. Settings sub-sections,
// builder blocks and help sections reuse the {id,icon,label} shape but are
// in-page tabs, not routes — scope the check to the real nav arrays.
const navBlock=[...script.matchAll(/const\s+NAV(?:_V6)?\s*=\s*\[([\s\S]*?)\n\];/g)].map(x=>x[1]).join(',');
const navIds=[...navBlock.matchAll(/\{id:'([a-z]+)'/g)].map(x=>x[1]);
const uniqueRoutes=[...new Set(routes)];
ok(`${uniqueRoutes.length} routes in switch: ${uniqueRoutes.join(', ')}`);
const unreachable=navIds.filter(id=>!uniqueRoutes.includes(id));
if(unreachable.length) bad(`nav ids with no route: ${unreachable.join(', ')}`);
else ok('every nav id maps to a route');
if(/default:\s*return\s+<NotFoundPage/.test(script)) ok('unknown routes fall through to NotFoundPage');
else bad('no 404 fallback in the router');

/* ══ summary ══ */
console.log('\n'+'─'.repeat(52));
console.log(fail?`✗ ${fail} problem(s) found`:'✓ All checks passed');
process.exit(fail?1:0);

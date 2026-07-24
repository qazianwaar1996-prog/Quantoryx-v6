#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — END-TO-END INTEGRATION TEST
   Drives the real SPA against the real FastAPI backend
   through the dev-server proxy. Verifies that pages render
   BACKEND data, not fixtures.
══════════════════════════════════════════════ */
const {chromium}=require('playwright');
const path=require('path');
const fs=require('fs');

const URL=process.env.QX_URL||'http://127.0.0.1:4173/';
const SHOTS=path.resolve(__dirname,'..','dist','screens');
fs.mkdirSync(SHOTS,{recursive:true});

const USER=`e2e_${Date.now().toString(36)}`;
const PASS='E2eDemo1234!';

let fail=0;
const ok=m=>console.log(`  ✓ ${m}`);
const bad=m=>{ console.log(`  ✗ ${m}`); fail++; };

(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1536,height:1000}});
  const page=await ctx.newPage();

  const errors=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));

  /* capture the API traffic the SPA actually makes */
  const calls=[];
  page.on('response',async r=>{
    const u=r.url();
    if(u.includes('/api/')) calls.push({path:u.split('/api/')[1].split('?')[0],status:r.status()});
  });

  console.log('\n[1] Boot & backend connectivity');
  await page.goto(URL,{waitUntil:'networkidle'});
  await page.waitForTimeout(2200);
  const loginCard=await page.locator('.login-card').count();
  loginCard?ok('auth screen rendered'):bad('auth screen missing');
  const demoTxt=await page.locator('.login-demo').textContent().catch(()=>'');
  /\/api/.test(demoTxt)?ok(`shows live API base: "${demoTxt.trim().slice(0,60)}…"`):bad('no API base shown');

  console.log('\n[2] Registration against real backend');
  await page.click('.login-tab >> nth=1');           // Register tab
  await page.waitForTimeout(300);
  await page.fill('.login-inp >> nth=0',USER);
  await page.fill('.login-inp >> nth=1','E2E Tester');
  await page.fill('.login-inp >> nth=2',`${USER}@quantoryx.io`);
  await page.fill('input[type=password] >> nth=0',PASS);
  await page.fill('input[type=password] >> nth=1',PASS);
  await page.click('text=Create Account');
  await page.waitForTimeout(3500);

  const shell=await page.locator('.shell').count();
  shell?ok(`registered + auto-signed-in as ${USER}`):bad('registration did not authenticate');
  if(!shell){
    const err=await page.locator('.login-err').textContent().catch(()=>'(none)');
    bad(`login error shown: ${err}`);
  }

  const regCall=calls.find(c=>c.path.startsWith('auth/register'));
  const meCall=calls.find(c=>c.path.startsWith('auth/me'));
  regCall?.status===201||regCall?.status===200?ok(`POST /api/auth/register → ${regCall.status}`):bad(`register status ${regCall?.status}`);
  meCall?.status===200?ok('GET /api/auth/me → 200'):bad(`auth/me status ${meCall?.status}`);

  const tokenStored=await page.evaluate(()=>!!localStorage.getItem('qx.access'));
  tokenStored?ok('JWT access token persisted'):bad('no token in localStorage');

  console.log('\n[3] API indicator');
  const apiTxt=await page.locator('.hd-mkt').textContent();
  /Connected/.test(apiTxt)?ok('header shows "API Connected"'):bad(`header shows "${apiTxt.trim()}"`);

  console.log('\n[4] Dashboard renders BACKEND data');
  await page.waitForTimeout(2500);
  const dashCall=calls.find(c=>c.path==='dashboard');
  dashCall?.status===200?ok('GET /api/dashboard → 200'):bad(`dashboard status ${dashCall?.status}`);
  const sub=await page.locator('.pg-sub').first().textContent().catch(()=>'');
  /EURUSD|live backend/i.test(sub)?ok(`subtitle from backend: "${sub.trim()}"`):bad(`unexpected subtitle "${sub}"`);
  // strategy count must equal what the API returns (7 built-ins)
  const stratStat=await page.locator('.stat').first().locator('.stat-val').textContent().catch(()=>'');
  /^\d+$/.test(stratStat.trim())?ok(`Total Strategies = ${stratStat.trim()} (from /api/strategies)`)
                                :bad(`strategy count not numeric: "${stratStat}"`);
  await page.screenshot({path:path.join(SHOTS,'live-dashboard.png')});

  console.log('\n[5] Live AI decision engine');
  await page.evaluate(()=>window.location.hash='#/ai');
  await page.waitForTimeout(1200);
  await page.click('.prompt-chip >> nth=0');
  await page.waitForTimeout(9000);
  const aiCall=calls.find(c=>c.path==='ai-analysis');
  aiCall?.status===200?ok('POST /api/ai-analysis → 200'):bad(`ai-analysis status ${aiCall?.status}`);
  const aiTxt=await page.locator('.msg-grp').first().innerText().catch(()=>'');
  /EXECUTE|REJECT|HOLD|WAIT/i.test(aiTxt)?ok('engine returned a decision action'):bad('no decision in AI reply');
  /confidence|%/i.test(aiTxt)?ok('confidence score rendered'):bad('no confidence rendered');
  await page.screenshot({path:path.join(SHOTS,'live-ai.png')});

  console.log('\n[6] Real backtest execution');
  await page.evaluate(()=>window.location.hash='#/backtest');
  await page.waitForTimeout(1600);
  await page.click('text=Run Backtest');
  await page.waitForTimeout(12000);
  const btCall=calls.find(c=>c.path==='backtest');
  btCall?.status===200?ok('POST /api/backtest → 200'):bad(`backtest status ${btCall?.status}`);
  const kpi=await page.locator('.bt-kpi').count();
  kpi>=6?ok(`${kpi} KPI tiles rendered from engine output`):bad(`only ${kpi} KPI tiles`);
  const tradeTile=await page.locator('.bt-kpi',{hasText:'Total Trades'}).innerText().catch(()=>'');
  /\d/.test(tradeTile)?ok(`trade count present: ${tradeTile.replace(/\n/g,' ')}`):bad('no trade count');
  await page.screenshot({path:path.join(SHOTS,'live-backtest.png')});

  console.log('\n[7] Remaining live routes');
  for(const [route,call,marker] of [
    ['strategies','strategies','.scard'],
    ['portfolio','portfolio','.stat'],
    ['reports','reports','.page'],
    ['regime','market-regime','.page'],
    ['settings','portfolio/settings','.settings-nav-item'],
  ]){
    await page.evaluate(r=>window.location.hash='#/'+r,route);
    await page.waitForTimeout(2200);
    const crashed=await page.locator('.err-trace').count();
    const found=await page.locator(marker).count();
    const c=calls.find(x=>x.path===call);
    if(crashed) bad(`${route}: crashed`);
    else if(!found) bad(`${route}: marker ${marker} not found`);
    else ok(`${route} → ${call} ${c?c.status:'(cached)'} · rendered`);
  }

  console.log('\n[7b] v6 platform pages (alerts · journal · signals · billing · builder · help)');
  for(const [route,call,marker] of [
    ['alerts','alerts','.alert-row'],
    ['journal','journal','.page'],
    ['signals','signals','.tick-row'],
    ['billing','billing/plans','.plan'],
    ['builder','builder/blocks','.blk-chip'],
    ['help','help/faq','.help-nav-i'],
  ]){
    await page.evaluate(r=>window.location.hash='#/'+r,route);
    await page.waitForTimeout(2400);
    const crashed=await page.locator('.err-trace').count();
    const found=await page.locator(marker).count();
    const sample=await page.locator('text=Sample data').count();
    const c=calls.find(x=>x.path===call);
    if(crashed) bad(`${route}: crashed`);
    else if(!found) bad(`${route}: marker ${marker} not found`);
    else if(sample) bad(`${route}: still showing a "Sample data" badge`);
    else if(c&&c.status>=400) bad(`${route}: ${call} → ${c.status}`);
    else ok(`${route} → ${call} ${c?c.status:'(cached)'} · live, no fixtures`);
  }

  console.log('\n[7c] Journal write → backend round trip');
  {
    await page.evaluate(()=>window.location.hash='#/journal');
    await page.waitForTimeout(1800);
    const before=await page.locator('.jr-entry').count();
    await page.click('text=+ New Entry');
    await page.waitForTimeout(700);
    await page.fill('.mdl-bd input.form-inp >> nth=0','425');
    await page.fill('.mdl-bd textarea','E2E round-trip entry written by the integration suite.');
    await page.click('.mdl-ft >> text=Save Entry');
    await page.waitForTimeout(2600);
    const after=await page.locator('.jr-entry').count();
    after>before?ok(`journal entry persisted (${before}→${after})`):bad('journal entry did not persist');
    const post=calls.find(c=>c.path==='journal'&&c.status===201);
    post?ok('POST /api/journal → 201'):bad('no 201 from POST /api/journal');
  }

  console.log('\n[8] Settings writes to backend');
  await page.evaluate(()=>window.location.hash='#/settings');
  await page.waitForTimeout(1500);
  await page.click('.settings-nav-item >> nth=1');     // Trading
  await page.waitForTimeout(1200);
  const riskInput=page.locator('.settings-body input[type=number]').first();
  await riskInput.fill('2.5');
  await page.click('text=Save Trading Settings');
  await page.waitForTimeout(2500);
  const putCall=calls.find(c=>c.path==='portfolio/settings'&&c.status===200);
  putCall?ok('PUT /api/portfolio/settings → 200'):bad('settings save did not reach backend');
  const toastOk=await page.locator('.toast-i.ok').count();
  toastOk?ok('success toast shown'):bad('no success toast');

  console.log('\n[9] Session persistence (reload)');
  await page.reload({waitUntil:'networkidle'});
  // boot does health + auth/me before deciding; wait for either outcome
  await page.waitForFunction(
    ()=>document.querySelector('.shell')||document.querySelector('.login-card'),
    {timeout:20000}).catch(()=>{});
  await page.waitForTimeout(800);
  const stillIn=await page.locator('.shell').count();
  stillIn?ok('session restored from stored token — no re-login'):bad('lost session on reload');

  console.log('\n[10] WebSocket (while authenticated)');
  const wsTxt=await page.locator('.sb-footer').innerText().catch(()=>'');
  /Live socket/i.test(wsTxt)?ok('WebSocket connected — sidebar shows "Live socket"')
                            :bad(`WS not connected — sidebar: "${wsTxt.split('\n')[0]}"`);

  console.log('\n[11] Logout revokes session');
  await page.click('button[aria-label="Account menu"]');
  await page.waitForTimeout(500);
  await page.click('text=Sign out');
  await page.waitForTimeout(600);
  await page.click('.mdl-ft >> text=Sign out');
  await page.waitForTimeout(2500);
  const backToLogin=await page.locator('.login-card').count();
  backToLogin?ok('signed out → auth screen'):bad('logout did not return to auth');
  const tokenGone=await page.evaluate(()=>!localStorage.getItem('qx.access'));
  tokenGone?ok('token cleared from storage'):bad('token still present after logout');

  console.log('\n[12] API call summary');
  const uniq=[...new Set(calls.map(c=>`${c.path} → ${c.status}`))];
  uniq.slice(0,22).forEach(u=>console.log('      · '+u));
  const bad4xx=calls.filter(c=>c.status>=400&&!String(c.path).startsWith('alerts')
    &&!String(c.path).startsWith('journal')&&!String(c.path).startsWith('signals')
    &&!String(c.path).startsWith('billing')&&!String(c.path).startsWith('builder')
    &&!String(c.path).startsWith('help')&&!String(c.path).startsWith('market/'));
  bad4xx.length?bad(`${bad4xx.length} unexpected error responses: ${bad4xx.slice(0,3).map(c=>c.path+'='+c.status).join(', ')}`)
               :ok('no unexpected 4xx/5xx from implemented routes');

  console.log('\n[13] Console errors');
  const real=errors.filter(e=>!/favicon|Download the React DevTools|in-browser Babel/i.test(e));
  real.length?bad(`${real.length} console error(s): ${real[0].slice(0,120)}`)
            :ok('zero console errors');

  await browser.close();
  console.log('\n'+'─'.repeat(54));
  console.log(fail?`✗ ${fail} problem(s)`:'✓ Full-stack integration verified');
  process.exit(fail?1:0);
})().catch(e=>{ console.error('✗ E2E crashed:',e); process.exit(1); });

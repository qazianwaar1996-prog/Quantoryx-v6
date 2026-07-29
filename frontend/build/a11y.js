#!/usr/bin/env node
/* ══════════════════════════════════════════════
   QUANTORYX v6 — RESPONSIVE + ACCESSIBILITY AUDIT
   Runs against the production build with a live backend.
══════════════════════════════════════════════ */
const {chromium}=require('playwright');
const path=require('path');
const fs=require('fs');

const URL=process.env.QX_URL||'http://127.0.0.1:4174/';
const SHOTS=path.resolve(__dirname,'..','dist','screens');
fs.mkdirSync(SHOTS,{recursive:true});

let fail=0;
const ok=m=>console.log(`  ✓ ${m}`);
const bad=m=>{ console.log(`  ✗ ${m}`); fail++; };
const warn=m=>console.log(`  ⚠ ${m}`);

const VIEWPORTS=[
  {n:'mobile-sm',w:320,h:720},
  {n:'mobile',   w:390,h:844},
  {n:'tablet',   w:768,h:1024},
  {n:'laptop',   w:1280,h:800},
  {n:'desktop',  w:1536,h:1000},
];

const login=async(p)=>{
  const u='a11y_'+Date.now().toString(36)+Math.floor(Math.random()*99);
  await p.goto(URL,{waitUntil:'networkidle'});
  await p.waitForSelector('.login-card',{timeout:20000});
  await p.click('.login-tab >> nth=1');
  await p.waitForTimeout(250);
  await p.fill('.login-inp >> nth=0',u);
  await p.fill('.login-inp >> nth=1','A11y Tester');
  await p.fill('.login-inp >> nth=2',`${u}@quantoryx.io`);
  await p.fill('input[type=password] >> nth=0','A11yDemo1234!');
  await p.fill('input[type=password] >> nth=1','A11yDemo1234!');
  await p.click('text=Create Account');
  await p.waitForSelector('.shell',{timeout:25000});
  await p.waitForTimeout(1800);
};

(async()=>{
  const browser=await chromium.launch();

  console.log('\n[1] Responsive layout');
  for(const v of VIEWPORTS){
    const ctx=await browser.newContext({viewport:{width:v.w,height:v.h}});
    const p=await ctx.newPage();
    try{
      await login(p);
      const r=await p.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        sidebar:!!document.querySelector('.sb')&&getComputedStyle(document.querySelector('.sb')).display!=='none',
        mobnav:!!document.querySelector('.mob-nav')&&getComputedStyle(document.querySelector('.mob-nav')).display!=='none',
      }));
      const expectMobile=v.w<=768;
      const navOk=expectMobile?r.mobnav:r.sidebar;
      if(r.overflow>1) bad(`${v.n} (${v.w}px): ${r.overflow}px horizontal overflow`);
      else if(!navOk)  bad(`${v.n} (${v.w}px): wrong nav (sidebar=${r.sidebar} mobnav=${r.mobnav})`);
      else ok(`${v.n} (${v.w}px): no overflow · ${expectMobile?'bottom nav':'sidebar'}`);
      await p.screenshot({path:path.join(SHOTS,`rwd-${v.n}.png`)});
    }catch(e){ bad(`${v.n}: ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }

  console.log('\n[2] Keyboard navigation');
  {
    const ctx=await browser.newContext({viewport:{width:1440,height:900}});
    const p=await ctx.newPage();
    await login(p);

    // Ctrl+K palette
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(400);
    const paletteOpen=await p.locator('.cp-w').count();
    paletteOpen?ok('Ctrl+K opens the command palette'):bad('Ctrl+K did not open');

    // focus should be in the palette input
    const focused=await p.evaluate(()=>document.activeElement?.className||'');
    /cp-inp/.test(focused)?ok('focus moves into the palette input'):warn(`focus is on "${focused}"`);

    // arrow + enter navigation
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(800);
    const navigated=await p.evaluate(()=>location.hash);
    navigated?ok(`keyboard selection navigated to ${navigated}`):bad('keyboard selection did nothing');

    // Escape closes overlays
    await p.keyboard.press('Control+k');
    await p.waitForTimeout(300);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const closed=await p.locator('.cp-w').count();
    closed===0?ok('Escape closes the palette'):bad('Escape did not close the palette');

    // Tab reaches interactive elements with a visible focus ring
    await p.keyboard.press('Tab');
    const ring=await p.evaluate(()=>{
      const el=document.activeElement;
      if(!el||el===document.body) return null;
      const s=getComputedStyle(el);
      return {tag:el.tagName,outline:s.outlineStyle,width:s.outlineWidth};
    });
    ring&&ring.outline!=='none'?ok(`focus ring visible on <${ring.tag.toLowerCase()}> (${ring.width})`)
      :warn(`focus ring not detected (${JSON.stringify(ring)})`);

    // modal focus trap
    await p.evaluate(()=>location.hash='#/alerts');
    await p.waitForTimeout(1500);
    await p.click('text=+ New Alert');
    await p.waitForTimeout(600);
    const trapped=await p.evaluate(()=>{
      const m=document.querySelector('.mdl-w');
      return !!m&&m.contains(document.activeElement);
    });
    trapped?ok('modal traps focus on open'):bad('focus not trapped inside modal');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    const mClosed=await p.locator('.mdl-w').count();
    mClosed===0?ok('Escape closes the modal'):bad('Escape did not close the modal');

    await ctx.close();
  }

  console.log('\n[3] ARIA & semantics');
  {
    const ctx=await browser.newContext({viewport:{width:1440,height:900}});
    const p=await ctx.newPage();
    await login(p);
    const a=await p.evaluate(()=>{
      const btns=[...document.querySelectorAll('button')];
      const unlabelled=btns.filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title'));
      const inputs=[...document.querySelectorAll('input,select,textarea')];
      const noLabel=inputs.filter(i=>!i.getAttribute('aria-label')&&!i.placeholder&&
        !(i.id&&document.querySelector(`label[for="${i.id}"]`))&&!i.closest('label'));
      return {buttons:btns.length,unlabelled:unlabelled.length,
        inputs:inputs.length,noLabel:noLabel.length,
        landmarks:document.querySelectorAll('nav,header,main,[role=dialog]').length,
        live:document.querySelectorAll('[aria-live]').length};
    });
    a.unlabelled===0?ok(`all ${a.buttons} buttons have an accessible name`)
                    :bad(`${a.unlabelled}/${a.buttons} buttons lack an accessible name`);
    a.noLabel===0?ok(`all ${a.inputs} form controls are labelled`)
                 :bad(`${a.noLabel}/${a.inputs} form controls unlabelled`);
    ok(`${a.landmarks} landmark elements · ${a.live} aria-live region(s)`);
    await ctx.close();
  }

  console.log('\n[4] Colour contrast (WCAG AA, body text)');
  {
    for(const theme of ['dark','light']){
      const ctx=await browser.newContext({viewport:{width:1440,height:900}});
      const p=await ctx.newPage();
      await login(p);
      if(theme==='light'){
        await p.click('.hd-btn[title*="light" i]').catch(()=>{});
        await p.waitForTimeout(700);
      }
      const res=await p.evaluate(()=>{
        const lum=c=>{const [r,g,b]=c.match(/[\d.]+/g).slice(0,3).map(Number)
          .map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});
          return .2126*r+.7152*g+.0722*b;};
        /* Composite the ancestor stack: semi-transparent card surfaces must be
           alpha-blended over what is behind them, not treated as opaque. */
        const parse=c=>{const m=(c||'').match(/[\d.]+/g);return m?
          {r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}:null;};
        const bgOf=el=>{
          const layers=[];let n=el;
          while(n&&n!==document.documentElement){
            const c=parse(getComputedStyle(n).backgroundColor);
            if(c&&c.a>0){ layers.push(c); if(c.a===1) break; }
            n=n.parentElement;
          }
          const base=parse(getComputedStyle(document.documentElement).backgroundColor)||{r:255,g:255,b:255,a:1};
          if(!layers.length||layers[layers.length-1].a<1) layers.push({...base,a:1});
          let out=layers.pop();                      // opaque backmost layer
          while(layers.length){                       // composite front-to-back
            const f=layers.pop();
            out={r:f.r*f.a+out.r*(1-f.a), g:f.g*f.a+out.g*(1-f.a), b:f.b*f.a+out.b*(1-f.a), a:1};
          }
          return `rgb(${out.r}, ${out.g}, ${out.b})`;
        };
        const out=[];
        document.querySelectorAll('.pg-title,.card-title,.stat-val,.stat-lbl,.tbl td,.pg-sub').forEach(el=>{
          const t=el.textContent.trim(); if(!t) return;
          const s=getComputedStyle(el);
          const L1=lum(s.color),L2=lum(bgOf(el));
          const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
          const size=parseFloat(s.fontSize), bold=+s.fontWeight>=700;
          const need=(size>=24||(size>=18.66&&bold))?3:4.5;
          out.push({cls:el.className.split(' ')[0],ratio:+ratio.toFixed(2),need,pass:ratio>=need});
        });
        return out;
      });
      const failures=res.filter(r=>!r.pass);
      const worst=res.slice().sort((a,b)=>a.ratio-b.ratio)[0];
      failures.length
        ? warn(`${theme}: ${failures.length}/${res.length} samples below AA (worst .${worst.cls} ${worst.ratio}:1, needs ${worst.need})`)
        : ok(`${theme}: all ${res.length} text samples meet WCAG AA (min ${worst?.ratio}:1)`);
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\n'+'─'.repeat(54));
  console.log(fail?`✗ ${fail} problem(s)`:'✓ Responsive & accessibility checks passed');
  process.exit(fail?1:0);
})().catch(e=>{ console.error('✗ a11y audit crashed:',e); process.exit(1); });

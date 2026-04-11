// tests/canvas-v3/audit-4-browser-explore.mjs
// Canvas V3 UX Audit 4
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const BASE_URL='http://139.196.165.140:8086';
const SSDIR='tests/canvas-v3/screenshots/audit-4';
fs.mkdirSync(SSDIR,{recursive:true});
function log(m){console.log(m);}
function step(m){console.log('');console.log('>>> '+m);}
async function ss(page,name){const f=path.join(SSDIR,name+'.png');await page.screenshot({path:f,fullPage:true}).catch(()=>{});log('  Screenshot: '+f);return f;}
async function waitVue(page,t=12000){await page.waitForFunction(()=>document.body.innerText.trim().length>50,{timeout:t}).catch(()=>{});await page.waitForTimeout(1500);}
async function mkCtx(browser){const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN'});await ctx.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,body:''}));await ctx.route('**/fonts.gstatic.com/**',r=>r.fulfill({status:200,body:''}));return ctx;}
async function doLogin(page,u,pw){
  await page.goto(BASE_URL,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForSelector('input[type=text],input[placeholder]',{timeout:12000}).catch(()=>{});
  await page.waitForTimeout(1000);
  const uInput=await page.locator('input[type=text]').first();
  if(uInput)await uInput.fill(u);
  await page.fill('input[type=password]',pw);
  const loginBtn=await page.locator('button').filter({hasText:/登/}).first();
  if(loginBtn)await loginBtn.click();
  await page.waitForURL(url=>!url.includes('login'),{timeout:12000}).catch(()=>{});
  await page.waitForTimeout(1000);
  const ok=!page.url().includes('login');
  log('  Login '+u+': '+(ok?'OK':'FAIL')+' -> '+page.url());
  return ok;
}
// FLOW A
async function flowA(browser){
  step('FLOW A: Canvas Editor (factory_admin1)');
  const ctx=await mkCtx(browser); const page=await ctx.newPage();
  const errs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  const f={};
  try{
    const ok=await doLogin(page,'factory_admin1','123456');
    f.A1_login=ok?'OK login':'FAIL login'; await ss(page,'flow-a-1-login');
    if(!ok){f.A1_login+=' abort'; return f;}
    await waitVue(page);
    const si=await page.evaluate(()=>Array.from(document.querySelectorAll('.el-menu-item,.el-sub-menu__title,nav a,aside a')).map(e=>e.textContent&&e.textContent.trim()).filter(Boolean).slice(0,20));
    log('  sidebar: '+si.slice(0,8).join(' | '));
    const cvEdVis=await page.locator('text=Canvas 配置编辑器').first().isVisible({timeout:2000}).catch(()=>false);
    const cvVis=await page.locator('text=Canvas').first().isVisible({timeout:2000}).catch(()=>false);
    f.A2_sidebar=cvEdVis?'OK Canvas配置编辑器直接可见':cvVis?'PARTIAL Canvas菜单存在':'FAIL 无Canvas菜单'+si.slice(0,4).join(',');
    if(cvEdVis)await page.locator('text=Canvas 配置编辑器').first().click().catch(()=>{});
    else if(cvVis)await page.locator('text=Canvas').first().click().catch(()=>{});
    await page.waitForTimeout(2000);
    await ss(page,'flow-a-2-sidebar');
    await page.goto(BASE_URL+'/canvas-editor',{waitUntil:'domcontentloaded',timeout:20000});
    await waitVue(page,15000);
    await ss(page,'flow-a-3-canvas-editor-initial');
    const bt=await page.textContent('body');
    const hasTree=await page.locator('.el-tree').first().isVisible({timeout:3000}).catch(()=>false);
    const hasTabs=await page.locator('[role=tablist]').first().isVisible({timeout:2000}).catch(()=>false);
    const nNodes=await page.locator('.el-tree-node__content').count().catch(()=>0);
    f.A3_moduleTree=hasTree?('OK nodes:'+nNodes):('FAIL no tree. body:'+bt.replace(/\s+/g,' ').slice(0,100));
    f.A3_phaseTabs=hasTabs?'OK Phase Tabs visible':'FAIL not found';
    f.A3_treeNodes=nNodes>0?('OK '+nNodes+' nodes'):'FAIL empty tree';
    const aiClasses=['[class*=ai-panel]','[class*=aiPanel]','[class*=chat-panel]','[class*=AiChat]'];
    let hasAI=false;
    for(const s of aiClasses){if(await page.locator(s).first().isVisible({timeout:1000}).catch(()=>false)){hasAI=true;break;}}
    f.A3_aiPanel=hasAI?'OK AI panel visible':'FAIL not found';
    const hdr=await page.evaluate(()=>Array.from(document.querySelectorAll('header,.el-header')).map(e=>e.textContent&&e.textContent.trim()).filter(Boolean).join(' | '));
    f.A3_header='Header:'+hdr.slice(0,100);
    log('  nNodes:'+nNodes+' hasTabs:'+hasTabs+' hasAI:'+hasAI);
    await ss(page,'flow-a-3-interface');
    let soSel=false;
    const ti=await page.locator('.el-tree-node__content').all();
    for(const t of ti){const tx=await t.textContent().catch(()=>' '  );if(tx&&(tx.includes('销售订单')||tx.toLowerCase().includes('sales'))){await t.click().catch(()=>{});await page.waitForTimeout(1500);soSel=true;log('  clicked: '+tx.trim());break;}}
    f.A4_select=soSel?'OK clicked sales_order':'FAIL not in tree';
    await ss(page,'flow-a-4-sales-order');
    const TABS=["工作流","触发链","校验规则","字段","权限","工具"];
    for(const tn of TABS){
      const tabSel="[role=tab]:has-text("+JSON.stringify(tn)+"),.el-tabs__item:has-text("+JSON.stringify(tn)+")";
      const tab=page.locator(tabSel).first();
      const tv=await tab.isVisible({timeout:2000}).catch(()=>false);
      if(tv){await tab.click();await page.waitForTimeout(1500);const tb2=await page.textContent("body");const empty=tb2.includes("暂无数据")||tb2.includes("请选择")||tb2.replace(/s/g,"").length<500;
        await ss(page,"flow-a-5-tab-"+tn.replace(/[^w]/g,"-"));
        f["A5_tab_"+tn]=empty?"WARN empty":"OK has content";}
      else{f["A5_tab_"+tn]="FAIL not visible";}}
    await page.goto(BASE_URL+"/canvas-editor",{waitUntil:"domcontentloaded",timeout:15000});
    await waitVue(page);
    const dReqs=[];
    page.on("request",r=>{const u=r.url();if(u.includes("/canvas")||u.includes("/draft"))dReqs.push(r.method()+" "+u.replace(BASE_URL,"").slice(0,60));});
    const db=page.locator("button").filter({hasText:/新建草稿|保存草稿/}).first();
    const dbv=await db.isVisible({timeout:3000}).catch(()=>false);
    if(dbv){await db.click();await page.waitForTimeout(2000);const apiOk=dReqs.some(r=>r.startsWith("POST")||r.startsWith("PUT"));f.A7_newDraft="OK btn API:"+(apiOk?dReqs[0]:"none");}
    else{f.A7_newDraft="FAIL draft btn not visible";}
    await ss(page,"flow-a-7-draft");
    const ftab=page.locator("[role=tab]:has-text(字段),.el-tabs__item:has-text(字段)").first();
    if(await ftab.isVisible({timeout:3000}).catch(()=>false)){await ftab.click();await page.waitForTimeout(2000);}
    const pal=await page.locator("[class*=field-palette],[class*=fieldPalette]").first().isVisible({timeout:3000}).catch(()=>false);
    const cnv=await page.locator("[class*=form-canvas],[class*=formCanvas]").first().isVisible({timeout:2000}).catch(()=>false);
    const prv=await page.locator("[class*=preview],[class*=Preview]").first().isVisible({timeout:2000}).catch(()=>false);
    const nDrag=await page.locator("[draggable=true],[class*=draggable]").count().catch(()=>0);
    f.A8_fieldPalette=pal?"OK visible":"FAIL not found";
    f.A8_formCanvas=cnv?"OK visible":"FAIL not found";
    f.A8_previewPanel=prv?"OK visible":"FAIL not found";
    f.A8_draggables=nDrag+" draggable items";
    await ss(page,"flow-a-8-field-editor");
  }catch(e){log("  FlowA err:"+e.message);f.ERROR=e.message.slice(0,200);await ss(page,"flow-a-error").catch(()=>{});}
  f._errs=errs.slice(0,5); await ctx.close(); return f;
}

// FLOW B
async function flowB(browser){
  step("FLOW B: DynamicModulePage");
  const ctx=await mkCtx(browser); const page=await ctx.newPage();
  const errs=[]; const f={};
  page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  try{
    const ok=await doLogin(page,"food_3101_038_admin","CanvasTest2026");
    f.B1_login=ok?"OK":"FAIL"; await ss(page,"flow-b-1-login"); if(!ok)return f;
    await page.goto(BASE_URL+"/modules/sales_order",{waitUntil:"domcontentloaded",timeout:20000});
    await waitVue(page,12000);
    const lt=await page.textContent("body");
    const hT=lt.includes("销售订单");
    const hTbl=await page.locator(".el-table,table").first().isVisible({timeout:3000}).catch(()=>false);
    const hNew=await page.locator("button").filter({hasText:/新建/}).first().isVisible({timeout:3000}).catch(()=>false);
    f.B2_listPage="title:"+hT+" table:"+hTbl+" newBtn:"+hNew;
    await ss(page,"flow-b-2-list");
    if(hNew){
      await page.locator("button").filter({hasText:/新建/}).first().click();
      await page.waitForTimeout(3000);
      const fo=await page.locator(".el-dialog,.el-drawer,form").first().isVisible({timeout:2000}).catch(()=>false);
      f.B3_formOpen=fo?"OK form opened":"FAIL no form"; await ss(page,"flow-b-3-form");
    }else{f.B3_formOpen="SKIP no new btn";}
    const flds=await page.evaluate(()=>{
      return Array.from(document.querySelectorAll(".el-form-item")).map(el=>{
        const lbl=(el.querySelector(".el-form-item__label")||{}).textContent||"";
        const s=!!el.querySelector(".el-select");
        const i=!!el.querySelector("input:not([type=hidden])");
        const u=!!el.querySelector(".el-upload,input[type=file]");
        return{label:lbl.trim(),type:s?"select":u?"upload":i?"input":"other"};
      }).filter(x=>x.label);
    });
    log("  form fields:"+JSON.stringify(flds));
    f.B4_formFields=flds.length+" flds: "+flds.map(x=>x.label+"("+x.type+")").join(", ").slice(0,200);
    const bt=await page.textContent("body");
    f.B4_refSel=bt.includes("客户")?"OK customer field":"FAIL no customer";
    await ss(page,"flow-b-4-fields");
    const dynL=["客户等级","交货优先级","预期毛利率","合同附件"];
    const fnd={};for(const l of dynL)fnd[l]=bt.includes(l);
    const cnt=Object.values(fnd).filter(Boolean).length;
    f.B5_dynamicFields=cnt+"/4: "+JSON.stringify(fnd);
    const clf=flds.find(x=>x.label.includes("客户等级"));
    if(clf&&clf.type==="select"){
      const s=page.locator(".el-form-item").filter({hasText:"客户等级"}).locator(".el-select").first();
      if(await s.isVisible({timeout:2000}).catch(()=>false)){
        await s.click(); await page.waitForTimeout(1000);
        const n=await page.locator(".el-select-dropdown__item,.el-option").count().catch(()=>0);
        const txts=await page.locator(".el-select-dropdown__item").allTextContents().catch(()=>[]);
        f.B6_custLevel=n+" options: "+txts.slice(0,5).join(",");
        await page.keyboard.press("Escape");
      }else{f.B6_custLevel="FAIL select not visible";}}
    else{f.B6_custLevel="FAIL not select: "+(clf?clf.type:"not found");}
    await ss(page,"flow-b-6-select");
    const af=flds.find(x=>x.label.includes("合同附件"));
    if(af){const ul=page.locator(".el-form-item").filter({hasText:"合同附件"}).locator(".el-upload").first();const uv=await ul.isVisible({timeout:2000}).catch(()=>false);f.B7_upload=uv?"OK upload visible":"FAIL type="+af.type;}
    else{f.B7_upload="FAIL attachment not found";}
    await ss(page,"flow-b-7-upload");
    const ins=await page.locator(".el-form-item input[type=text]").all();
    if(ins.length>0)await ins[0].fill("Test_"+Date.now()).catch(()=>{});
    const sbtn=page.locator("button").filter({hasText:/提交|确定|保存/}).first();
    const sv=await sbtn.isVisible({timeout:2000}).catch(()=>false);
    if(sv){await sbtn.click();await page.waitForTimeout(3000);const toast=await page.locator(".el-message").first().isVisible({timeout:2000}).catch(()=>false);f.B8_submit="submitted"+sv+" toast:"+toast;}
    else{f.B8_submit="FAIL no submit btn";}
    await ss(page,"flow-b-8-submit");
  }catch(e){log("  FlowB err:"+e.message);f.ERROR=e.message.slice(0,200);await ss(page,"flow-b-error").catch(()=>{});}
  f._errs=errs.slice(0,5); await ctx.close(); return f;
}

// FLOW C
async function flowC(browser){
  step("FLOW C: AI Chat Autopilot");
  const ctx=await mkCtx(browser); const page=await ctx.newPage();
  const errs=[]; const aiReqs=[];
  page.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  page.on("request",r=>{const u=r.url();if(u.includes("/ai")||u.includes("/canvas")||u.includes("/stream"))aiReqs.push(r.method()+" "+u.replace(BASE_URL,"").slice(0,60));});
  const f={};
  try{
    const ok=await doLogin(page,"factory_admin1","123456");
    f.C1_login=ok?"OK":"FAIL"; if(!ok)return f;
    await page.goto(BASE_URL+"/canvas-editor",{waitUntil:"domcontentloaded",timeout:20000});
    await waitVue(page,15000);
    await ss(page,"flow-c-2-canvas");
    const aiSels=["[class*=ai-panel]","[class*=aiPanel]","[class*=chat-panel]","[class*=AiChat]"];
    let aiF=false,aiSel="";
    for(const s of aiSels){if(await page.locator(s).first().isVisible({timeout:1500}).catch(()=>false)){aiF=true;aiSel=s;break;}}
    f.C3_aiPanel=aiF?"OK panel: "+aiSel:"FAIL not found";
    await ss(page,"flow-c-3-ai-panel");
    const apBtn=page.locator("[class*=autopilot],[class*=Autopilot]").first();
    const apF=await apBtn.isVisible({timeout:3000}).catch(()=>false);
    f.C4_autopilot=apF?"OK found":"FAIL not found";
    await ss(page,"flow-c-4-autopilot");
    const textareas=await page.locator("textarea").all();
    let chatInput=null;
    for(const ta of textareas){if(await ta.isVisible({timeout:500}).catch(()=>false)){chatInput=ta;break;}}
    if(chatInput){
      const fn="test_"+Date.now();
      const cmd="add "+fn+" TEXT field";
      await chatInput.click(); await chatInput.fill(cmd);
      const sb=page.locator("button").filter({hasText:/发送|Send/}).first();
      if(await sb.isVisible({timeout:2000}).catch(()=>false))await sb.click();else await page.keyboard.press("Enter");
      await page.waitForTimeout(10000);
      const at=await page.textContent("body");
      const resp=at.includes("canvas_add_field")||at.includes("成功");
      f.C5_cmd="OK sent: "+cmd.slice(0,40);
      f.C5_resp=resp?"OK AI responded":"WARN unclear";
      f.C5_apiCalls=aiReqs.length>0?"OK: "+aiReqs.slice(0,3).join(" | "):"FAIL no AI API calls";
    }else{f.C5_cmd="FAIL no textarea";f.C5_resp="NA";f.C5_apiCalls="NA";}
    await ss(page,"flow-c-5-ai");
  }catch(e){log("  FlowC err:"+e.message);f.ERROR=e.message.slice(0,200);await ss(page,"flow-c-error").catch(()=>{});}
  f._errs=errs.slice(0,5); await ctx.close(); return f;
}

// FLOW D
async function flowD(browser){
  step("FLOW D: Onboarding Wizard");
  const ctx=await mkCtx(browser); const page=await ctx.newPage();
  const errs=[]; const f={};
  try{
    const ok=await doLogin(page,"factory_admin1","123456");
    f.D1_login=ok?"OK":"FAIL"; if(!ok)return f;
    await page.goto(BASE_URL+"/canvas-editor",{waitUntil:"domcontentloaded",timeout:20000});
    await waitVue(page,15000);
    const wzSels=["[class*=onboarding]","[class*=Onboarding]","[class*=wizard]","[class*=Wizard]","[class*=OnboardingWizard]"];
    let wzF=false;
    for(const s of wzSels){if(await page.locator(s).first().isVisible({timeout:2000}).catch(()=>false)){wzF=true;f.D1_wizard="OK wizard: "+s;break;}}
    if(!wzF){
      const dlg=await page.locator(".el-dialog").first().isVisible({timeout:2000}).catch(()=>false);
      const ls=await page.evaluate(()=>localStorage.getItem("onboarding_done")||localStorage.getItem("onboardingComplete")||"not_set");
      f.D1_wizard="FAIL wizard not triggered. dialog:"+dlg+" ls:"+ls;
      const wzDom=await page.evaluate(()=>!!document.querySelector("[class*=onboarding],[class*=wizard],[class*=OnboardingWizard]"));
      f.D1_domCheck=wzDom?"WARN in DOM but hidden":"FAIL not in DOM";
    }
    await ss(page,"flow-d-1-wizard");
    if(wzF){
      for(let i=0;i<4;i++){
        const nb=page.locator("button").filter({hasText:/下一步|完成/}).first();
        if(await nb.isVisible({timeout:2000}).catch(()=>false)){await nb.click();await page.waitForTimeout(1000);await ss(page,"flow-d-2-step-"+(i+1));}
        else break;
      }
    }
    await ss(page,"flow-d-final");
  }catch(e){log("  FlowD err:"+e.message);f.ERROR=e.message.slice(0,200);}
  f._errs=errs.slice(0,5); await ctx.close(); return f;
}

// BONUS: Version History
async function flowVH(browser){
  step("BONUS: Version History");
  const ctx=await mkCtx(browser); const page=await ctx.newPage();
  const f={};
  try{
    await doLogin(page,"factory_admin1","123456");
    await page.goto(BASE_URL+"/canvas-editor",{waitUntil:"domcontentloaded",timeout:20000});
    await waitVue(page,15000);
    const vhS=["[class*=version-history]","[class*=versionHistory]","[class*=VersionHistory]"];
    let vhF=false;
    for(const s of vhS){if(await page.locator(s).first().isVisible({timeout:2000}).catch(()=>false)){vhF=true;await page.locator(s).first().click().catch(()=>{});await page.waitForTimeout(1500);f.versionHistory="OK entry: "+s;break;}}
    const vBtn=page.locator("button").filter({hasText:/版本|历史/}).first();
    if(!vhF&&await vBtn.isVisible({timeout:2000}).catch(()=>false)){vhF=true;await vBtn.click();await page.waitForTimeout(1500);f.versionHistory="OK btn";} 
    if(!vhF)f.versionHistory="FAIL not found";
    const rb=await page.locator("button").filter({hasText:/回滚|恢复/}).first().isVisible({timeout:2000}).catch(()=>false);
    f.rollbackBtn=rb?"OK rollback exists":"FAIL no rollback";
    await ss(page,"flow-bonus-vh");
  }catch(e){f.ERROR=e.message.slice(0,100);}
  await ctx.close(); return f;
}

// MAIN
async function main(){
  log("=======================================================");
  log("  Canvas V3 UX Audit 4 - "+new Date().toISOString());
  log("=======================================================");
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  let rA={},rB={},rC={},rD={},rV={};
  try{rA=await flowA(browser);}catch(e){rA={FATAL:e.message};log("FlowA fatal:"+e.message);}
  try{rB=await flowB(browser);}catch(e){rB={FATAL:e.message};log("FlowB fatal:"+e.message);}
  try{rC=await flowC(browser);}catch(e){rC={FATAL:e.message};log("FlowC fatal:"+e.message);}
  try{rD=await flowD(browser);}catch(e){rD={FATAL:e.message};log("FlowD fatal:"+e.message);}
  try{rV=await flowVH(browser);}catch(e){rV={FATAL:e.message};log("FlowVH fatal:"+e.message);}
  await browser.close();
  const all={flowA:rA,flowB:rB,flowC:rC,flowD:rD,versionHistory:rV};
  log("");log("=======================================================");
  log("  RESULTS");log("=======================================================");
  for(const[fl,res]of Object.entries(all)){
    log("");log("["+fl.toUpperCase()+"]");
    for(const[k,v]of Object.entries(res)){if(!k.startsWith("_"))log("  "+k+": "+String(v).slice(0,130));}
    if(res._errs&&res._errs.length>0)log("  ConsoleErrors("+res._errs.length+"): "+String(res._errs[0]).slice(0,100));
  }
  fs.writeFileSync("tests/canvas-v3/screenshots/audit-4/results.json",JSON.stringify({timestamp:new Date().toISOString(),results:all},null,2));
  log("  JSON saved: tests/canvas-v3/screenshots/audit-4/results.json");
  log("  Screenshots: "+SSDIR);
}
main().catch(e=>{console.error("FATAL:",e);process.exit(1);});


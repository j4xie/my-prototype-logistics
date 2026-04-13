const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({headless:true});
const ctx=await b.newContext();
await ctx.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,body:''}));
await ctx.route('**/fonts.gstatic.com/**',r=>r.fulfill({status:200,body:''}));
const page=await ctx.newPage();
await page.goto('http://139.196.165.140:8086',{waitUntil:'domcontentloaded',timeout:20000});
await page.waitForTimeout(4000);
const pwd=await page.;
console.log('pwd found:',!!pwd);
if(pwd){
  const allInp=await page.10982('input');
  for(const i of allInp){const t=await i.getAttribute('type').catch(()=>'text');if(t!=='password'&&t!=='checkbox')await i.fill('factory_admin1');}
  await page.fill('input[type=password]','123456');
  const btns=await page.10982('button');
  for(const bt of btns){const t=await bt.textContent().catch(()=>'');if(t.includes('登')){await bt.click();break;}}
  await page.waitForTimeout(4000);
  console.log('URL:',page.url());
}
await b.close();
})().catch(e=>console.error('ERR:',e.message));
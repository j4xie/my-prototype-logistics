var fs=require("fs");
var c=fs.readFileSync("tests/canvas-v3/audit-4-browser-explore.mjs","utf8");
var idx=c.indexOf("async function doLogin");
var depth=0,end=idx;
for(var i=idx;i<c.length;i++){if(c[i]==="{")depth++;else if(c[i]==="}")if(--depth===0){end=i+1;break;}}
var lines=[];
lines.push("async function doLogin(page,u,pw){");
lines.push("  await page.goto(BASE_URL,{waitUntil:\"domcontentloaded\",timeout:20000});");
lines.push("  await page.waitForTimeout(3000);");
lines.push("  const allInputs=await page.6884(\"input\");");
lines.push("  for(const inp of allInputs){const tp=await inp.getAttribute(\"type\").catch(()=>\"text\");if(tp!==\"password\"&&tp!==\"checkbox\")await inp.fill(u).catch(()=>{});}");
lines.push("  await page.fill(\"input[type=password]\",pw);");
lines.push("  const allBtns=await page.6884(\"button\");");
lines.push("  for(const b of allBtns){const t=await b.textContent().catch(()=>\"...\");if(t.includes(\"登\")){await b.click().catch(()=>{});break;}}");
lines.push("  await page.waitForTimeout(4000);");
lines.push("  const ok=!page.url().includes(\"login\");");
lines.push("  log(\"  Login \"+u+\": \"+(ok?\"OK\":\"FAIL\")+\" -> \"+page.url());");
lines.push("  return ok;");
lines.push("}");
var newFn=lines.join("
");
fs.writeFileSync("tests/canvas-v3/audit-4-browser-explore.mjs",c.slice(0,idx)+newFn+c.slice(end),"utf8");
console.log("patched");
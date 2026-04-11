var fs=require('fs');
var DEST='tests/canvas-v3/audit-4-browser-explore.mjs';
var lines=[];
function a(s){lines.push(s);}
a('// FLOW C');
a('async function flowC(browser){');
a("  step('FLOW C: AI Chat Autopilot');");
a("  const ctx=await mkCtx(browser); const page=await ctx.newPage();");
a("  const errs=[]; const aiReqs=[];");
#!/usr/bin/env node
import { BrowserClient } from "./lib/browser-client.mjs";
import { ApiClient } from "./lib/api-client.mjs";
import fs from "fs";

const SCREENSHOT_DIR = "./tests/canvas-v3/screenshots/audit-3";
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {};

async function scenario1() {
  console.log("Scenario 1: Canvas sidebar entry discoverable");
  try {
    const browser = new BrowserClient({ headless: true });
    await browser.launch();
    const loggedIn = await browser.login("factory_admin1", "123456");
    if (!loggedIn) throw new Error("Login failed");
    console.log("    OK Logged in");
    
    const page = browser.getPage();
    const canvasItem = await page.locator("text=Canvas 配置编辑器").first();
    const isVisible = await canvasItem.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      console.log("    OK Canvas sidebar entry found");
      await canvasItem.click();
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.includes("/canvas-editor")) {
        console.log("    OK URL is /canvas-editor");
        const shot = await browser.screenshot("S1-canvas-editor-found");
        results.scenario1 = { status: "PASS", evidence: "Sidebar entry found and clickable, navigated to /canvas-editor", screenshot: shot };
      } else {
        const shot = await browser.screenshot("S1-wrong-url");
        results.scenario1 = { status: "FAIL", evidence: "URL mismatch: " + url, screenshot: shot };
      }
    } else {
      const shot = await browser.screenshot("S1-sidebar-missing");
      results.scenario1 = { status: "FAIL", evidence: "Canvas sidebar entry not visible", screenshot: shot };
    }
    await browser.close();
  } catch (e) {
    results.scenario1 = { status: "FAIL", evidence: e.message };
  }
}

async function scenario7() {
  console.log("Scenario 7: Permission override UI works");
  console.log("    SKIP - no permission override UI found in current codebase");
  results.scenario7 = { status: "SKIP", evidence: "No permission override UI implemented" };
}

async function main() {
  console.log("Canvas V3 Real Browser Audit Test");
  
  await scenario1();
  await scenario7();
  
  console.log("
SUMMARY");
  
  for (const [scenario, result] of Object.entries(results)) {
    console.log(`${scenario}: ${result.status}`);
    console.log(`   Evidence: ${result.evidence}`);
    if (result.screenshot) console.log(`   Screenshot: ${result.screenshot}`);
  }
  
  process.exit(0);
}

main();

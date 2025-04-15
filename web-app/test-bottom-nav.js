const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const config = {
  baseUrl: 'http://localhost:3000',
  targetPage: '/pages/home/home-selector.html',
  screenshotsDir: './screenshots',
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

async function testBottomNav() {
  console.log('开始测试底部导航栏问题...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 导航到首页
    console.log(`导航到首页: ${config.baseUrl}${config.targetPage}`);
    await page.goto(`${config.baseUrl}${config.targetPage}`, { 
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // 等待导航栏加载
    await page.waitForSelector('#nav-container', { timeout: 5000 });
    
    // 截取初始状态的截图
    await page.screenshot({ path: path.join(config.screenshotsDir, 'initial_state.png') });
    
    // 获取导航项信息
    const navItems = await page.evaluate(() => {
      const items = document.querySelectorAll('.trace-nav-item');
      return Array.from(items).map(item => ({
        id: item.getAttribute('data-nav-id'),
        text: item.innerText.trim(),
        isActive: item.classList.contains('active'),
        href: item.getAttribute('href')
      }));
    });
    
    console.log('导航项信息:', navItems);
    
    // 测试1: 检查导航栏是否包含所有三个项目
    const hasAllItems = navItems.length === 3;
    console.log(`测试1: 导航栏包含所有3个项目 - ${hasAllItems ? '通过' : '失败'}`);
    
    // 测试2: 点击"信息管理"项
    console.log('点击"信息管理"导航项');
    const infoNavItem = await page.$('.trace-nav-item[data-nav-id="info"]');
    if (infoNavItem) {
      // 截取点击前截图
      await page.screenshot({ path: path.join(config.screenshotsDir, 'before_info_click.png') });
      
      // 记录当前URL
      const currentUrl = page.url();
      
      // 点击"信息管理"
      await infoNavItem.click();
      
      // 等待可能的导航
      await page.waitForTimeout(2000);
      
      // 截取点击后截图
      await page.screenshot({ path: path.join(config.screenshotsDir, 'after_info_click.png') });
      
      // 获取点击后的导航项信息
      const afterClickNavItems = await page.evaluate(() => {
        const items = document.querySelectorAll('.trace-nav-item');
        return Array.from(items).map(item => ({
          id: item.getAttribute('data-nav-id'),
          text: item.innerText.trim(),
          isActive: item.classList.contains('active'),
          href: item.getAttribute('href')
        }));
      });
      
      console.log('点击后导航项信息:', afterClickNavItems);
      
      // 测试2结果: 点击后是否仍有所有三个导航项
      const hasAllItemsAfterClick = afterClickNavItems.length === 3;
      console.log(`测试2: 点击"信息管理"后仍显示所有3个导航项 - ${hasAllItemsAfterClick ? '通过' : '失败'}`);
      
      // 测试3: "信息管理"是否高亮
      const infoItemHighlighted = afterClickNavItems.some(item => 
        item.id === 'info' && item.isActive
      );
      console.log(`测试3: "信息管理"项正确高亮 - ${infoItemHighlighted ? '通过' : '失败'}`);
      
      // 测试4: 导航位置是否正确
      const newUrl = page.url();
      const correctDestination = newUrl.includes('home-farming.html');
      console.log(`测试4: 正确导航到指定页面 - ${correctDestination ? '通过' : '失败'}`);
      
      // 导航回首页继续测试
      if (currentUrl !== newUrl) {
        await page.goto(`${config.baseUrl}${config.targetPage}`, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('错误: 未找到"信息管理"导航项');
    }
    
    // 测试5: 测试点击导航栏空白区域
    console.log('测试点击导航栏空白区域');
    
    // 截取点击前截图
    await page.screenshot({ path: path.join(config.screenshotsDir, 'before_empty_click.png') });
    
    // 记录当前URL
    const currentUrl = page.url();
    
    // 定位导航容器并点击空白区域
    const navContainer = await page.$('.trace-nav-container');
    if (navContainer) {
      // 获取容器尺寸以找到可能的空白区域
      const boundingBox = await navContainer.boundingBox();
      if (boundingBox) {
        // 点击导航容器的空白区域(中间位置，避开导航项)
        await page.mouse.click(
          boundingBox.x + boundingBox.width / 2, 
          boundingBox.y + boundingBox.height / 2
        );
        
        // 等待可能的导航
        await page.waitForTimeout(2000);
        
        // 截取点击后截图
        await page.screenshot({ path: path.join(config.screenshotsDir, 'after_empty_click.png') });
        
        // 获取当前URL
        const newUrl = page.url();
        
        // 测试5结果: 点击空白区域不应该导航
        const noNavigationOnEmptyClick = currentUrl === newUrl;
        console.log(`测试5: 点击空白区域不触发导航 - ${noNavigationOnEmptyClick ? '通过' : '失败'}`);
        
        if (!noNavigationOnEmptyClick) {
          console.log(`  错误: 点击空白区域导航到了 ${newUrl}`);
        }
      }
    } else {
      console.log('错误: 未找到导航容器');
    }
    
    console.log('\n测试完成，请查看结果和截图。');
    console.log(`截图保存在: ${path.resolve(config.screenshotsDir)}`);
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

// 执行测试
testBottomNav().catch(console.error); 
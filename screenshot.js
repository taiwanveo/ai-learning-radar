const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe', headless: true });
  const page = await browser.newPage();
  
  // Set viewport to 16:9 like a standard presentation screenshot
  await page.setViewport({ width: 1280, height: 720 });
  
  try {
    // 1. Dashboard (Home)
    console.log('Navigating to Home...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshot_home.png' });
    console.log('Captured Home');

    // 2. Admin Topics Page
    console.log('Navigating to Admin Topics...');
    await page.goto('http://localhost:3000/admin/(console)/topics', { waitUntil: 'networkidle0', timeout: 30000 });
    // Attempt to bypass auth if it redirects to login
    if (page.url().includes('login')) {
      console.log('Redirected to login. Trying to login...');
      // Actually we might need a valid session. We'll capture login if it redirects
      await page.screenshot({ path: 'screenshot_admin_topics.png' }); 
    } else {
      await page.screenshot({ path: 'screenshot_admin_topics.png' });
    }
    console.log('Captured Admin Topics');

    // 2.5 Admin Channels Page
    console.log('Navigating to Admin Channels...');
    await page.goto('http://localhost:3000/admin/(console)/channels', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshot_admin_channels.png' });
    console.log('Captured Admin Channels');

    // 3. Video Detail Page (if we can find a link)
    console.log('Capturing a video detail...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    const firstVideoLink = await page.$('a[href^="/v/"]');
    if (firstVideoLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        firstVideoLink.click()
      ]);
      await page.screenshot({ path: 'screenshot_video_detail.png' });
      console.log('Captured Video Detail');
      
      // 4. Quiz Interface
      const quizBtn = await page.$('button, a[href*="quiz"]'); // attempt to guess quiz link
      if (quizBtn) {
         await quizBtn.click();
         await page.waitForTimeout(2000);
         await page.screenshot({ path: 'screenshot_quiz.png' });
         console.log('Captured Quiz');
      }
    }

  } catch (err) {
    console.error('Error capturing screenshots:', err);
  } finally {
    await browser.close();
  }
})();

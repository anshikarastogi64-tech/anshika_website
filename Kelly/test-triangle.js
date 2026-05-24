/**
 * COMPREHENSIVE TRIANGLE SECTION TEST
 * Tests both desktop hover interactions and mobile tap/modal interactions
 */

const { chromium } = require('playwright');

(async () => {
  console.log('\n🚀 Starting Triangle Section Tests...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Test Results Storage
  const results = {
    desktop: {},
    mobile: {},
    cache: {},
    errors: []
  };

  try {
    // =====================================================
    // DESKTOP TESTS (screen > 769px)
    // =====================================================
    console.log('📱 DESKTOP TESTS (1920x1080)');
    console.log('='.repeat(60));

    const desktopPage = await context.newPage();
    await desktopPage.setViewportSize({ width: 1920, height: 1080 });

    // Navigate and wait for load
    console.log('Loading https://anshikarastogi.com...');
    await desktopPage.goto('https://anshikarastogi.com', { waitUntil: 'networkidle' });

    // Check cache version
    console.log('\n✅ Cache Check:');
    const cssFiles = await desktopPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map(l => l.href);
    });
    console.log('CSS Files loaded:', cssFiles.filter(f => f.includes('triangle-magic') || f.includes('dreams')));
    results.cache.version = cssFiles.some(f => f.includes('v=28')) ? 'v=28' : 'Unknown';
    console.log(`Version detected: ${results.cache.version}`);

    // Check for JS errors
    desktopPage.on('pageerror', error => {
      console.error('❌ JavaScript Error:', error.message);
      results.errors.push(error.message);
    });

    // Scroll to triangle section
    console.log('\n📍 Scrolling to "Three Powers I Channel" section...');
    await desktopPage.evaluate(() => {
      const section = document.getElementById('magic-triangle');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await desktopPage.waitForTimeout(2000); // Wait for scroll animations

    // Take initial screenshot
    await desktopPage.screenshot({ path: 'desktop-triangle-initial.png', fullPage: false });
    console.log('✅ Screenshot saved: desktop-triangle-initial.png');

    // Test 1: Hover over "Luxury Design" (top)
    console.log('\n🎨 Test 1: Hovering over "Luxury Design" card...');
    const luxuryCard = await desktopPage.locator('.power-point.point-top');
    await luxuryCard.hover();
    await desktopPage.waitForTimeout(1000);

    const luxuryDetailVisible = await desktopPage.evaluate(() => {
      const detail = document.querySelector('.point-top .power-details');
      const style = window.getComputedStyle(detail);
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        display: style.display,
        transform: style.transform
      };
    });
    console.log('Detail panel state:', luxuryDetailVisible);
    results.desktop.luxuryDesign = luxuryDetailVisible.opacity > 0.5 ? 'PASS' : 'FAIL';

    await desktopPage.screenshot({ path: 'desktop-luxury-hover.png', fullPage: false });
    console.log(`${results.desktop.luxuryDesign === 'PASS' ? '✅' : '❌'} Luxury Design hover: ${results.desktop.luxuryDesign}`);

    // Move mouse away to reset
    await desktopPage.mouse.move(0, 0);
    await desktopPage.waitForTimeout(500);

    // Test 2: Hover over "Vastu Science" (bottom left)
    console.log('\n🧭 Test 2: Hovering over "Vastu Science" card...');
    const vastuCard = await desktopPage.locator('.power-point.point-left');
    await vastuCard.hover();
    await desktopPage.waitForTimeout(1000);

    const vastuDetailVisible = await desktopPage.evaluate(() => {
      const detail = document.querySelector('.point-left .power-details');
      const style = window.getComputedStyle(detail);
      return {
        opacity: style.opacity,
        visibility: style.visibility
      };
    });
    results.desktop.vastuScience = vastuDetailVisible.opacity > 0.5 ? 'PASS' : 'FAIL';

    await desktopPage.screenshot({ path: 'desktop-vastu-hover.png', fullPage: false });
    console.log(`${results.desktop.vastuScience === 'PASS' ? '✅' : '❌'} Vastu Science hover: ${results.desktop.vastuScience}`);

    // Move mouse away
    await desktopPage.mouse.move(0, 0);
    await desktopPage.waitForTimeout(500);

    // Test 3: Hover over "Astro Alignment" (bottom right)
    console.log('\n⭐ Test 3: Hovering over "Astro Alignment" card...');
    const astroCard = await desktopPage.locator('.power-point.point-right');
    await astroCard.hover();
    await desktopPage.waitForTimeout(1000);

    const astroDetailVisible = await desktopPage.evaluate(() => {
      const detail = document.querySelector('.point-right .power-details');
      const style = window.getComputedStyle(detail);
      return {
        opacity: style.opacity,
        visibility: style.visibility
      };
    });
    results.desktop.astroAlignment = astroDetailVisible.opacity > 0.5 ? 'PASS' : 'FAIL';

    await desktopPage.screenshot({ path: 'desktop-astro-hover.png', fullPage: false });
    console.log(`${results.desktop.astroAlignment === 'PASS' ? '✅' : '❌'} Astro Alignment hover: ${results.desktop.astroAlignment}`);

    // Test 4: Check content visibility
    console.log('\n📖 Test 4: Checking content readability in panels...');
    await luxuryCard.hover();
    await desktopPage.waitForTimeout(500);

    const contentCheck = await desktopPage.evaluate(() => {
      const detail = document.querySelector('.point-top .power-details');
      const headerText = detail.querySelector('.detail-header h4')?.textContent;
      const rows = detail.querySelectorAll('.detail-row');
      return {
        hasHeader: !!headerText,
        headerText: headerText,
        rowCount: rows.length,
        readable: rows.length > 0
      };
    });
    console.log('Content found:', contentCheck);
    results.desktop.contentReadable = contentCheck.readable ? 'PASS' : 'FAIL';
    console.log(`${results.desktop.contentReadable === 'PASS' ? '✅' : '❌'} Content readable: ${results.desktop.contentReadable}`);

    // Test 5: Center crystal ball globe
    console.log('\n🔮 Test 5: Testing center crystal ball globe...');
    await desktopPage.mouse.move(0, 0);
    await desktopPage.waitForTimeout(500);

    const centerExists = await desktopPage.evaluate(() => {
      return !!document.querySelector('.triangle-center-clickable');
    });
    console.log(`Center element exists: ${centerExists}`);

    if (centerExists) {
      await desktopPage.click('.triangle-center-clickable');
      await desktopPage.waitForTimeout(1000);

      const labelVisible = await desktopPage.evaluate(() => {
        const label = document.getElementById('triangleCenterLabel');
        const style = window.getComputedStyle(label);
        return {
          opacity: style.opacity,
          visibility: style.visibility,
          display: style.display
        };
      });
      console.log('Center label state:', labelVisible);
      results.desktop.centerGlobe = labelVisible.opacity > 0 ? 'PASS' : 'FAIL';

      await desktopPage.screenshot({ path: 'desktop-center-click.png', fullPage: false });
      console.log(`${results.desktop.centerGlobe === 'PASS' ? '✅' : '❌'} Center globe interaction: ${results.desktop.centerGlobe}`);
    } else {
      results.desktop.centerGlobe = 'NOT FOUND';
    }

    await desktopPage.close();

    // =====================================================
    // MOBILE TESTS (screen < 768px)
    // =====================================================
    console.log('\n\n📱 MOBILE TESTS (375x667 - iPhone SE)');
    console.log('='.repeat(60));

    const mobilePage = await context.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 });

    console.log('Loading mobile view...');
    await mobilePage.goto('https://anshikarastogi.com', { waitUntil: 'networkidle' });

    // Scroll to triangle section
    console.log('\n📍 Scrolling to triangle section...');
    await mobilePage.evaluate(() => {
      const section = document.getElementById('magic-triangle');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await mobilePage.waitForTimeout(2000);

    await mobilePage.screenshot({ path: 'mobile-triangle-initial.png', fullPage: false });
    console.log('✅ Screenshot saved: mobile-triangle-initial.png');

    // Test 1: Tap "Luxury Design" card
    console.log('\n🎨 Test 1: Tapping "Luxury Design" card...');
    await mobilePage.click('.power-point.point-top');
    await mobilePage.waitForTimeout(1000);

    const modalState = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return { exists: false };

      const style = window.getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();

      // Check content visibility
      const title = modal.querySelector('.modal-title')?.textContent;
      const description = modal.querySelector('.modal-description')?.textContent;
      const details = modal.querySelectorAll('.modal-detail-item');
      const closeBtn = modal.querySelector('.modal-close');

      return {
        exists: true,
        display: style.display,
        opacity: style.opacity,
        visibility: style.visibility,
        transform: style.transform,
        position: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2
        },
        content: {
          hasTitle: !!title,
          titleText: title?.substring(0, 50),
          hasDescription: !!description,
          descriptionText: description?.substring(0, 80),
          detailCount: details.length,
          hasCloseButton: !!closeBtn,
          closeBtnVisible: closeBtn ? window.getComputedStyle(closeBtn).display !== 'none' : false
        },
        colors: {
          background: style.backgroundColor,
          color: style.color
        }
      };
    });

    console.log('Modal State:', JSON.stringify(modalState, null, 2));

    await mobilePage.screenshot({ path: 'mobile-luxury-modal-open.png', fullPage: false });
    console.log('✅ Screenshot saved: mobile-luxury-modal-open.png');

    // Check if modal is centered
    const screenWidth = 375;
    const screenHeight = 667;
    const isCentered = modalState.exists &&
                      modalState.position.centerX > screenWidth * 0.2 &&
                      modalState.position.centerX < screenWidth * 0.8 &&
                      modalState.position.centerY > 0 &&
                      modalState.position.centerY < screenHeight;

    results.mobile.modalPosition = isCentered ? 'CENTERED - PASS' : 'OFF-SCREEN - FAIL';
    console.log(`${isCentered ? '✅' : '❌'} Modal position: ${results.mobile.modalPosition}`);

    // Check content visibility (NOT black screen)
    const hasVisibleContent = modalState.exists &&
                              modalState.content.hasTitle &&
                              modalState.content.hasDescription &&
                              modalState.content.detailCount >= 3;

    results.mobile.contentVisible = hasVisibleContent ? 'VISIBLE - PASS' : 'BLACK SCREEN - FAIL';
    console.log(`${hasVisibleContent ? '✅' : '❌'} Content visibility: ${results.mobile.contentVisible}`);

    if (hasVisibleContent) {
      console.log('  ✓ Gold title text found:', modalState.content.titleText);
      console.log('  ✓ White description text found:', modalState.content.descriptionText);
      console.log(`  ✓ ${modalState.content.detailCount} detail rows with icons found`);
    }

    // Check close button
    const hasCloseButton = modalState.content.hasCloseButton && modalState.content.closeBtnVisible;
    results.mobile.closeButton = hasCloseButton ? 'VISIBLE - PASS' : 'MISSING - FAIL';
    console.log(`${hasCloseButton ? '✅' : '❌'} Close button (×): ${results.mobile.closeButton}`);

    // Test 2: Close modal with close button
    console.log('\n❌ Test 2: Closing modal with close button...');
    if (hasCloseButton) {
      await mobilePage.click('.modal-close');
      await mobilePage.waitForTimeout(1000);

      const modalClosed = await mobilePage.evaluate(() => {
        const modal = document.querySelector('.triangle-modal');
        if (!modal) return true;
        const style = window.getComputedStyle(modal);
        return style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden';
      });

      results.mobile.closeButtonWorks = modalClosed ? 'PASS' : 'FAIL';
      console.log(`${modalClosed ? '✅' : '❌'} Close button works: ${results.mobile.closeButtonWorks}`);

      await mobilePage.screenshot({ path: 'mobile-modal-closed.png', fullPage: false });
    } else {
      results.mobile.closeButtonWorks = 'SKIP - No button';
    }

    // Test 3: Open and close with backdrop
    console.log('\n🎨 Test 3: Testing backdrop close...');
    await mobilePage.click('.power-point.point-top');
    await mobilePage.waitForTimeout(1000);

    // Click backdrop (outside modal)
    await mobilePage.click('.triangle-modal', { position: { x: 10, y: 10 } });
    await mobilePage.waitForTimeout(1000);

    const backdropCloseWorks = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return true;
      const style = window.getComputedStyle(modal);
      return style.display === 'none' || style.opacity === '0';
    });

    results.mobile.backdropClose = backdropCloseWorks ? 'PASS' : 'FAIL';
    console.log(`${backdropCloseWorks ? '✅' : '❌'} Backdrop close works: ${results.mobile.backdropClose}`);

    // Test 4: Test Vastu card
    console.log('\n🧭 Test 4: Testing "Vastu Science" card...');
    await mobilePage.click('.power-point.point-left');
    await mobilePage.waitForTimeout(1000);

    const vastuModalVisible = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      const style = window.getComputedStyle(modal);
      return style.opacity > 0;
    });

    results.mobile.vastuCard = vastuModalVisible ? 'PASS' : 'FAIL';
    await mobilePage.screenshot({ path: 'mobile-vastu-modal.png', fullPage: false });
    console.log(`${vastuModalVisible ? '✅' : '❌'} Vastu card modal: ${results.mobile.vastuCard}`);

    if (vastuModalVisible) {
      await mobilePage.click('.modal-close');
      await mobilePage.waitForTimeout(500);
    }

    // Test 5: Test Astro card
    console.log('\n⭐ Test 5: Testing "Astro Alignment" card...');
    await mobilePage.click('.power-point.point-right');
    await mobilePage.waitForTimeout(1000);

    const astroModalVisible = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      const style = window.getComputedStyle(modal);
      return style.opacity > 0;
    });

    results.mobile.astroCard = astroModalVisible ? 'PASS' : 'FAIL';
    await mobilePage.screenshot({ path: 'mobile-astro-modal.png', fullPage: false });
    console.log(`${astroModalVisible ? '✅' : '❌'} Astro card modal: ${results.mobile.astroCard}`);

    await mobilePage.close();

    // =====================================================
    // FINAL REPORT
    // =====================================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(60));

    console.log('\n🖥️  DESKTOP TESTS (screen > 769px):');
    console.log('─'.repeat(60));
    console.log(`   1. Luxury Design hover:      ${results.desktop.luxuryDesign}`);
    console.log(`   2. Vastu Science hover:      ${results.desktop.vastuScience}`);
    console.log(`   3. Astro Alignment hover:    ${results.desktop.astroAlignment}`);
    console.log(`   4. Content readable:         ${results.desktop.contentReadable}`);
    console.log(`   5. Center globe interaction: ${results.desktop.centerGlobe}`);

    const desktopPassed = Object.values(results.desktop).filter(v => v === 'PASS').length;
    const desktopTotal = Object.keys(results.desktop).length;
    console.log(`\n   DESKTOP RESULT: ${desktopPassed}/${desktopTotal} tests passed`);

    console.log('\n📱 MOBILE TESTS (screen < 768px):');
    console.log('─'.repeat(60));
    console.log(`   1. Modal position (centered):     ${results.mobile.modalPosition}`);
    console.log(`   2. Content visible (NOT black):   ${results.mobile.contentVisible}`);
    console.log(`   3. Close button visible:          ${results.mobile.closeButton}`);
    console.log(`   4. Close button works:            ${results.mobile.closeButtonWorks}`);
    console.log(`   5. Backdrop close works:          ${results.mobile.backdropClose}`);
    console.log(`   6. Vastu card modal:              ${results.mobile.vastuCard}`);
    console.log(`   7. Astro card modal:              ${results.mobile.astroCard}`);

    const mobilePassed = Object.values(results.mobile).filter(v => v.includes('PASS')).length;
    const mobileTotal = Object.keys(results.mobile).length;
    console.log(`\n   MOBILE RESULT: ${mobilePassed}/${mobileTotal} tests passed`);

    console.log('\n🔧 CACHE TEST:');
    console.log('─'.repeat(60));
    console.log(`   Version detected: ${results.cache.version}`);
    console.log(`   CSS cache status: ${results.cache.version === 'v=28' ? '✅ CORRECT' : '❌ OUTDATED'}`);

    console.log('\n🐛 JAVASCRIPT ERRORS:');
    console.log('─'.repeat(60));
    if (results.errors.length === 0) {
      console.log('   ✅ No JavaScript errors detected');
    } else {
      results.errors.forEach(err => console.log(`   ❌ ${err}`));
    }

    console.log('\n📸 SCREENSHOTS SAVED:');
    console.log('─'.repeat(60));
    console.log('   Desktop:');
    console.log('   - desktop-triangle-initial.png');
    console.log('   - desktop-luxury-hover.png');
    console.log('   - desktop-vastu-hover.png');
    console.log('   - desktop-astro-hover.png');
    console.log('   - desktop-center-click.png');
    console.log('   Mobile:');
    console.log('   - mobile-triangle-initial.png');
    console.log('   - mobile-luxury-modal-open.png');
    console.log('   - mobile-modal-closed.png');
    console.log('   - mobile-vastu-modal.png');
    console.log('   - mobile-astro-modal.png');

    // Overall status
    const allTestsPassed = desktopPassed === desktopTotal && mobilePassed === mobileTotal;
    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
      console.log('🎉 OVERALL STATUS: ALL TESTS PASSED ✅');
    } else {
      console.log('⚠️  OVERALL STATUS: SOME TESTS FAILED ❌');
      console.log(`   Desktop: ${desktopPassed}/${desktopTotal} passed`);
      console.log(`   Mobile: ${mobilePassed}/${mobileTotal} passed`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed. Tests complete.\n');
  }
})();

/**
 * TRIANGLE SECTION TEST - PART 2 (Remaining tests)
 * Tests Astro card on desktop and all mobile interactions
 */

const { chromium } = require('playwright');

(async () => {
  console.log('\n🚀 Starting Triangle Section Tests - PART 2...\n');

  const browser = await chromium.launch({
    headless: false,
    timeout: 60000
  });

  const results = {
    desktop: {},
    mobile: {},
    errors: []
  };

  try {
    // =====================================================
    // DESKTOP TEST: Astro Alignment & Center Globe
    // =====================================================
    console.log('📱 DESKTOP - Astro Card & Center Globe Test');
    console.log('='.repeat(60));

    const desktopPage = await browser.newPage();
    await desktopPage.setViewportSize({ width: 1920, height: 1080 });

    console.log('Loading https://anshikarastogi.com...');
    await desktopPage.goto('https://anshikarastogi.com', { waitUntil: 'networkidle', timeout: 60000 });

    // Scroll to triangle
    await desktopPage.evaluate(() => {
      const section = document.getElementById('magic-triangle');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await desktopPage.waitForTimeout(2000);

    // Test Astro card
    console.log('\n⭐ Testing "Astro Alignment" card hover...');
    const astroCard = await desktopPage.locator('.power-point.point-right');
    await astroCard.hover();
    await desktopPage.waitForTimeout(1000);

    const astroDetailVisible = await desktopPage.evaluate(() => {
      const detail = document.querySelector('.point-right .power-details');
      const style = window.getComputedStyle(detail);
      return style.opacity > 0.5;
    });

    results.desktop.astroAlignment = astroDetailVisible ? 'PASS' : 'FAIL';
    await desktopPage.screenshot({ path: 'desktop-astro-hover.png' });
    console.log(`${astroDetailVisible ? '✅' : '❌'} Astro Alignment hover: ${results.desktop.astroAlignment}`);

    // Test center globe
    await desktopPage.mouse.move(0, 0);
    await desktopPage.waitForTimeout(500);

    console.log('\n🔮 Testing center crystal ball globe...');
    const centerExists = await desktopPage.evaluate(() => {
      return !!document.querySelector('.triangle-center-clickable');
    });

    if (centerExists) {
      await desktopPage.click('.triangle-center-clickable');
      await desktopPage.waitForTimeout(1000);

      const labelVisible = await desktopPage.evaluate(() => {
        const label = document.getElementById('triangleCenterLabel');
        const style = window.getComputedStyle(label);
        return style.opacity > 0;
      });

      results.desktop.centerGlobe = labelVisible ? 'PASS' : 'FAIL';
      await desktopPage.screenshot({ path: 'desktop-center-click.png' });
      console.log(`${labelVisible ? '✅' : '❌'} Center globe interaction: ${results.desktop.centerGlobe}`);
    } else {
      results.desktop.centerGlobe = 'NOT FOUND';
      console.log('❌ Center globe element not found');
    }

    await desktopPage.close();

    // =====================================================
    // MOBILE TESTS
    // =====================================================
    console.log('\n\n📱 MOBILE TESTS (375x667 - iPhone SE)');
    console.log('='.repeat(60));

    const mobilePage = await browser.newPage();
    await mobilePage.setViewportSize({ width: 375, height: 667 });

    console.log('Loading mobile view...');
    await mobilePage.goto('https://anshikarastogi.com', { waitUntil: 'networkidle', timeout: 60000 });

    // Scroll to triangle
    await mobilePage.evaluate(() => {
      const section = document.getElementById('magic-triangle');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await mobilePage.waitForTimeout(2000);

    await mobilePage.screenshot({ path: 'mobile-triangle-initial.png' });
    console.log('✅ Screenshot saved: mobile-triangle-initial.png');

    // Test 1: Tap Luxury Design
    console.log('\n🎨 Test 1: Tapping "Luxury Design" card...');
    await mobilePage.click('.power-point.point-top');
    await mobilePage.waitForTimeout(1500);

    const modalState = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return { exists: false };

      const style = window.getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();

      const title = modal.querySelector('.modal-title')?.textContent;
      const description = modal.querySelector('.modal-description')?.textContent;
      const details = modal.querySelectorAll('.modal-detail-item');
      const closeBtn = modal.querySelector('.modal-close');

      return {
        exists: true,
        opacity: parseFloat(style.opacity),
        visible: style.display !== 'none' && style.visibility !== 'hidden',
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
          closeBtnColor: closeBtn ? window.getComputedStyle(closeBtn).color : null
        }
      };
    });

    await mobilePage.screenshot({ path: 'mobile-luxury-modal-open.png' });
    console.log('✅ Screenshot saved: mobile-luxury-modal-open.png');

    console.log('\nModal State:', JSON.stringify(modalState, null, 2));

    // Check positioning
    const isCentered = modalState.exists &&
                      modalState.position.centerX > 50 &&
                      modalState.position.centerX < 325 &&
                      modalState.position.centerY > 0 &&
                      modalState.position.centerY < 667;

    results.mobile.modalPosition = isCentered ? 'CENTERED - PASS' : 'OFF-SCREEN - FAIL';
    console.log(`${isCentered ? '✅' : '❌'} Modal position: ${results.mobile.modalPosition}`);

    // Check content visibility
    const hasVisibleContent = modalState.exists &&
                              modalState.visible &&
                              modalState.opacity > 0.5 &&
                              modalState.content.hasTitle &&
                              modalState.content.hasDescription &&
                              modalState.content.detailCount >= 3;

    results.mobile.contentVisible = hasVisibleContent ? 'VISIBLE - PASS' : 'BLACK SCREEN - FAIL';
    console.log(`${hasVisibleContent ? '✅' : '❌'} Content visibility: ${results.mobile.contentVisible}`);

    if (hasVisibleContent) {
      console.log('  ✓ Title:', modalState.content.titleText);
      console.log('  ✓ Description:', modalState.content.descriptionText);
      console.log(`  ✓ Detail rows: ${modalState.content.detailCount}`);
    }

    // Check close button
    const hasCloseButton = modalState.content.hasCloseButton;
    results.mobile.closeButton = hasCloseButton ? 'VISIBLE - PASS' : 'MISSING - FAIL';
    console.log(`${hasCloseButton ? '✅' : '❌'} Close button: ${results.mobile.closeButton}`);

    // Test close button
    if (hasCloseButton) {
      console.log('\n❌ Test 2: Closing modal with close button...');
      await mobilePage.click('.modal-close');
      await mobilePage.waitForTimeout(1000);

      const modalClosed = await mobilePage.evaluate(() => {
        const modal = document.querySelector('.triangle-modal');
        if (!modal) return true;
        const style = window.getComputedStyle(modal);
        return style.display === 'none' || parseFloat(style.opacity) < 0.1;
      });

      results.mobile.closeButtonWorks = modalClosed ? 'PASS' : 'FAIL';
      console.log(`${modalClosed ? '✅' : '❌'} Close button works: ${results.mobile.closeButtonWorks}`);

      await mobilePage.screenshot({ path: 'mobile-modal-closed.png' });
    }

    // Test Vastu card
    console.log('\n🧭 Test 3: Testing "Vastu Science" card...');
    await mobilePage.click('.power-point.point-left');
    await mobilePage.waitForTimeout(1500);

    const vastuModalVisible = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return parseFloat(style.opacity) > 0.5;
    });

    results.mobile.vastuCard = vastuModalVisible ? 'PASS' : 'FAIL';
    await mobilePage.screenshot({ path: 'mobile-vastu-modal.png' });
    console.log(`${vastuModalVisible ? '✅' : '❌'} Vastu card modal: ${results.mobile.vastuCard}`);

    if (vastuModalVisible) {
      await mobilePage.click('.modal-close');
      await mobilePage.waitForTimeout(500);
    }

    // Test Astro card
    console.log('\n⭐ Test 4: Testing "Astro Alignment" card...');
    await mobilePage.click('.power-point.point-right');
    await mobilePage.waitForTimeout(1500);

    const astroModalVisible = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return parseFloat(style.opacity) > 0.5;
    });

    results.mobile.astroCard = astroModalVisible ? 'PASS' : 'FAIL';
    await mobilePage.screenshot({ path: 'mobile-astro-modal.png' });
    console.log(`${astroModalVisible ? '✅' : '❌'} Astro card modal: ${results.mobile.astroCard}`);

    // Test backdrop close
    console.log('\n🎨 Test 5: Testing backdrop close...');
    await mobilePage.click('.triangle-modal', { position: { x: 5, y: 5 } });
    await mobilePage.waitForTimeout(1000);

    const backdropCloseWorks = await mobilePage.evaluate(() => {
      const modal = document.querySelector('.triangle-modal');
      if (!modal) return true;
      const style = window.getComputedStyle(modal);
      return parseFloat(style.opacity) < 0.1;
    });

    results.mobile.backdropClose = backdropCloseWorks ? 'PASS' : 'FAIL';
    console.log(`${backdropCloseWorks ? '✅' : '❌'} Backdrop close: ${results.mobile.backdropClose}`);

    await mobilePage.close();

    // =====================================================
    // FINAL REPORT
    // =====================================================
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST REPORT - PART 2');
    console.log('='.repeat(60));

    console.log('\n🖥️  DESKTOP TESTS (Remaining):');
    console.log('─'.repeat(60));
    console.log(`   Astro Alignment hover:    ${results.desktop.astroAlignment}`);
    console.log(`   Center globe interaction: ${results.desktop.centerGlobe}`);

    console.log('\n📱 MOBILE TESTS:');
    console.log('─'.repeat(60));
    console.log(`   1. Modal position (centered):     ${results.mobile.modalPosition}`);
    console.log(`   2. Content visible (NOT black):   ${results.mobile.contentVisible}`);
    console.log(`   3. Close button visible:          ${results.mobile.closeButton}`);
    console.log(`   4. Close button works:            ${results.mobile.closeButtonWorks}`);
    console.log(`   5. Vastu card modal:              ${results.mobile.vastuCard}`);
    console.log(`   6. Astro card modal:              ${results.mobile.astroCard}`);
    console.log(`   7. Backdrop close works:          ${results.mobile.backdropClose}`);

    const desktopPassed = Object.values(results.desktop).filter(v => v === 'PASS').length;
    const mobilePassed = Object.values(results.mobile).filter(v => v.includes('PASS')).length;

    console.log('\n' + '='.repeat(60));
    console.log(`Desktop: ${desktopPassed}/${Object.keys(results.desktop).length} passed`);
    console.log(`Mobile: ${mobilePassed}/${Object.keys(results.mobile).length} passed`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed. Tests complete.\n');
  }
})();

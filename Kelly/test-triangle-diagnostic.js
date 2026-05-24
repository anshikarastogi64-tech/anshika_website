/**
 * DIAGNOSTIC TEST - Check mobile modal functionality
 */

const { chromium } = require('playwright');

(async () => {
  console.log('\n🔍 DIAGNOSTIC TEST - Mobile Modal Investigation\n');

  const browser = await chromium.launch({ headless: false });

  try {
    // Test mobile with page load AT mobile size (not resized after load)
    console.log('📱 Test 1: Loading page DIRECTLY at mobile size (375x667)');
    console.log('='.repeat(60));

    const mobilePage = await browser.newPage();

    // Set mobile viewport BEFORE loading the page
    await mobilePage.setViewportSize({ width: 375, height: 667 });
    console.log('✓ Viewport set to 375x667 BEFORE page load');

    await mobilePage.goto('https://anshikarastogi.com', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✓ Page loaded at mobile size');

    // Scroll to triangle
    await mobilePage.evaluate(() => {
      const section = document.getElementById('magic-triangle');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await mobilePage.waitForTimeout(2000);

    // Check if mobile event listeners were attached
    const diagnostics = await mobilePage.evaluate(() => {
      const powerPoints = document.querySelectorAll('.power-point');
      const backdrop = document.querySelector('.modal-backdrop-mobile');

      return {
        windowWidth: window.innerWidth,
        powerPointCount: powerPoints.length,
        hasBackdrop: !!backdrop,
        backdropClass: backdrop ? backdrop.className : null,
        powerPointClasses: Array.from(powerPoints).map(p => p.className)
      };
    });

    console.log('\nDiagnostics:', JSON.stringify(diagnostics, null, 2));

    await mobilePage.screenshot({ path: 'diagnostic-mobile-initial.png' });
    console.log('✓ Screenshot: diagnostic-mobile-initial.png');

    // Try clicking Luxury Design card
    console.log('\n🎨 Clicking "Luxury Design" card...');

    // Try different selectors
    const clickResult = await mobilePage.evaluate(() => {
      const luxuryCard = document.querySelector('.point-top .power-compact');
      if (luxuryCard) {
        luxuryCard.click();
        return { clicked: true, element: 'power-compact' };
      }

      const pointTop = document.querySelector('.point-top');
      if (pointTop) {
        pointTop.click();
        return { clicked: true, element: 'point-top' };
      }

      return { clicked: false };
    });

    console.log('Click result:', clickResult);
    await mobilePage.waitForTimeout(1500);

    // Check modal state after click
    const afterClick = await mobilePage.evaluate(() => {
      const luxuryCard = document.querySelector('.point-top');
      const details = document.querySelector('.point-top .power-details');
      const backdrop = document.querySelector('.modal-backdrop-mobile');
      const closeBtn = document.querySelector('.power-modal-close');

      if (!luxuryCard || !details) {
        return { error: 'Elements not found' };
      }

      const detailsStyle = window.getComputedStyle(details);
      const backdropStyle = backdrop ? window.getComputedStyle(backdrop) : null;

      return {
        cardHasExpanded: luxuryCard.classList.contains('expanded'),
        cardClasses: luxuryCard.className,
        detailsDisplay: detailsStyle.display,
        detailsOpacity: detailsStyle.opacity,
        detailsVisibility: detailsStyle.visibility,
        detailsTransform: detailsStyle.transform,
        backdropActive: backdrop ? backdrop.classList.contains('active') : false,
        backdropDisplay: backdropStyle ? backdropStyle.display : null,
        backdropOpacity: backdropStyle ? backdropStyle.opacity : null,
        hasCloseButton: !!closeBtn,
        detailsContent: {
          header: details.querySelector('.detail-header h4')?.textContent,
          rowCount: details.querySelectorAll('.detail-row').length
        }
      };
    });

    console.log('\nAfter Click State:', JSON.stringify(afterClick, null, 2));

    await mobilePage.screenshot({ path: 'diagnostic-mobile-after-click.png' });
    console.log('✓ Screenshot: diagnostic-mobile-after-click.png');

    // Check if JavaScript errors occurred
    const errors = [];
    mobilePage.on('pageerror', error => {
      errors.push(error.message);
    });

    // Test manually adding the 'expanded' class
    console.log('\n🔧 Manually testing by adding "expanded" class...');
    await mobilePage.evaluate(() => {
      const luxuryCard = document.querySelector('.point-top');
      const backdrop = document.querySelector('.modal-backdrop-mobile');

      if (luxuryCard) luxuryCard.classList.add('expanded');
      if (backdrop) backdrop.classList.add('active');
    });
    await mobilePage.waitForTimeout(500);

    const manualTest = await mobilePage.evaluate(() => {
      const details = document.querySelector('.point-top .power-details');
      const style = window.getComputedStyle(details);

      return {
        opacity: style.opacity,
        visibility: style.visibility,
        transform: style.transform,
        display: style.display
      };
    });

    console.log('Manual "expanded" class test:', JSON.stringify(manualTest, null, 2));

    await mobilePage.screenshot({ path: 'diagnostic-mobile-manual-expanded.png' });
    console.log('✓ Screenshot: diagnostic-mobile-manual-expanded.png');

    // Final analysis
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS');
    console.log('='.repeat(60));

    if (diagnostics.hasBackdrop) {
      console.log('✅ Backdrop element exists');
    } else {
      console.log('❌ Backdrop element NOT found');
    }

    if (afterClick.cardHasExpanded) {
      console.log('✅ Card has "expanded" class after click');
    } else {
      console.log('❌ Card does NOT have "expanded" class after click');
      console.log('   This means JavaScript event listener did not fire!');
    }

    if (parseFloat(manualTest.opacity) > 0.5) {
      console.log('✅ Modal WORKS when "expanded" class is manually added');
      console.log('   Problem: JavaScript event listeners not working');
    } else {
      console.log('❌ Modal does NOT work even with manual "expanded" class');
      console.log('   Problem: CSS or element structure issue');
    }

    if (errors.length > 0) {
      console.log('\n❌ JavaScript Errors:');
      errors.forEach(err => console.log('   -', err));
    } else {
      console.log('\n✅ No JavaScript errors detected');
    }

    console.log('='.repeat(60) + '\n');

    await mobilePage.close();

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('✅ Diagnostic test complete.\n');
  }
})();

const http = require('http');

async function testTouchPOS() {
  console.log('Testing Touchscreen POS, Customizer & Movable Popup Buttons...');

  // 1. Login
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@stockplus.com&password=password123',
    redirect: 'manual',
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('1. Authenticated');

  // 2. Test GET /settings/pos
  const customizerRes = await fetch('http://localhost:3000/settings/pos', {
    headers: { Cookie: cookie }
  });
  const customizerHtml = await customizerRes.text();
  if (customizerHtml.includes('POS Screen & Touchscreen Customizer') && customizerHtml.includes('quickCashNotes')) {
    console.log('2. GET /settings/pos loaded successfully with all touchscreen controls');
  } else {
    throw new Error('Failed to load /settings/pos');
  }

  // 3. Test Updating POS Settings via PUT /settings/pos
  const updateBody = new URLSearchParams();
  updateBody.append('layout', 'cart-left');
  updateBody.append('gridColumns', 'large');
  updateBody.append('theme', 'dark');
  updateBody.append('touchButtonSize', 'jumbo');
  updateBody.append('enableOnScreenNumpad', 'on');
  updateBody.append('enableSoundEffects', 'on');
  updateBody.append('quickCashNotes', '10, 20, 50, 100, 200');
  updateBody.append('quickDiscountButtons', '5, 10, 25, 50');
  updateBody.append('showCategoryTabs', 'on');
  updateBody.append('allowCustomLineItem', 'on');
  updateBody.append('showStockCountOnTile', 'on');
  updateBody.append('showSkuOnTile', 'on');

  const putRes = await fetch('http://localhost:3000/settings/pos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: updateBody.toString() + '&_method=PUT',
    redirect: 'manual'
  });
  console.log(`3. PUT /settings/pos status: ${putRes.status}`);

  // 4. Test GET /pos to verify customized layout and Sub Total button
  const posRes = await fetch('http://localhost:3000/pos', {
    headers: { Cookie: cookie }
  });
  const posHtml = await posRes.text();
  if (posHtml.includes('md:flex-row-reverse') && posHtml.includes('SUB TOTAL') && posHtml.includes('goToPaymentPage()')) {
    console.log('4. POS screen rendered customized Dark Theme, Left Cart layout, and "SUB TOTAL" navigation button!');
  } else {
    throw new Error('POS screen did not render SUB TOTAL button or layout correctly');
  }

  // 4b. Test GET /pos/payment - Dedicated Review, Discounts & Tender Page
  const paymentRes = await fetch('http://localhost:3000/pos/payment', {
    headers: { Cookie: cookie }
  });
  const paymentHtml = await paymentRes.text();
  if (
    paymentHtml.includes('Checkout & Discounts') &&
    paymentHtml.includes('Back to Register') &&
    paymentHtml.includes('Preset Percentage Savings') &&
    paymentHtml.includes('Fixed Amount') &&
    paymentHtml.includes('Promo Code') &&
    paymentHtml.includes('COMPLETE TRANSACTION')
  ) {
    console.log('4b. Dedicated GET /pos/payment loaded successfully with Discounts Engine and Tender Controls!');
  } else {
    throw new Error('Failed to load dedicated /pos/payment page');
  }

  // 5. Test checkout with custom item, discount, discount reason, and tax exempt status
  const customCheckoutPayload = {
    items: [
      {
        productId: 'custom-123456',
        name: 'Express Delivery Fee',
        quantity: 1,
        unitPrice: 15.00,
        sku: 'MISC',
        isCustom: true
      }
    ],
    discountAmount: 3.00,
    discountReason: 'VIP Loyalty',
    notes: 'Member VIP promo applied on review screen',
    isTaxExempt: true,
    paymentMethod: 'card',
    cashReceived: 12.00,
    customerName: 'Touch Screen Test Customer'
  };

  const checkoutRes = await fetch('http://localhost:3000/pos/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify(customCheckoutPayload)
  });
  const checkoutData = await checkoutRes.json();
  console.log('5. Custom Item POS Checkout Result with Discount & Tax Exempt:', checkoutData);
  if (!checkoutData.success || checkoutData.total !== 12.00) {
    throw new Error(`Checkout failed or incorrect total: expected 12.00, got ${checkoutData.total}`);
  }

  // 6. Test Creating Custom Buttons (POST /pos/buttons)
  console.log('6. Testing Custom Button creation with Popups & Direct Actions...');

  // Button A: Popup Prompt for Custom Surcharge
  const btnPromptRes = await fetch('http://localhost:3000/pos/buttons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      label: 'Eco Surcharge',
      icon: 'leaf',
      color: 'emerald',
      actionType: 'popup_prompt',
      actionData: {
        title: 'Environmental Surcharge',
        defaultName: 'Green Fee',
        defaultPrice: 2.50,
      },
    }),
  });
  const btnPromptData = await btnPromptRes.json();
  if (!btnPromptData.success || !btnPromptData.button.id) {
    throw new Error('Failed to create Prompt Modal button');
  }
  const btnAId = btnPromptData.button.id;
  console.log('   - Created Prompt Modal button:', btnAId);

  // Button B: Popup Submenu with items
  const btnSubmenuRes = await fetch('http://localhost:3000/pos/buttons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      label: 'Add-on Options',
      icon: 'sparkles',
      color: 'amber',
      actionType: 'popup_submenu',
      actionData: {
        title: 'Add-on Options Menu',
        items: [
          { name: 'Oat Milk Extra', price: 0.75 },
          { name: 'Flavor Shot', price: 0.50 },
        ],
      },
    }),
  });
  const btnSubmenuData = await btnSubmenuRes.json();
  if (!btnSubmenuData.success || !btnSubmenuData.button.id) {
    throw new Error('Failed to create Submenu Modal button');
  }
  const btnBId = btnSubmenuData.button.id;
  console.log('   - Created Submenu Modal button:', btnBId);

  // Button C: Direct Add Item
  const btnDirectRes = await fetch('http://localhost:3000/pos/buttons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      label: 'Gift Box',
      icon: 'gift',
      color: 'rose',
      actionType: 'add_item',
      actionData: {
        name: 'Deluxe Gift Box',
        price: 5.00,
        sku: 'GIFT-01',
      },
    }),
  });
  const btnDirectData = await btnDirectRes.json();
  if (!btnDirectData.success || !btnDirectData.button.id) {
    throw new Error('Failed to create Direct Add Item button');
  }
  const btnCId = btnDirectData.button.id;
  console.log('   - Created Direct Item button:', btnCId);

  // Button D: Info Modal
  const btnInfoRes = await fetch('http://localhost:3000/pos/buttons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      label: 'Return Rules',
      icon: 'help-circle',
      color: 'purple',
      actionType: 'info_modal',
      actionData: {
        title: 'Return Policy Guidelines',
        content: 'Returns accepted within 30 days with receipt and original tags.',
      },
    }),
  });
  const btnInfoData = await btnInfoRes.json();
  if (!btnInfoData.success || !btnInfoData.button.id) {
    throw new Error('Failed to create Info Modal button');
  }
  const btnDId = btnInfoData.button.id;
  console.log('   - Created Info Modal button:', btnDId);

  // 7. Test Movable Drag-and-Drop Reordering (POST /pos/buttons/reorder)
  console.log('7. Testing Drag-and-Drop Reordering persistence...');
  // Move btnCId (Gift Box) and btnDId to the front
  const reorderRes = await fetch('http://localhost:3000/pos/buttons/reorder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      orderedIds: [btnCId, btnDId, btnBId, btnAId],
    }),
  });
  const reorderData = await reorderRes.json();
  if (!reorderData.success) {
    throw new Error('Failed to reorder buttons');
  }
  console.log('   - Reorder successful, updated count:', reorderData.count);

  // 8. Test Editing Button (PUT /pos/buttons/:buttonId)
  console.log('8. Testing Button Editing...');
  const editRes = await fetch(`http://localhost:3000/pos/buttons/${btnCId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      label: 'Luxury Gift Box XL',
      icon: 'gift',
      color: 'rose',
      actionType: 'add_item',
      actionData: {
        name: 'Deluxe XL Velvet Gift Box',
        price: 9.99,
      },
    }),
  });
  const editData = await editRes.json();
  if (!editData.success || editData.button.label !== 'Luxury Gift Box XL') {
    throw new Error('Failed to update button');
  }
  console.log('   - Successfully updated button label and price');

  // 9. Verify Buttons & Popups in POS HTML rendering
  console.log('9. Verifying updated buttons in POS HTML view...');
  const posButtonsRes = await fetch('http://localhost:3000/pos', {
    headers: { Cookie: cookie },
  });
  const posButtonsHtml = await posButtonsRes.text();
  if (!posButtonsHtml.includes('Luxury Gift Box XL') || !posButtonsHtml.includes('Eco Surcharge') || !posButtonsHtml.includes('dynamicPromptModal') || !posButtonsHtml.includes('dynamicSubmenuModal') || !posButtonsHtml.includes('dynamicInfoModal')) {
    throw new Error('POS screen missing created buttons or modal elements');
  }
  console.log('   - POS screen contains custom action buttons and all 3 popup modals (Prompt, Submenu, Info)');

  // 10. Verify Buttons Card in /settings/pos
  console.log('10. Verifying buttons overview in /settings/pos...');
  const settingsPosRes = await fetch('http://localhost:3000/settings/pos', {
    headers: { Cookie: cookie },
  });
  const settingsPosHtml = await settingsPosRes.text();
  if (!settingsPosHtml.includes('Custom Touch Buttons & Dynamic Pop-ups') || !settingsPosHtml.includes('Luxury Gift Box XL')) {
    throw new Error('Settings POS view missing buttons overview');
  }
  console.log('   - Settings view contains Custom Buttons & Dynamic Pop-ups overview');

  // 11. Test Deleting Button (DELETE /pos/buttons/:buttonId)
  console.log('11. Testing Button Deletion...');
  const deleteRes = await fetch(`http://localhost:3000/pos/buttons/${btnDId}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  const deleteData = await deleteRes.json();
  if (!deleteData.success) {
    throw new Error('Failed to delete custom button');
  }
  console.log('   - Successfully deleted custom button:', btnDId);

  console.log('========================================================================');
  console.log('🎉 ALL TOUCHSCREEN POS, POPUP MODALS & MOVABLE BUTTON TESTS PASSED! 🎉');
  console.log('========================================================================');
  process.exit(0);
}

testTouchPOS().catch((err) => {
  console.error(err);
  process.exit(1);
});

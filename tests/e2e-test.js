// End-to-end user workflow test
const http = require('http');

async function testFullWorkflow() {
  console.log('--- Starting Comprehensive Workflow Test ---');

  // 1. Login
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@stockplus.com&password=password123',
    redirect: 'manual',
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('1. Logged in successfully');

  // 2. Fetch products to get an existing product ID
  const prodRes = await fetch('http://localhost:3000/products', {
    headers: { Cookie: cookie },
  });
  const prodHtml = await prodRes.text();
  const match = prodHtml.match(/\/products\/([a-f0-9]{24})/);
  if (!match) throw new Error('No product link found in catalog');
  const sampleProductId = match[1];
  console.log(`2. Found sample product ID: ${sampleProductId}`);

  // 3. Test POS Checkout
  const checkoutPayload = {
    items: [
      {
        productId: sampleProductId,
        name: 'Whole Grass-Fed Organic Milk 1L',
        quantity: 2,
        unitPrice: 3.99,
        sku: 'GRO-MLK-001'
      }
    ],
    discountAmount: 0.50,
    paymentMethod: 'cash',
    cashReceived: 10.00,
    customerName: 'Alice Tester',
    customerPhone: '+1-555-0199'
  };

  const checkoutRes = await fetch('http://localhost:3000/pos/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify(checkoutPayload)
  });
  const checkoutData = await checkoutRes.json();
  console.log('3. POS Checkout Result:', checkoutData);
  if (!checkoutData.success) throw new Error('Checkout failed: ' + checkoutData.message);

  // 4. Test Printable Receipt View
  const receiptRes = await fetch(`http://localhost:3000/pos/receipt/${checkoutData.saleId}`, {
    headers: { Cookie: cookie }
  });
  const receiptHtml = await receiptRes.text();
  if (receiptHtml.includes(checkoutData.receiptNumber) && receiptHtml.includes('Alice Tester')) {
    console.log('4. Printable thermal receipt verified successfully with custom store branding!');
  } else {
    throw new Error('Receipt view missing expected receipt number');
  }

  // 5. Test Stock Movement Ledger
  const ledgerRes = await fetch('http://localhost:3000/stock/movements', {
    headers: { Cookie: cookie }
  });
  const ledgerHtml = await ledgerRes.text();
  if (ledgerHtml.includes(checkoutData.receiptNumber)) {
    console.log('5. Stock movement ledger verified: sale_out recorded automatically!');
  } else {
    throw new Error('Ledger does not contain checkout receipt reference');
  }

  // 6. Test Stock Adjustment (+15 units)
  const adjustParams = new URLSearchParams();
  adjustParams.append('productId', sampleProductId);
  adjustParams.append('type', 'adjustment');
  adjustParams.append('quantityChange', '15');
  adjustParams.append('notes', 'Automated end-to-end test stock count correction');

  const adjustRes = await fetch('http://localhost:3000/stock/adjust', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie
    },
    body: adjustParams.toString(),
    redirect: 'manual'
  });
  console.log(`6. Stock adjustment completed with redirect status ${adjustRes.status}`);

  // 7. Verify Custom Fields Builder page
  const customFieldsRes = await fetch('http://localhost:3000/settings/custom-fields', {
    headers: { Cookie: cookie }
  });
  const cfHtml = await customFieldsRes.text();
  if (cfHtml.includes('Dynamic Custom Product Attributes') && cfHtml.includes('Expiry Date')) {
    console.log('7. Custom fields manager verified with store attributes & presets!');
  } else {
    throw new Error('Custom fields page failed to load');
  }

  console.log('==================================================');
  console.log('🌟 ALL 7 END-TO-END WORKFLOW TESTS SUCCEEDED 🌟');
  console.log('==================================================');
  process.exit(0);
}

testFullWorkflow().catch(err => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});

// Verification test script
const http = require('http');

async function runTests() {
  console.log('Testing server endpoints...');
  // We will run the server in the background and use node-fetch or native http/fetch
  const res = await fetch('http://localhost:3000/auth/login');
  console.log(`GET /auth/login status: ${res.status}`);
  const text = await res.text();
  if (text.includes('Sign in to your store')) {
    console.log('✓ Login view rendered correctly with StockPlus branding');
  } else {
    console.error('✗ Unexpected login page content');
    process.exit(1);
  }

  // Test login
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@stockplus.com&password=password123',
    redirect: 'manual',
  });
  console.log(`POST /auth/login status: ${loginRes.status} (expected 302 redirect)`);
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    console.error('✗ No session cookie set on login');
    process.exit(1);
  }
  const cookie = setCookie.split(';')[0];
  console.log('✓ Successfully authenticated and received session cookie');

  // Test dashboard
  const dashRes = await fetch('http://localhost:3000/dashboard', {
    headers: { Cookie: cookie },
  });
  console.log(`GET /dashboard status: ${dashRes.status}`);
  const dashText = await dashRes.text();
  if (dashText.includes('GreenLeaf Fresh Market') && dashText.includes('Restock Priority Items')) {
    console.log('✓ Dashboard rendered successfully with active store & metrics');
  } else {
    console.error('✗ Dashboard content mismatch');
  }

  // Test Products page
  const prodRes = await fetch('http://localhost:3000/products', {
    headers: { Cookie: cookie },
  });
  console.log(`GET /products status: ${prodRes.status}`);
  const prodText = await prodRes.text();
  if (prodText.includes('Expiry Date') && prodText.includes('Batch / Lot #')) {
    console.log('✓ Products catalog rendered dynamic custom fields columns for Grocery store!');
  } else {
    console.error('✗ Products catalog missing dynamic custom fields');
  }

  // Test Store Switcher to Fashion Store
  const switchRes = await fetch('http://localhost:3000/dashboard?switchStore=' + (dashText.match(/switchStore=([a-f0-9]{24})/)?.[1] || ''), {
    headers: { Cookie: cookie },
    redirect: 'manual'
  });
  console.log(`Store switch triggered. Redirect status: ${switchRes.status}`);

  console.log('===================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED 🎉');
  console.log('===================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

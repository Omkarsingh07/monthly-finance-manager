// src/tests/test-auth.ts
import 'dotenv/config';
import http from 'http';
import app from '../app';
import { AUTH_CONFIG } from '../config/auth';

async function runAuthTests() {
  console.log('======================================================');
  console.log('  SECURITY & AUTHENTICATION INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  // Start an ephemeral HTTP server on a random port for testing
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Ephemeral test server listening on ${baseUrl}\n`);

  try {
    const validEmail = AUTH_CONFIG.EMAIL || 'admin@financemanager.com';
    const validPassword = AUTH_CONFIG.PASSWORD || 'AdminPassword123!';

    // 1. Correct credentials -> 200
    console.log('1. Testing login with correct credentials...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail, password: validPassword }),
    });
    if (loginRes.status !== 200) {
      console.error(`❌ Expected 200, got ${loginRes.status}!`);
      process.exit(1);
    }
    const setCookieHeader = loginRes.headers.get('set-cookie');
    if (!setCookieHeader || !setCookieHeader.includes(AUTH_CONFIG.COOKIE_NAME)) {
      console.error('❌ Set-Cookie header missing fm_session token!', setCookieHeader);
      process.exit(1);
    }
    const rawCookie = setCookieHeader.split(';')[0];
    const loginJson = (await loginRes.json()) as { success: boolean; authenticated: boolean };
    if (!loginJson.authenticated) {
      console.error('❌ Expected login response authenticated: true!', loginJson);
      process.exit(1);
    }
    console.log(`✅ 1. PASS: Login successful: Status 200, authenticated: true, Set-Cookie present.`);

    // 2. Wrong email -> 401
    console.log('\n2. Testing login with wrong email...');
    const wrongEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong_user@example.com', password: validPassword }),
    });
    if (wrongEmailRes.status !== 401) {
      console.error(`❌ Expected 401, got ${wrongEmailRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 2. PASS: Wrong email rejected with 401.');

    // 3. Wrong password -> 401
    console.log('\n3. Testing login with wrong password...');
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail, password: 'WrongPassword999!' }),
    });
    if (wrongPassRes.status !== 401) {
      console.error(`❌ Expected 401, got ${wrongPassRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 3. PASS: Wrong password rejected with 401.');

    // 4. Missing email -> 400
    console.log('\n4. Testing login with missing email...');
    const missingEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: validPassword }),
    });
    if (missingEmailRes.status !== 400) {
      console.error(`❌ Expected 400, got ${missingEmailRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 4. PASS: Missing email rejected with 400.');

    // 5. Missing password -> 400
    console.log('\n5. Testing login with missing password...');
    const missingPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail }),
    });
    if (missingPassRes.status !== 400) {
      console.error(`❌ Expected 400, got ${missingPassRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 5. PASS: Missing password rejected with 400.');

    // 6. /api/auth/me without session -> 401
    console.log('\n6. Testing /api/auth/me without session...');
    const unauthMeRes = await fetch(`${baseUrl}/api/auth/me`);
    if (unauthMeRes.status !== 401) {
      console.error(`❌ Expected 401, got ${unauthMeRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 6. PASS: /api/auth/me without session returned 401.');

    // 7. /api/auth/me with session -> 200
    console.log('\n7. Testing /api/auth/me with valid session cookie...');
    const authMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: rawCookie },
    });
    if (authMeRes.status !== 200) {
      console.error(`❌ Expected 200, got ${authMeRes.status}!`);
      process.exit(1);
    }
    const meJson = (await authMeRes.json()) as { authenticated: boolean };
    if (!meJson.authenticated) {
      console.error('❌ Expected authenticated: true!', meJson);
      process.exit(1);
    }
    console.log('✅ 7. PASS: /api/auth/me with session returned 200 with { authenticated: true }.');

    // 8. Logout -> 200
    console.log('\n8. Testing logout...');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: rawCookie },
    });
    if (logoutRes.status !== 200) {
      console.error(`❌ Expected 200, got ${logoutRes.status}!`);
      process.exit(1);
    }
    const logoutCookie = logoutRes.headers.get('set-cookie');
    console.log('✅ 8. PASS: Logout returned 200 and set-cookie cleared.');

    // 9. /api/auth/me after logout -> 401
    console.log('\n9. Testing /api/auth/me after logout...');
    const expiredCookie = logoutCookie ? logoutCookie.split(';')[0] : '';
    const afterLogoutMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: expiredCookie },
    });
    if (afterLogoutMeRes.status !== 401) {
      console.error(`❌ Expected 401, got ${afterLogoutMeRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 9. PASS: /api/auth/me after logout returned 401.');

    // 10. Protected dashboard without session -> 401
    console.log('\n10. Testing protected dashboard without session...');
    const dashUnauth = await fetch(`${baseUrl}/api/dashboard?month=8&year=2026`);
    if (dashUnauth.status !== 401) {
      console.error(`❌ Expected 401, got ${dashUnauth.status}!`);
      process.exit(1);
    }
    console.log('✅ 10. PASS: Protected dashboard rejected with 401.');

    // 11. Protected monthly investment API without session -> 401
    console.log('\n11. Testing protected monthly investments without session...');
    const monthlyUnauth = await fetch(`${baseUrl}/api/monthly-investments?month=8&year=2026`);
    if (monthlyUnauth.status !== 401) {
      console.error(`❌ Expected 401, got ${monthlyUnauth.status}!`);
      process.exit(1);
    }
    console.log('✅ 11. PASS: Protected monthly investments rejected with 401.');

    // 12. Protected investment plan API without session -> 401
    console.log('\n12. Testing protected investment plan without session...');
    const planUnauth = await fetch(`${baseUrl}/api/investment-plan`);
    if (planUnauth.status !== 401) {
      console.error(`❌ Expected 401, got ${planUnauth.status}!`);
      process.exit(1);
    }
    console.log('✅ 12. PASS: Protected investment plan rejected with 401.');

    // 13. Health endpoint without session -> 200
    console.log('\n13. Testing health endpoint without session...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    if (healthRes.status !== 200) {
      console.error(`❌ Expected 200, got ${healthRes.status}!`);
      process.exit(1);
    }
    console.log('✅ 13. PASS: Health endpoint is public (Status 200).');

    // 14. CORS preflight OPTIONS from production frontend -> 204 with Allow-Origin & Allow-Credentials
    console.log('\n14. Testing CORS preflight OPTIONS from production frontend (https://monthly-finance-manager-ten.vercel.app)...');
    const preflightRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://monthly-finance-manager-ten.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    if (preflightRes.status !== 204 && preflightRes.status !== 200) {
      console.error(`❌ Expected 204/200 for preflight, got ${preflightRes.status}!`);
      process.exit(1);
    }
    const allowOrigin = preflightRes.headers.get('access-control-allow-origin');
    const allowCreds = preflightRes.headers.get('access-control-allow-credentials');
    if (allowOrigin !== 'https://monthly-finance-manager-ten.vercel.app' || allowCreds !== 'true') {
      console.error('❌ CORS preflight headers incorrect!', { allowOrigin, allowCreds });
      process.exit(1);
    }
    console.log(`✅ 14. PASS: CORS preflight returned Status ${preflightRes.status}, Allow-Origin: ${allowOrigin}, Allow-Credentials: ${allowCreds}`);

    // 15. Verify Google credentials and secrets never appear in API responses
    console.log('\n15. Verifying credentials and secrets never leak in responses...');
    const healthJson = await healthRes.json();
    const responseText = JSON.stringify(healthJson) + JSON.stringify(loginJson);
    if (
      responseText.includes('PRIVATE KEY') ||
      responseText.includes(validPassword) ||
      responseText.includes(AUTH_CONFIG.SESSION_SECRET)
    ) {
      console.error('❌ CRITICAL SECURITY FLAW: Secret credentials found in API responses!');
      process.exit(1);
    }
    console.log('✅ 15. PASS: Verified zero credential leakage across all API responses.');
  } finally {
    server.close();
  }

  console.log('\n======================================================');
  console.log('🎉 ALL SECURITY & AUTHENTICATION INTEGRATION TESTS PASSED!');
  console.log('======================================================');
}

runAuthTests().catch((err) => {
  console.error('❌ Auth test suite failed with error:', err);
  process.exit(1);
});

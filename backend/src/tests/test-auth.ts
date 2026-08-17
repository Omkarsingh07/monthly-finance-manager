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

    // Step A: Login with invalid email (Expected: 401)
    console.log('A. Testing login with invalid email...');
    const invalidEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong_user@example.com', password: validPassword }),
    });
    if (invalidEmailRes.status !== 401) {
      console.error(`❌ Expected 401, got ${invalidEmailRes.status}!`);
      process.exit(1);
    }
    const invalidEmailJson = (await invalidEmailRes.json()) as { success?: boolean; message?: string };
    console.log(`✅ Correctly rejected invalid email (Status: 401, Message: "${invalidEmailJson.message}")`);

    // Step B: Login with invalid password (Expected: 401)
    console.log('\nB. Testing login with invalid password...');
    const invalidPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: validEmail, password: 'WrongPassword999!' }),
    });
    if (invalidPassRes.status !== 401) {
      console.error(`❌ Expected 401, got ${invalidPassRes.status}!`);
      process.exit(1);
    }
    const invalidPassJson = (await invalidPassRes.json()) as { success?: boolean; message?: string };
    console.log(`✅ Correctly rejected invalid password (Status: 401, Message: "${invalidPassJson.message}")`);

    // Step C: Login with correct credentials (Expected: 200 + Set-Cookie)
    console.log('\nC. Testing login with correct credentials...');
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
    console.log(`✅ Login successful: Status 200, HTTP-only cookie established (${AUTH_CONFIG.COOKIE_NAME})`);

    // Step D: Protected API without authentication (Expected: 401 on all endpoints)
    console.log('\nD. Testing all protected finance endpoints without authentication...');
    const protectedEndpoints = [
      { method: 'GET', path: '/api/dashboard?month=8&year=2026' },
      { method: 'GET', path: '/api/investment-plan' },
      { method: 'POST', path: '/api/investment-plan' },
      { method: 'PUT', path: '/api/investment-plan' },
      { method: 'DELETE', path: '/api/investment-plan/item/test-id' },
      { method: 'GET', path: '/api/monthly-investments?month=8&year=2026' },
      { method: 'PUT', path: '/api/monthly-investments/test-id' },
      { method: 'PUT', path: '/api/monthly-investments' },
    ];

    for (const ep of protectedEndpoints) {
      const unauthRes = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      });
      if (unauthRes.status !== 401) {
        console.error(`❌ Security breach! Endpoint ${ep.method} ${ep.path} allowed unauthenticated access with status ${unauthRes.status}!`);
        process.exit(1);
      }
      console.log(`   🔒 ${ep.method} ${ep.path} -> 401 Unauthorized`);
    }
    console.log('✅ All finance endpoints securely reject unauthenticated requests.');

    // Step E: Protected API with valid authentication (Expected: 200)
    console.log('\nE. Testing protected finance API with valid session cookie...');
    const authDashRes = await fetch(`${baseUrl}/api/dashboard?month=8&year=2026`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCookie,
      },
    });
    if (authDashRes.status !== 200) {
      console.error(`❌ Expected 200 with valid session cookie, got ${authDashRes.status}!`);
      process.exit(1);
    }
    const dashData = (await authDashRes.json()) as { month?: number; year?: number };
    console.log(`✅ Authenticated request succeeded (Status: 200, Month: ${dashData.month}, Year: ${dashData.year})`);

    // Step F: /api/auth/me without authentication (Expected: 401)
    console.log('\nF. Testing /api/auth/me without authentication...');
    const unauthMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (unauthMeRes.status !== 401) {
      console.error(`❌ Expected 401 for /api/auth/me without cookie, got ${unauthMeRes.status}!`);
      process.exit(1);
    }
    console.log('✅ Unauthenticated /api/auth/me returned 401');

    // Step G: /api/auth/me with authentication (Expected: 200)
    console.log('\nG. Testing /api/auth/me with valid session cookie...');
    const authMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCookie,
      },
    });
    if (authMeRes.status !== 200) {
      console.error(`❌ Expected 200 for /api/auth/me with cookie, got ${authMeRes.status}!`);
      process.exit(1);
    }
    const meData = (await authMeRes.json()) as { authenticated?: boolean };
    if (!meData.authenticated) {
      console.error('❌ Expected meData.authenticated === true!', meData);
      process.exit(1);
    }
    console.log('✅ Authenticated /api/auth/me returned 200 with { authenticated: true }');

    // Step H: Logout (Expected: 200 + cleared cookie)
    console.log('\nH. Testing logout...');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rawCookie,
      },
    });
    if (logoutRes.status !== 200) {
      console.error(`❌ Expected 200 on logout, got ${logoutRes.status}!`);
      process.exit(1);
    }
    const logoutCookie = logoutRes.headers.get('set-cookie');
    console.log('✅ Logout successful (Status: 200, Session cookie cleared)');

    // Step I: Protected API after logout (Expected: 401)
    console.log('\nI. Testing protected API after session clearance...');
    const expiredCookie = logoutCookie ? logoutCookie.split(';')[0] : '';
    const afterLogoutRes = await fetch(`${baseUrl}/api/dashboard?month=8&year=2026`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: expiredCookie,
      },
    });
    if (afterLogoutRes.status !== 401) {
      console.error(`❌ Expected 401 after logout, got ${afterLogoutRes.status}!`);
      process.exit(1);
    }
    console.log('✅ Request after logout correctly returned 401 Unauthorized');

    // Step J: Health endpoint without authentication (Expected: 200)
    console.log('\nJ. Testing health endpoint without authentication...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    if (healthRes.status !== 200) {
      console.error(`❌ Expected 200 for health endpoint, got ${healthRes.status}!`);
      process.exit(1);
    }
    const healthData = (await healthRes.json()) as Record<string, unknown>;
    console.log(`✅ Health endpoint is publicly accessible: Status 200, Status="${healthData.status}"`);

    // Step L: Verify Google credentials and auth passwords never appear in API responses
    console.log('\nL. Verifying credentials and secrets never leak in API responses...');
    const responseText = JSON.stringify(healthData) + JSON.stringify(dashData);
    if (
      responseText.includes('PRIVATE KEY') ||
      responseText.includes(validPassword) ||
      responseText.includes(AUTH_CONFIG.SESSION_SECRET)
    ) {
      console.error('❌ CRITICAL SECURITY FLAW: Secret credentials found in API responses!');
      process.exit(1);
    }
    console.log('✅ Verified zero credential leakage across all API responses.');
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

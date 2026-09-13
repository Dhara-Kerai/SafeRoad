/**
 * SafeRoads Production Readiness E2E Audit Script
 * Tests live AI-Service, Backend API, WebSocket Server, and RBAC workflows.
 */

const fs = require('fs');
const path = require('path');
const { io } = require('./frontend/node_modules/socket.io-client');

const BACKEND_URL = 'http://localhost:8000';
const AI_SERVICE_URL = 'http://127.0.0.1:8001';
const FRONTEND_URL = 'http://localhost:5173';

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function pass(name, detail = '') {
  results.passed.push({ name, detail });
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${name} ${detail ? `(${detail})` : ''}`);
}

function fail(name, error) {
  const errMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
  results.failed.push({ name, error: errMsg });
  console.log(`\x1b[31m✖ [FAIL]\x1b[0m ${name}: ${errMsg}`);
}

function warn(name, note) {
  results.warnings.push({ name, note });
  console.log(`\x1b[33m⚠ [WARN]\x1b[0m ${name}: ${note}`);
}

function extractCookieToken(headers) {
  let cookies = [];
  if (typeof headers.getSetCookie === 'function') {
    cookies = headers.getSetCookie();
  } else if (headers.get('set-cookie')) {
    cookies = [headers.get('set-cookie')];
  }

  for (const c of cookies) {
    const match = c.match(/token=([^;]+)/);
    if (match && match[1] && !c.includes('refreshToken')) {
      return match[1];
    }
  }
  return null;
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

// Multipart helper for file upload
async function uploadMultipart(endpoint, filePath, token) {
  const boundary = '----WebKitFormBoundarySafeRoadAudit' + Date.now();
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  let bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${token}`,
      'Cookie': `token=${token}`,
      'Content-Length': bodyBuffer.length.toString(),
    },
    body: bodyBuffer,
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, headers: response.headers, data };
}

async function runAudit() {
  console.log('================================================================');
  console.log('       SafeRoads Production Readiness Live E2E Audit Suite      ');
  console.log('================================================================\n');

  const runId = Math.random().toString(36).substring(2, 8);
  const testPassword = 'Password@12345';
  let citizenToken = '';
  let officerToken = '';
  let adminToken = '';
  let officerId = '';
  let createdReportId = '';
  let uploadedImageUrl = '';

  // -------------------------------------------------------------
  // PHASE 1: Health & Connectivity Checks
  // -------------------------------------------------------------
  console.log('\n--- Phase 1: Microservice & Server Health Checks ---');

  try {
    const aiHealth = await request(`${AI_SERVICE_URL}/health`);
    if (aiHealth.status === 200 && aiHealth.data?.status === 'healthy') {
      pass('AI Microservice Health', `Model: ${aiHealth.data?.model}`);
    } else {
      fail('AI Microservice Health', aiHealth.data);
    }
  } catch (err) {
    fail('AI Microservice Health', err);
  }

  try {
    const backendHealth = await request('/health');
    if (backendHealth.status === 200 && backendHealth.data?.status === 'OK') {
      pass('Backend API Health', backendHealth.data?.message);
    } else {
      fail('Backend API Health', backendHealth.data);
    }
  } catch (err) {
    fail('Backend API Health', err);
  }

  try {
    const frontendRes = await fetch(FRONTEND_URL);
    if (frontendRes.status === 200) {
      pass('Frontend Web Server Health', `HTTP ${frontendRes.status} OK`);
    } else {
      fail('Frontend Web Server Health', `HTTP status ${frontendRes.status}`);
    }
  } catch (err) {
    fail('Frontend Web Server Health', err);
  }

  // -------------------------------------------------------------
  // PHASE 2: Authentication & Role-Based Access Control (RBAC)
  // -------------------------------------------------------------
  console.log('\n--- Phase 2: Authentication & RBAC Validation ---');

  const citizenEmail = `audit_cit_${runId}@saferoad.org`;
  const officerEmail = `officer_audit_${runId}@saferoad.local`;
  const adminEmail = 'admin@saferoad.local';
  const adminPass = 'Admin@12345';

  // 2.1 Citizen Registration
  try {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Audit Citizen User',
        email: citizenEmail,
        password: testPassword,
      },
    });
    if (regRes.status === 201 && regRes.data?.status === 'success') {
      citizenToken = extractCookieToken(regRes.headers);
      pass('Citizen Registration', `User ID: ${regRes.data?.data?.user?.id}, Cookie Issued: ${!!citizenToken}`);
    } else {
      fail('Citizen Registration', regRes.data);
    }
  } catch (err) {
    fail('Citizen Registration', err);
  }

  // 2.2 Citizen Login
  try {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: citizenEmail, password: testPassword },
    });
    const token = extractCookieToken(loginRes.headers);
    if (loginRes.status === 200 && token) {
      citizenToken = token;
      pass('Citizen Login', `Role: ${loginRes.data.data.user.role}, Token Extracted`);
    } else {
      fail('Citizen Login', { status: loginRes.status, data: loginRes.data, tokenExtracted: !!token });
    }
  } catch (err) {
    fail('Citizen Login', err);
  }

  // 2.3 Admin Login
  try {
    const adminLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: adminPass },
    });
    const token = extractCookieToken(adminLoginRes.headers);
    if (adminLoginRes.status === 200 && token) {
      adminToken = token;
      pass('Admin Login', `Role: ${adminLoginRes.data.data.user.role}, Token Extracted`);
    } else {
      fail('Admin Login', { status: adminLoginRes.status, data: adminLoginRes.data, tokenExtracted: !!token });
    }
  } catch (err) {
    fail('Admin Login', err);
  }

  // 2.4 Admin Creates Officer
  try {
    const officerCreateRes = await request('/api/users/officers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Cookie: `token=${adminToken}`,
      },
      body: {
        fullName: 'Audit Field Officer',
        email: officerEmail,
        password: testPassword,
        department: 'Road Maintenance & Highway Safety',
        badgeNumber: `BDG-${runId.toUpperCase()}`,
      },
    });
    if (officerCreateRes.status === 201 && officerCreateRes.data?.status === 'success') {
      officerId = officerCreateRes.data.data.officer.id;
      pass('Admin Create Officer', `Officer ID: ${officerId}, Badge: BDG-${runId.toUpperCase()}`);
    } else {
      fail('Admin Create Officer', officerCreateRes.data);
    }
  } catch (err) {
    fail('Admin Create Officer', err);
  }

  // 2.5 Officer Login
  try {
    const offLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: officerEmail, password: testPassword },
    });
    const token = extractCookieToken(offLoginRes.headers);
    if (offLoginRes.status === 200 && token) {
      officerToken = token;
      pass('Officer Login', `Role: ${offLoginRes.data.data.user.role}, Token Extracted`);
    } else {
      fail('Officer Login', { status: offLoginRes.status, data: offLoginRes.data, tokenExtracted: !!token });
    }
  } catch (err) {
    fail('Officer Login', err);
  }

  // 2.6 RBAC Security Boundary Tests
  try {
    // Citizen attempts admin-only endpoint
    const citAdminTry = await request('/api/users/officers', {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
    });
    if (citAdminTry.status === 403) {
      pass('RBAC: Citizen blocked from Admin Officer List (403 Forbidden)');
    } else {
      fail('RBAC: Citizen blocked from Admin Officer List', `Expected 403, got ${citAdminTry.status}`);
    }

    // Officer attempts admin user listing
    const offAdminTry = await request('/api/users', {
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
    });
    if (offAdminTry.status === 403) {
      pass('RBAC: Officer blocked from Admin User List (403 Forbidden)');
    } else {
      fail('RBAC: Officer blocked from Admin User List', `Expected 403, got ${offAdminTry.status}`);
    }

    // Unauthenticated request
    const unauthTry = await request('/api/reports/my');
    if (unauthTry.status === 401) {
      pass('RBAC: Unauthenticated user blocked (401 Unauthorized)');
    } else {
      fail('RBAC: Unauthenticated user blocked', `Expected 401, got ${unauthTry.status}`);
    }
  } catch (err) {
    fail('RBAC Boundary Checks', err);
  }

  // -------------------------------------------------------------
  // PHASE 3: Citizen → AI Detection → Report Creation
  // -------------------------------------------------------------
  console.log('\n--- Phase 3: AI Detection & Report Creation Workflow ---');

  const testImagePath = path.join(__dirname, 'ai-service', 'dataset', 'images', 'val', 'img-1008.jpg');

  try {
    if (!fs.existsSync(testImagePath)) {
      fail('AI Detection Image File Check', `Test image not found at ${testImagePath}`);
    } else {
      // 3.1 Upload image via backend multipart upload
      const uploadRes = await uploadMultipart('/api/reports/upload', testImagePath, citizenToken);
      if (uploadRes.status === 200 && (uploadRes.data?.imageUrl || uploadRes.data?.image_url)) {
        uploadedImageUrl = uploadRes.data.imageUrl || uploadRes.data.image_url;
        pass('Report Image Upload', `Uploaded URL: ${uploadedImageUrl}`);
      } else {
        fail('Report Image Upload', uploadRes.data);
      }
    }
  } catch (err) {
    fail('Report Image Upload', err);
  }

  // 3.2 Citizen Submits Report with Uploaded Image URL (Triggers AI Microservice)
  try {
    const reportPayload = {
      title: `Dangerous Pothole on Sector 4 Main Road (${runId})`,
      description: 'Multiple deep potholes damaging vehicle suspensions. High collision risk during night hours.',
      latitude: 23.0225,
      longitude: 72.5714,
      address: 'Near Central Circle, Sector 4, Gandhinagar',
      city: 'Gandhinagar',
      imageUrl: uploadedImageUrl,
      severity: 'HIGH',
    };

    const createReportRes = await request('/api/reports', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
      body: reportPayload,
    });

    if (createReportRes.status === 201 && createReportRes.data?.data?.report?.id) {
      createdReportId = createReportRes.data.data.report.id;
      const aiResult = createReportRes.data.data.aiResult;
      const status = createReportRes.data.data.report.status;
      pass(
        'Citizen Report Creation & Automated AI Verification',
        `Report ID: ${createdReportId}, Status: ${status}, Pothole Detected: ${aiResult?.potholeDetected}, Conf: ${aiResult?.confidenceScore}`
      );
    } else {
      fail('Citizen Report Creation & Automated AI Verification', createReportRes.data);
    }
  } catch (err) {
    fail('Citizen Report Creation & Automated AI Verification', err);
  }

  // -------------------------------------------------------------
  // PHASE 4: Admin Assignment → Officer Status Transitions → Citizen Feedback
  // -------------------------------------------------------------
  console.log('\n--- Phase 4: Lifecycle, Assignment & Status Transitions ---');

  // 4.1 Admin Assigns Report to Officer
  try {
    const assignRes = await request(`/api/reports/${createdReportId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Cookie: `token=${adminToken}`,
      },
      body: { officerId: officerId },
    });
    if (assignRes.status === 200 && assignRes.data?.status === 'OFFICER_ASSIGNED') {
      pass('Admin Assign Report to Officer', `Assigned to: ${officerId}, Status: ${assignRes.data.status}`);
    } else if (assignRes.status === 200 && assignRes.data?.data?.report?.status === 'OFFICER_ASSIGNED') {
      pass('Admin Assign Report to Officer', `Assigned to: ${officerId}, Status: ${assignRes.data.data.report.status}`);
    } else {
      fail('Admin Assign Report to Officer', assignRes.data);
    }
  } catch (err) {
    fail('Admin Assign Report to Officer', err);
  }

  // 4.2 Officer Views Assigned Reports
  try {
    const assignedRes = await request('/api/reports/assigned', {
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
    });
    if (assignedRes.status === 200 && Array.isArray(assignedRes.data?.data)) {
      const found = assignedRes.data.data.some((r) => r.id === createdReportId);
      if (found) {
        pass('Officer Assignment Queue Query', `Found report ${createdReportId} in queue`);
      } else {
        fail('Officer Assignment Queue Query', `Report ${createdReportId} not in assigned reports list`);
      }
    } else {
      fail('Officer Assignment Queue Query', assignedRes.data);
    }
  } catch (err) {
    fail('Officer Assignment Queue Query', err);
  }

  // 4.3 Officer Workload Stats
  try {
    const workloadRes = await request('/api/reports/officer/workload', {
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
    });
    if (workloadRes.status === 200 && workloadRes.data?.data?.totalAssignedReports !== undefined) {
      pass(
        'Officer Workload Metrics',
        `Assigned: ${workloadRes.data.data.totalAssignedReports}, Pending: ${workloadRes.data.data.pendingReports}`
      );
    } else {
      fail('Officer Workload Metrics', workloadRes.data);
    }
  } catch (err) {
    fail('Officer Workload Metrics', workloadRes.data);
  }

  // 4.4 Officer Transitions Status to IN_PROGRESS
  try {
    const progressRes = await request(`/api/reports/${createdReportId}/officer-status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
      body: { status: 'IN_PROGRESS', remarks: 'Maintenance crew dispatched with cold patch asphalt.' },
    });
    if (progressRes.status === 200 && progressRes.data?.data?.report?.status === 'IN_PROGRESS') {
      pass('Officer Transition Status to IN_PROGRESS', `Status: IN_PROGRESS`);
    } else {
      fail('Officer Transition Status to IN_PROGRESS', progressRes.data);
    }
  } catch (err) {
    fail('Officer Transition Status to IN_PROGRESS', err);
  }

  // 4.5 Officer Adds Resolution Comment
  try {
    const commentRes = await request(`/api/reports/${createdReportId}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
      body: { comment: 'Pothole successfully filled, leveled and roller compacted. Road cleared for traffic.' },
    });
    if (commentRes.status === 201 && commentRes.data?.id) {
      pass('Officer Add Resolution Comment', `Comment ID: ${commentRes.data.id}`);
    } else {
      fail('Officer Add Resolution Comment', commentRes.data);
    }
  } catch (err) {
    fail('Officer Add Resolution Comment', err);
  }

  // 4.6 Officer Transitions Status to FIXED
  try {
    const resolveRes = await request(`/api/reports/${createdReportId}/officer-status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        Cookie: `token=${officerToken}`,
      },
      body: { status: 'FIXED' },
    });
    if (resolveRes.status === 200 && resolveRes.data?.data?.report?.status === 'FIXED') {
      pass('Officer Transition Status to FIXED', `Status: FIXED`);
    } else {
      fail('Officer Transition Status to FIXED', resolveRes.data);
    }
  } catch (err) {
    fail('Officer Transition Status to FIXED', resolveRes.data);
  }

  // 4.7 Citizen Views Updated Report & Comments
  try {
    const citViewRes = await request(`/api/reports/${createdReportId}`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
    });
    const commentsRes = await request(`/api/reports/${createdReportId}/comments`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
    });

    if (
      citViewRes.status === 200 &&
      citViewRes.data?.status === 'FIXED' &&
      commentsRes.status === 200 &&
      Array.isArray(commentsRes.data) &&
      commentsRes.data.length > 0
    ) {
      pass('Citizen Report & Comment Verification', `Verified status FIXED with ${commentsRes.data.length} comment(s)`);
    } else {
      fail('Citizen Report & Comment Verification', { citViewRes: citViewRes.data, commentsRes: commentsRes.data });
    }
  } catch (err) {
    fail('Citizen Report & Comment Verification', err);
  }

  // 4.8 Notifications Check
  try {
    const notifRes = await request('/api/notifications', {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
    });
    if (notifRes.status === 200 && Array.isArray(notifRes.data?.data)) {
      pass('Citizen Notifications Retrieval', `Total Notifications: ${notifRes.data.data.length}`);
      if (notifRes.data.data.length > 0) {
        const firstNotif = notifRes.data.data[0];
        const markRead = await request(`/api/notifications/${firstNotif.id}/read`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${citizenToken}`,
            Cookie: `token=${citizenToken}`,
          },
        });
        if (markRead.status === 200) {
          pass('Citizen Mark Notification Read', `Notification ID: ${firstNotif.id}`);
        } else {
          fail('Citizen Mark Notification Read', markRead.data);
        }
      }
    } else {
      fail('Citizen Notifications Retrieval', notifRes.data);
    }
  } catch (err) {
    fail('Citizen Notifications Retrieval', err);
  }

  // -------------------------------------------------------------
  // PHASE 5: Live Map & Analytics
  // -------------------------------------------------------------
  console.log('\n--- Phase 5: Live Map & Analytics Endpoints ---');

  try {
    const mapRes = await request('/api/reports/map', {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        Cookie: `token=${citizenToken}`,
      },
    });
    if (mapRes.status === 200 && Array.isArray(mapRes.data?.data)) {
      pass('Live Map Reports Feed', `Total Geo-markers: ${mapRes.data.data.length}`);
    } else {
      fail('Live Map Reports Feed', mapRes.data);
    }
  } catch (err) {
    fail('Live Map Reports Feed', err);
  }

  // Dashboard endpoint
  try {
    const dashRes = await request('/api/analytics/dashboard', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Cookie: `token=${adminToken}`,
      },
    });
    if (dashRes.status === 200 && dashRes.data?.status === 'success') {
      pass('Analytics Endpoint: Dashboard Overview', `Total Reports: ${dashRes.data.data.totalReports}`);
    } else {
      fail('Analytics Endpoint: Dashboard Overview', dashRes.data);
    }
  } catch (err) {
    fail('Analytics Endpoint: Dashboard Overview', err);
  }

  // Array distribution endpoints
  const arrayAnalyticsEndpoints = [
    { path: '/api/analytics/status-distribution', label: 'Status Distribution' },
    { path: '/api/analytics/severity-distribution', label: 'Severity Distribution' },
    { path: '/api/analytics/reports-by-city', label: 'Reports By City' },
    { path: '/api/analytics/monthly-trends', label: 'Monthly Trends' },
    { path: '/api/analytics/department-performance', label: 'Department Performance' },
    { path: '/api/analytics/officer-performance', label: 'Officer Performance' },
    { path: '/api/analytics/recent', label: 'Recent Activity' },
  ];

  for (const ep of arrayAnalyticsEndpoints) {
    try {
      const res = await request(ep.path, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          Cookie: `token=${adminToken}`,
        },
      });
      if (res.status === 200 && Array.isArray(res.data)) {
        pass(`Analytics Endpoint: ${ep.label}`, `Returned ${res.data.length} item(s)`);
      } else {
        fail(`Analytics Endpoint: ${ep.label}`, res.data);
      }
    } catch (err) {
      fail(`Analytics Endpoint: ${ep.label}`, err);
    }
  }

  // -------------------------------------------------------------
  // PHASE 6: Real-time WebSocket / Socket.IO Tests
  // -------------------------------------------------------------
  console.log('\n--- Phase 6: Real-time WebSocket / Socket.IO Integration ---');

  await new Promise((resolve) => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 2,
      timeout: 3000,
      auth: {
        token: citizenToken,
      },
      extraHeaders: {
        Cookie: `token=${citizenToken}`,
      },
    });

    let connected = false;

    socket.on('connect', () => {
      connected = true;
      pass('Socket.IO Authenticated Handshake', `Socket ID: ${socket.id}`);
      
      socket.emit('join');
      
      socket.on('joined', (data) => {
        pass('Socket.IO Room Join Event', `User: ${data?.userId}, Role: ${data?.role}`);
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 300);
      });

      setTimeout(() => {
        if (connected) {
          socket.disconnect();
          resolve();
        }
      }, 1500);
    });

    socket.on('connect_error', (err) => {
      fail('Socket.IO Authenticated Handshake', err);
      socket.disconnect();
      resolve();
    });

    setTimeout(() => {
      if (!connected) {
        fail('Socket.IO Authenticated Handshake', 'Timed out after 3000ms');
        socket.disconnect();
        resolve();
      }
    }, 3500);
  });

  // -------------------------------------------------------------
  // PHASE 7: Security Headers & Production Configuration Audit
  // -------------------------------------------------------------
  console.log('\n--- Phase 7: Security Headers & Production Configuration ---');

  try {
    const secRes = await request('/health');
    const h = secRes.headers;

    if (h.get('x-frame-options') || h.get('x-content-type-options')) {
      pass('Helmet Security Headers Active', 'X-Frame-Options, X-Content-Type-Options present');
    } else {
      warn('Helmet Security Headers Partial', 'Some security headers may be missing or altered');
    }

    // CORS preflight test
    const corsRes = await fetch(`${BACKEND_URL}/api/reports`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,Content-Type',
      },
    });

    if (corsRes.status === 200 || corsRes.status === 204) {
      pass('CORS Preflight Check', `Allowed for http://localhost:5173 (Status: ${corsRes.status})`);
    } else {
      fail('CORS Preflight Check', `Expected 200/204, got ${corsRes.status}`);
    }
  } catch (err) {
    fail('Security & CORS Audit', err);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                   E2E AUDIT EXECUTION SUMMARY                  ');
  console.log('================================================================');
  console.log(`Total Checks Executed : ${results.passed.length + results.failed.length}`);
  console.log(`Passed Checks          : \x1b[32m${results.passed.length}\x1b[0m`);
  console.log(`Failed Checks          : \x1b[31m${results.failed.length}\x1b[0m`);
  console.log(`Warnings / Notes       : \x1b[33m${results.warnings.length}\x1b[0m`);
  console.log('================================================================\n');

  if (results.failed.length > 0) {
    console.log('Failures list:');
    results.failed.forEach((f) => console.log(` - ${f.name}: ${f.error}`));
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit suite error:', err);
});

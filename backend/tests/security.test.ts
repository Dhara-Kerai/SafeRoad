import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/db';
import { hashPassword } from '../src/utils/password';
import { generateToken } from '../src/utils/jwt';

describe('Report security regressions', () => {
  const suffix = Date.now();
  let ownerId: string;
  let otherUserId: string;
  let officerUserId: string;
  let officerId: string;
  let reportId: string;
  let otherReportId: string;
  let ownerToken: string;
  let otherToken: string;
  let officerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const password = await hashPassword('Password123!');
    const [owner, other, officerUser, admin] = await Promise.all([
      prisma.user.create({ data: { fullName: 'Report Owner', email: `owner_${suffix}@saferoad.test`, password, role: 'USER' } }),
      prisma.user.create({ data: { fullName: 'Other Citizen', email: `other_${suffix}@saferoad.test`, password, role: 'USER' } }),
      prisma.user.create({ data: { fullName: 'Assigned Officer', email: `officer_security_${suffix}@saferoad.test`, password, role: 'OFFICER' } }),
      prisma.user.create({ data: { fullName: 'Security Admin', email: `admin_security_${suffix}@saferoad.test`, password, role: 'ADMIN' } }),
    ]);
    ownerId = owner.id;
    otherUserId = other.id;
    officerUserId = officerUser.id;
    const department = await prisma.department.upsert({ where: { name: 'Security Test Department' }, update: {}, create: { name: 'Security Test Department' } });
    const officer = await prisma.officer.create({ data: { userId: officerUser.id, departmentId: department.id, badgeNumber: `SEC-${suffix}` } });
    officerId = officer.id;
    const report = await prisma.report.create({ data: { userId: owner.id, title: 'Security test pothole', description: 'A report used only for authorization regression tests.', latitude: 23.02, longitude: 72.57, address: 'Security Lane', city: 'Ahmedabad', officerId: officer.id, status: 'OFFICER_ASSIGNED' } });
    reportId = report.id;
    const otherReport = await prisma.report.create({ data: { userId: other.id, title: 'Other citizen pothole', description: 'A separate report used to verify map visibility boundaries.', latitude: 23.03, longitude: 72.58, address: 'Other Security Lane', city: 'Ahmedabad' } });
    otherReportId = otherReport.id;
    ownerToken = generateToken({ userId: owner.id, email: owner.email, role: 'USER' });
    otherToken = generateToken({ userId: other.id, email: other.email, role: 'USER' });
    officerToken = generateToken({ userId: officerUser.id, email: officerUser.email, role: 'OFFICER' });
    adminToken = generateToken({ userId: admin.id, email: admin.email, role: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { reportId } });
    await prisma.report.deleteMany({ where: { id: { in: [reportId, otherReportId] } } });
    await prisma.officer.deleteMany({ where: { id: officerId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId, officerUserId] } } });
    await prisma.user.deleteMany({ where: { email: `admin_security_${suffix}@saferoad.test` } });
    await prisma.$disconnect();
  });

  it('requires authentication and enforces report ownership', async () => {
    expect((await request(app).get(`/api/reports/${reportId}`)).status).toBe(401);
    expect((await request(app).get(`/api/reports/${reportId}`).set('Authorization', `Bearer ${ownerToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/reports/${reportId}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
  });

  it('allows comments only for users authorized to access the report', async () => {
    expect((await request(app).post(`/api/reports/${reportId}/comments`).set('Authorization', `Bearer ${ownerToken}`).send({ comment: 'Owner comment' })).status).toBe(201);
    expect((await request(app).post(`/api/reports/${reportId}/comments`).set('Authorization', `Bearer ${otherToken}`).send({ comment: 'Unauthorized comment' })).status).toBe(403);
    expect((await request(app).get(`/api/reports/${reportId}/comments`).set('Authorization', `Bearer ${officerToken}`)).status).toBe(200);
  });

  it('returns only backend-authorized reports from the map endpoint', async () => {
    const ownerMap = await request(app).get('/api/reports/map').set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerMap.status).toBe(200);
    expect(ownerMap.body.data.map((report: { id: string }) => report.id)).toContain(reportId);
    expect(ownerMap.body.data.map((report: { id: string }) => report.id)).not.toContain(otherReportId);

    const otherMap = await request(app).get('/api/reports/map').set('Authorization', `Bearer ${otherToken}`);
    expect(otherMap.status).toBe(200);
    expect(otherMap.body.data.map((report: { id: string }) => report.id)).toContain(otherReportId);
    expect(otherMap.body.data.map((report: { id: string }) => report.id)).not.toContain(reportId);

    const officerMap = await request(app).get('/api/reports/map').set('Authorization', `Bearer ${officerToken}`);
    expect(officerMap.status).toBe(200);
    expect(officerMap.body.data.map((report: { id: string }) => report.id)).toContain(reportId);
    expect(officerMap.body.data.map((report: { id: string }) => report.id)).not.toContain(otherReportId);

    const adminMap = await request(app).get('/api/reports/map').set('Authorization', `Bearer ${adminToken}`);
    expect(adminMap.status).toBe(200);
    expect(adminMap.body.data.map((report: { id: string }) => report.id)).toEqual(expect.arrayContaining([reportId, otherReportId]));
  });

  it('restricts global analytics to administrators while retaining scoped dashboards', async () => {
    expect((await request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(200);
    expect((await request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${officerToken}`)).status).toBe(200);
    expect((await request(app).get('/api/analytics/status-distribution').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/analytics/severity-distribution').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/analytics/severity-distribution').set('Authorization', `Bearer ${officerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/analytics/recent').set('Authorization', `Bearer ${officerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/analytics/status-distribution').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).get('/api/analytics/severity-distribution').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  it('isolates officer assignments and enforces the officer status workflow', async () => {
    const assigned = await request(app).get('/api/reports/assigned').set('Authorization', `Bearer ${officerToken}`);
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.map((report: { id: string }) => report.id)).toContain(reportId);
    expect((await request(app).get('/api/reports/assigned').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/assigned').set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).get('/api/reports/assigned')).status).toBe(401);

    const workload = await request(app).get('/api/reports/officer/workload').set('Authorization', `Bearer ${officerToken}`);
    expect(workload.status).toBe(200);
    expect(workload.body.data.totalAssignedReports).toBe(1);
    expect(workload.body.data.pendingReports).toBe(1);
    expect(workload.body.data.fixedReports).toBe(0);
    expect(workload.body.data.qualityCheckReports).toBe(0);
    expect(workload.body.data.completedReports).toBe(0);
    expect(workload.body.data.closedReports).toBe(0);

    expect((await request(app).patch(`/api/reports/${reportId}/officer-status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'FIXED' })).status).toBe(403);
    expect((await request(app).patch(`/api/reports/${reportId}/officer-status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'IN_PROGRESS', remarks: 'Repair crew dispatched.' })).status).toBe(200);
    const comments = await request(app).get(`/api/reports/${reportId}/comments`).set('Authorization', `Bearer ${officerToken}`);
    expect(comments.body.some((comment: { content: string; user_id: string }) => comment.content === 'Repair crew dispatched.' && comment.user_id === officerUserId)).toBe(true);
    expect((await request(app).patch(`/api/reports/${reportId}/officer-status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'FIXED' })).status).toBe(200);
    const fixedWorkload = await request(app).get('/api/reports/officer/workload').set('Authorization', `Bearer ${officerToken}`);
    expect(fixedWorkload.body.data.fixedReports).toBe(1);
    expect(fixedWorkload.body.data.completedReports).toBe(0);
    expect((await request(app).patch(`/api/reports/${reportId}/officer-status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'IN_PROGRESS' })).status).toBe(403);

    // Final review stages are deliberately admin-owned and strictly forward-only.
    expect((await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'QUALITY_CHECK' })).status).toBe(403);

    const qualityCheck = await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'QUALITY_CHECK' });
    expect(qualityCheck.status).toBe(200);
    expect(qualityCheck.body.status).toBe('QUALITY_CHECK');
    const qualityCheckWorkload = await request(app).get('/api/reports/officer/workload').set('Authorization', `Bearer ${officerToken}`);
    expect(qualityCheckWorkload.body.data.fixedReports).toBe(0);
    expect(qualityCheckWorkload.body.data.qualityCheckReports).toBe(1);

    // A quality-check report cannot be moved back into repair.
    expect((await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'IN_PROGRESS' })).status).toBe(403);

    const completed = await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    const completedWorkload = await request(app).get('/api/reports/officer/workload').set('Authorization', `Bearer ${officerToken}`);
    expect(completedWorkload.body.data.completedReports).toBe(1);
    expect(completedWorkload.body.data.closedReports).toBe(0);

    // Completion is finalizable only by closing; no reverse status is accepted.
    expect((await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'QUALITY_CHECK' })).status).toBe(403);

    const closed = await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'CLOSED' });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');
    const closedWorkload = await request(app).get('/api/reports/officer/workload').set('Authorization', `Bearer ${officerToken}`);
    expect(closedWorkload.body.data.closedReports).toBe(1);
    expect(closedWorkload.body.data.completedReports).toBe(0);
    expect((await request(app).patch(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'COMPLETED' })).status).toBe(403);
  });

  it('searches only authorized reports using report metadata and RBAC-scoped access', async () => {
    const ownerSearch = await request(app).get('/api/reports/search?q=security').set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerSearch.status).toBe(200);
    expect(ownerSearch.body.data.some((report: { id: string }) => report.id === reportId)).toBe(true);
    expect(ownerSearch.body.data.some((report: { id: string }) => report.id === otherReportId)).toBe(false);

    const otherSearch = await request(app).get('/api/reports/search?q=security').set('Authorization', `Bearer ${otherToken}`);
    expect(otherSearch.status).toBe(200);
    expect(otherSearch.body.data.some((report: { id: string }) => report.id === reportId)).toBe(false);
    expect(otherSearch.body.data.some((report: { id: string }) => report.id === otherReportId)).toBe(true);

    const officerSearch = await request(app).get('/api/reports/search?q=security').set('Authorization', `Bearer ${officerToken}`);
    expect(officerSearch.status).toBe(200);
    expect(officerSearch.body.data.some((report: { id: string }) => report.id === reportId)).toBe(true);
    expect(officerSearch.body.data.some((report: { id: string }) => report.id === otherReportId)).toBe(false);

    const adminSearch = await request(app).get('/api/reports/search?q=security').set('Authorization', `Bearer ${adminToken}`);
    expect(adminSearch.status).toBe(200);
    expect(adminSearch.body.data.map((report: { id: string }) => report.id)).toEqual(expect.arrayContaining([reportId, otherReportId]));

    const emptySearch = await request(app).get('/api/reports/search?q=').set('Authorization', `Bearer ${ownerToken}`);
    expect(emptySearch.status).toBe(200);
    expect(emptySearch.body.data).toEqual([]);
  });

  it('allows users to update only their profile name and change their password securely', async () => {
    const profileResponse = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'Updated Report Owner', role: 'ADMIN' });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.fullName).toBe('Updated Report Owner');
    expect(profileResponse.body.data.user.role).toBe('USER');

    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(profile.body.data.user.fullName).toBe('Updated Report Owner');
    expect(profile.body.data.user.role).toBe('USER');

    const wrongPassword = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'NewPassword123', confirmPassword: 'NewPassword123' });
    expect(wrongPassword.status).toBe(400);

    const mismatch = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123', confirmPassword: 'DifferentPassword123' });
    expect(mismatch.status).toBe(400);

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123', confirmPassword: 'NewPassword123' });
    expect(changed.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: `owner_${suffix}@saferoad.test`, password: 'NewPassword123' });
    expect(login.status).toBe(200);
  });

  it('blocks other users and officers from deleting reports while allowing admin management', async () => {
    expect((await request(app).delete(`/api/reports/${reportId}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    expect((await request(app).delete(`/api/reports/${reportId}`).set('Authorization', `Bearer ${officerToken}`)).status).toBe(403);
    expect((await request(app).delete(`/api/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    reportId = '';
  });

  it('rejects traversal image paths before report creation', async () => {
    const response = await request(app).post('/api/reports').set('Authorization', `Bearer ${ownerToken}`).send({ title: 'Traversal attempt', description: 'This request must not be allowed to read arbitrary files.', latitude: 23.02, longitude: 72.57, address: 'Security Lane', city: 'Ahmedabad', imageUrl: '../../.env' });
    expect(response.status).toBe(400);
  });

  it('returns the same forgot-password response for an unknown email', async () => {
    const response = await request(app).post('/api/auth/forgot-password').send({ email: `missing_${suffix}@saferoad.test` });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', message: 'A verification code has been sent to your email address.' });
  });

  it('completes forgot-password for registered user in test mode without SMTP error', async () => {
    const response = await request(app).post('/api/auth/forgot-password').send({ email: `owner_${suffix}@saferoad.test` });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.message).toBe('A verification code has been sent to your email address.');
    expect(response.body.data?.otp).toBeDefined();
  });

  it('rejects image upload with invalid magic bytes despite valid mimetype', async () => {
    const fakeBuffer = Buffer.from('NOT_AN_IMAGE_FILE_HEADER_TEXT');
    const response = await request(app)
      .post('/api/uploads/report-image')
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('image', fakeBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/magic bytes/i);
  });

  it('enforces RBAC access boundaries on report attachments', async () => {
    const att = await prisma.attachment.create({
      data: {
        reportId: otherReportId,
        url: '/uploads/reports/test.jpg',
        fileType: 'IMAGE',
      },
    });

    // Unauthenticated request is rejected (401)
    expect((await request(app).get(`/api/reports/${otherReportId}/attachments/${att.id}`)).status).toBe(401);

    // Non-owner citizen is forbidden (403)
    expect((await request(app).get(`/api/reports/${otherReportId}/attachments/${att.id}`).set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403);

    // Report owner has permission (returns 404 because file test.jpg doesn't exist on disk, not 403)
    const ownerRes = await request(app).get(`/api/reports/${otherReportId}/attachments/${att.id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(ownerRes.status).toBe(404);

    await prisma.attachment.deleteMany({ where: { id: att.id } });
  });
});

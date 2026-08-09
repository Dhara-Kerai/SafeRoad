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
    const report = await prisma.report.create({ data: { userId: owner.id, title: 'Security test pothole', description: 'A report used only for authorization regression tests.', latitude: 23.02, longitude: 72.57, address: 'Security Lane', city: 'Ahmedabad', officerId: officer.id } });
    reportId = report.id;
    ownerToken = generateToken({ userId: owner.id, email: owner.email, role: 'USER' });
    otherToken = generateToken({ userId: other.id, email: other.email, role: 'USER' });
    officerToken = generateToken({ userId: officerUser.id, email: officerUser.email, role: 'OFFICER' });
    adminToken = generateToken({ userId: admin.id, email: admin.email, role: 'ADMIN' });
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { reportId } });
    await prisma.report.deleteMany({ where: { id: reportId } });
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
});

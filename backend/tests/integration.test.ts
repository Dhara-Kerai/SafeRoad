import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/db';
import { generateToken } from '../src/utils/jwt';
import * as authService from '../src/services/authService';
import { hashPassword } from '../src/utils/password';

const getSetCookies = (headers: Record<string, unknown>): string[] => {
  const value = headers['set-cookie'];
  return Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
};

describe('SafeRoad Report Lifecycle Integration Test Suite', () => {
  let citizenToken: string;
  let citizenCookie: string;
  let officerToken: string;
  let officerCookie: string;
  let officerId: string;
  let adminId: string;
  let adminToken: string;
  let reportId: string;

  const citizenUser = {
    fullName: 'Citizen Tester',
    email: `citizen_${Date.now()}@saferoad.test`,
    password: 'Password123!',
  };

  const officerUser = {
    fullName: 'Officer Tester',
    email: `officer_${Date.now()}@saferoad.test`,
    password: 'Password123!',
  };

  beforeAll(async () => {
    // Ensure database connection is established
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      if (reportId) {
        await prisma.comment.deleteMany({ where: { reportId } });
        await prisma.aIResult.deleteMany({ where: { reportId } });
        await prisma.attachment.deleteMany({ where: { reportId } });
        await prisma.report.deleteMany({ where: { id: reportId } });
      }
      if (officerId) {
        await prisma.officer.deleteMany({ where: { id: officerId } });
      }
      await prisma.user.deleteMany({
        where: {
          email: { in: [citizenUser.email, officerUser.email, `admin_${citizenUser.email}`] },
        },
      });

    } catch (e) {
      console.warn('Cleanup error:', e);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('1. Should register citizen and officer users', async () => {
    const admin = await prisma.user.create({
      data: {
        fullName: 'Admin Tester',
        email: `admin_${citizenUser.email}`,
        password: 'not-used-in-test',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;
    adminToken = generateToken({ userId: admin.id, email: admin.email, role: admin.role });

    // Register citizen
    const resCitizen = await request(app)
      .post('/api/auth/register')
      .send(citizenUser);

    expect(resCitizen.status).toBe(201);
    expect(resCitizen.body.status).toBe('success');
    expect(resCitizen.body.access_token).toBeUndefined();
    citizenToken = generateToken({ userId: resCitizen.body.data.user.id, email: citizenUser.email, role: 'USER' });
    if (resCitizen.headers['set-cookie']) {
      citizenCookie = resCitizen.headers['set-cookie'][0];
    }

    // Register officer
    const resOfficer = await request(app)
      .post('/api/auth/register')
      .send(officerUser);

    expect(resOfficer.status).toBe(201);
    expect(resOfficer.body.status).toBe('success');
    expect(resOfficer.body.access_token).toBeUndefined();
    const officerUserId = resOfficer.body.data.user.id;
    if (resOfficer.headers['set-cookie']) {
      officerCookie = resOfficer.headers['set-cookie'][0];
    }

    const promoteRes = await request(app)
      .patch(`/api/users/${officerUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'OFFICER' });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.data.user.role).toBe('OFFICER');
    officerToken = generateToken({ userId: officerUserId, email: officerUser.email, role: 'OFFICER' });

    // Create department & officer profile for assignment FK constraint test
    const dept = await prisma.department.upsert({
      where: { name: 'Road Maintenance' },
      update: {},
      create: { name: 'Road Maintenance' },
    });

    const officerRec = await prisma.officer.create({
      data: {
        userId: officerUserId,
        departmentId: dept.id,
        badgeNumber: `BADGE-${Date.now()}`,
      },
    });
    officerId = officerRec.id;
  });


  it('2. Should authenticate user and retrieve profile', async () => {
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: citizenUser.email,
        password: citizenUser.password,
      });

    expect(resLogin.status).toBe(200);
    expect(resLogin.body.access_token).toBeUndefined();

    const resProfile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(resProfile.status).toBe(200);
    expect(resProfile.body.data.user.email).toBe(citizenUser.email);
  });

  it('3. Should create a new pothole report (Step 1 of Lifecycle)', async () => {
    const reportPayload = {
      title: 'Deep pothole on Main Street',
      description: 'Severe road pothole causing traffic slowdown near central junction.',
      severity: 'HIGH',
      latitude: 23.0225,
      longitude: 72.5714,
      address: 'Main Street, Ward 4, Ahmedabad',
      city: 'Ahmedabad',
    };

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send(reportPayload);

    expect(res.status).toBe(201);
    expect(res.body.id || res.body.data?.report?.id).toBeDefined();
    reportId = res.body.id || res.body.data?.report?.id;
    expect(res.body.status).toBe('REPORTED');
  });

  it('4. Should simulate AI detection results attached to report (Step 2 of Lifecycle)', async () => {
    // Manually insert an AI result to simulate AI service callback / pipeline
    const aiResult = await prisma.aIResult.create({
      data: {
        reportId,
        potholeDetected: true,
        confidenceScore: 0.945,
        details: JSON.stringify({
          totalDetections: 1,
          primarySeverity: 'High',
          modelVersion: 'YOLOv8-best',
        }),
      },
    });

    expect(aiResult.id).toBeDefined();

    // Update report status to AI_VERIFIED
    const updateRes = await request(app)
      .patch(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AI_VERIFIED' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('AI_VERIFIED');
  });

  it('5. Should allow admin assignment and then officer workflow updates (Step 3 & 4 of Lifecycle)', async () => {
    const res = await request(app)
      .patch(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'OFFICER_ASSIGNED',
        officerId,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OFFICER_ASSIGNED');
    expect(res.body.officerId || res.body.assigned_to).toBe(officerId);
  });

  it('6. Should allow posting and fetching report comments', async () => {
    const commentRes = await request(app)
      .post(`/api/reports/${reportId}/comments`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ comment: 'Inspection complete. When will repair start?' });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment || commentRes.body.content).toBe('Inspection complete. When will repair start?');

    const getCommentsRes = await request(app)
      .get(`/api/reports/${reportId}/comments`)
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(getCommentsRes.status).toBe(200);
    expect(Array.isArray(getCommentsRes.body)).toBe(true);
    expect(getCommentsRes.body.length).toBeGreaterThanOrEqual(1);
  });

  it('7. Should transition report through repair to completion (Step 5 of Lifecycle)', async () => {
    // Transition to IN_PROGRESS
    const inProgressRes = await request(app)
      .patch(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(inProgressRes.status).toBe(200);
    expect(inProgressRes.body.status).toBe('IN_PROGRESS');

    // Transition to FIXED / RESOLVED
    const fixedRes = await request(app)
      .patch(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ status: 'FIXED' });

    expect(fixedRes.status).toBe(200);
    expect(fixedRes.body.status).toBe('FIXED');
  });

  it('8. Locks a password reset after five failed OTP attempts and rejects the correct OTP while locked', async () => {
    const otp = await authService.requestPasswordReset({ email: citizenUser.email });
    expect(otp).toBeDefined();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        authService.verifyPasswordResetOtp({ email: citizenUser.email, code: '000000' })
      ).rejects.toThrow('Recovery credentials are invalid, expired, or temporarily locked');
    }

    const reset = await prisma.passwordReset.findFirst({
      where: { user: { email: citizenUser.email } },
      orderBy: { createdAt: 'desc' },
    });
    expect(reset?.failedAttempts).toBe(5);
    expect(reset?.lockedUntil).not.toBeNull();

    await expect(
      authService.verifyPasswordResetOtp({ email: citizenUser.email, code: otp! })
    ).rejects.toThrow('Recovery credentials are invalid, expired, or temporarily locked');

    await prisma.passwordReset.update({
      where: { id: reset!.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });

    await expect(
      authService.verifyPasswordResetOtp({ email: citizenUser.email, code: otp! })
    ).resolves.toEqual(expect.any(String));
  }, 15000);

  it('9. Rotates refresh tokens, revokes them on logout, and rejects expired refresh tokens', async () => {
    const refreshUser = {
      fullName: 'Refresh Token Tester',
      email: `refresh_${Date.now()}@saferoad.test`,
      password: 'Password123!',
    };
    const registerResponse = await request(app).post('/api/auth/register').send(refreshUser);
    expect(registerResponse.status).toBe(201);
    const initialRefreshCookie = getSetCookies(registerResponse.headers)
      .find((cookie) => cookie.startsWith('refreshToken='));
    expect(initialRefreshCookie).toBeDefined();

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', initialRefreshCookie!);
    expect(refreshResponse.status).toBe(200);
    expect(getSetCookies(refreshResponse.headers)
      .some((cookie) => cookie.startsWith('token='))).toBe(true);
    const rotatedRefreshCookie = getSetCookies(refreshResponse.headers)
      .find((cookie) => cookie.startsWith('refreshToken='));
    expect(rotatedRefreshCookie).toBeDefined();

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', rotatedRefreshCookie!);
    expect(logoutResponse.status).toBe(200);
    const revokedRefreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedRefreshCookie!);
    expect(revokedRefreshResponse.status).toBe(401);

    const refreshUserId = registerResponse.body.data.user.id;
    const expiredSecret = 'expired-refresh-token-secret';
    const expiredToken = await prisma.refreshToken.create({
      data: {
        userId: refreshUserId,
        tokenHash: await hashPassword(expiredSecret),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      authService.rotateRefreshToken(`${expiredToken.id}.${expiredSecret}`)
    ).rejects.toThrow('Invalid or expired refresh token');

    await prisma.user.delete({ where: { id: refreshUserId } });
  });

  it('10. Revokes the refresh-token chain when a rotated token is replayed', async () => {
    const reuseUser = {
      fullName: 'Refresh Reuse Tester',
      email: `refresh_reuse_${Date.now()}@saferoad.test`,
      password: 'Password123!',
    };
    const registerResponse = await request(app).post('/api/auth/register').send(reuseUser);
    expect(registerResponse.status).toBe(201);
    const originalRefreshCookie = getSetCookies(registerResponse.headers)
      .find((cookie) => cookie.startsWith('refreshToken='));
    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalRefreshCookie!);
    expect(firstRefresh.status).toBe(200);
    const newestRefreshCookie = getSetCookies(firstRefresh.headers)
      .find((cookie) => cookie.startsWith('refreshToken='));

    const replayResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalRefreshCookie!);
    expect(replayResponse.status).toBe(401);

    const newestTokenResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', newestRefreshCookie!);
    expect(newestTokenResponse.status).toBe(401);
    const reuseUserId = registerResponse.body.data.user.id;
    expect(await prisma.refreshToken.count({ where: { userId: reuseUserId } })).toBe(0);

    await prisma.user.delete({ where: { id: reuseUserId } });
  });

  it('11. Locks an account after five failed logins and allows login after the lock expires', async () => {
    const loginLockUser = {
      fullName: 'Login Lockout Tester',
      email: `login_lock_${Date.now()}@saferoad.test`,
      password: 'Password123!',
    };
    const user = await authService.registerUser(loginLockUser);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        authService.loginUser({ email: loginLockUser.email, password: 'wrong-password' })
      ).rejects.toThrow('Invalid email or password');
    }

    const lockedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.lockedUntil).not.toBeNull();
    await expect(
      authService.loginUser({ email: loginLockUser.email, password: loginLockUser.password })
    ).rejects.toThrow('Invalid email or password');

    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });
    await expect(
      authService.loginUser({ email: loginLockUser.email, password: loginLockUser.password })
    ).resolves.toMatchObject({ user: { id: user.id } });

    const unlockedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(unlockedUser?.failedLoginAttempts).toBe(0);
    expect(unlockedUser?.lockedUntil).toBeNull();
    await prisma.user.delete({ where: { id: user.id } });
  });
});

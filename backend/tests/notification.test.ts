import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/db';
import { generateToken } from '../src/utils/jwt';
import * as notificationService from '../src/services/notificationService';
import { NotificationType } from '@prisma/client';

describe('SafeRoad Notification System Integration & Unit Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let notifAId: string;

  const userA = {
    fullName: 'User A',
    email: `usera_${Date.now()}@saferoad.test`,
    password: 'Password123!',
    role: 'USER' as const,
  };

  const userB = {
    fullName: 'User B',
    email: `userb_${Date.now()}@saferoad.test`,
    password: 'Password123!',
    role: 'USER' as const,
  };

  beforeAll(async () => {
    await prisma.$connect();

    // Create Test User A
    const createdA = await prisma.user.create({
      data: {
        fullName: userA.fullName,
        email: userA.email,
        password: '$2b$10$e7c10b...', // mock hash
        role: userA.role,
      },
    });
    userAId = createdA.id;
    userAToken = generateToken({ userId: userAId, email: userA.email, role: userA.role });

    // Create Test User B
    const createdB = await prisma.user.create({
      data: {
        fullName: userB.fullName,
        email: userB.email,
        password: '$2b$10$e7c10b...', // mock hash
        role: userB.role,
      },
    });
    userBId = createdB.id;
    userBToken = generateToken({ userId: userBId, email: userB.email, role: userB.role });
  });

  afterAll(async () => {
    try {
      await prisma.notification.deleteMany({
        where: { userId: { in: [userAId, userBId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
    } catch (e) {
      console.warn('Cleanup warning:', e);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('1. Service: createNotification persists DB notification', async () => {
    const created = await notificationService.createNotification({
      userId: userAId,
      title: 'Test Title',
      message: 'Test message for user A',
      type: NotificationType.REPORT,
    });

    expect(created).toBeDefined();
    expect(created.title).toBe('Test Title');
    expect(created.read).toBe(false);
    notifAId = created.id;
  });

  test('2. API: GET /api/notifications requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  test('3. API: GET /api/notifications fetches authenticated user notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((n: any) => n.id === notifAId)).toBe(true);
  });

  test('4. API: GET /api/notifications/unread-count returns correct unread count', async () => {
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(typeof res.body.unreadCount).toBe('number');
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
  });

  test('5. API: PATCH /api/notifications/:id/read marks notification read', async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notifAId}/read`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.read).toBe(true);
  });

  test('6. Security: User B cannot mark User A notification as read (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notifAId}/read`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
  });

  test('7. Security: User B cannot delete User A notification (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
  });

  test('8. API: PATCH /api/notifications/read-all marks all notifications as read', async () => {
    // Create another unread notification for User A
    await notificationService.createNotification({
      userId: userAId,
      title: 'Second Alert',
      message: 'Another unread notification',
      type: NotificationType.WARNING,
    });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.data.every((n: any) => n.read === true)).toBe(true);
  });

  test('9. API: DELETE /api/notifications/:id deletes notification', async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Notification deleted');
  });
});

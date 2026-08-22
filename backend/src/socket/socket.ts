import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { SOCKET_EVENTS } from './events';
import { env } from '../config/env';
import prisma from '../config/db';
import { verifyToken } from '../utils/jwt';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Not allowed by CORS: ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const authorization = socket.handshake.headers.authorization;
      const cookieHeader = socket.handshake.headers.cookie || '';
      const cookieToken = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith('token='))?.slice('token='.length);
      const token = socket.handshake.auth?.token || (authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined) || cookieToken;

      if (!token) return next(new Error('Not authorized'));

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true },
      });
      if (!user) return next(new Error('Not authorized'));

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Not authorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Emit connection success event
    socket.emit(SOCKET_EVENTS.CONNECTED, { message: 'Socket connected' });

    // Membership is derived from the authenticated handshake, never client payload.
    socket.on(SOCKET_EVENTS.JOIN, async () => {
      try {
        const user = socket.data.user as { id: string; role: string } | undefined;
        if (!user) return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not authorized.' });
        const { id: userId, role } = user;

        // 1. Join user-specific room
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`[Socket.IO] Socket ${socket.id} joined room: ${userRoom}`);

        // 2. Join role-based rooms
        if (role === 'ADMIN') {
          socket.join('admin');
          console.log(`[Socket.IO] Socket ${socket.id} joined room: admin`);
        }

        if (role === 'OFFICER') {
          const officer = await prisma.officer.findUnique({ where: { userId }, select: { id: true, departmentId: true } });
          if (officer) {
          const officerRoom = `officer:${officer.id}`;
          socket.join(officerRoom);
          console.log(
            `[Socket.IO] Socket ${socket.id} joined room: ${officerRoom}`
          );
          const deptRoom = `department:${officer.departmentId}`;
          socket.join(deptRoom);
          console.log(
            `[Socket.IO] Socket ${socket.id} joined room: ${deptRoom}`
          );
          }
        }

        socket.emit(SOCKET_EVENTS.JOINED, {
          message: 'Rooms joined successfully',
          userId,
          role,
        });
      } catch (err: any) {
        console.error('[Socket.IO] Join event failed:', err.message);
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Failed to process join action',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO is not initialized! Call initSocket first.');
  }
  return io;
};

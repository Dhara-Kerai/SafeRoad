import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { SOCKET_EVENTS } from './events';
import { env } from '../config/env';

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

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Emit connection success event
    socket.emit(SOCKET_EVENTS.CONNECTED, { message: 'Socket connected' });

    // Client joins rooms based on identity
    socket.on(SOCKET_EVENTS.JOIN, (payload: any) => {
      try {
        if (!payload || !payload.userId || !payload.role) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Invalid join payload. userId and role are required.',
          });
          return;
        }

        const { userId, role, officerId, departmentId } = payload;

        // 1. Join user-specific room
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`[Socket.IO] Socket ${socket.id} joined room: ${userRoom}`);

        // 2. Join role-based rooms
        if (role === 'ADMIN') {
          socket.join('admin');
          console.log(`[Socket.IO] Socket ${socket.id} joined room: admin`);
        }

        if (role === 'OFFICER' && officerId) {
          const officerRoom = `officer:${officerId}`;
          socket.join(officerRoom);
          console.log(
            `[Socket.IO] Socket ${socket.id} joined room: ${officerRoom}`
          );
        }

        if (departmentId) {
          const deptRoom = `department:${departmentId}`;
          socket.join(deptRoom);
          console.log(
            `[Socket.IO] Socket ${socket.id} joined room: ${deptRoom}`
          );
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

import { getIO } from '../socket/socket';
import { SOCKET_EVENTS } from '../socket/events';

// Safely execute Socket.IO calls to prevent crashes in non-websocket runner scopes (like scripts)
const safeEmit = (action: (io: any) => void) => {
  try {
    const io = getIO();
    action(io);
  } catch (error: any) {
    console.warn(
      `[Socket.IO Service Warning] Could not emit socket event: ${error.message}`
    );
  }
};

export const emitReportCreated = (report: any): void => {
  safeEmit((io) => {
    // Admins retain full real-time report payload per global visibility scope
    io.to('admin').emit(SOCKET_EVENTS.REPORT_CREATED, { report });

    // Department rooms receive ONLY a sanitized refresh signal to prevent data leakage
    // Officers must retrieve report details via the authorized REST endpoint
    if (report.departmentId) {
      io.to(`department:${report.departmentId}`).emit(
        SOCKET_EVENTS.REPORT_CREATED,
        {
          type: 'REPORT_CREATED',
          reportId: report.id,
        }
      );
    }
  });
};

export const emitReportUpdated = (report: any): void => {
  safeEmit((io) => {
    io.to('admin').emit(SOCKET_EVENTS.REPORT_UPDATED, { report });
    io.to(`user:${report.userId}`).emit(SOCKET_EVENTS.REPORT_UPDATED, { report });
    if (report.officerId) {
      io.to(`officer:${report.officerId}`).emit(SOCKET_EVENTS.REPORT_UPDATED, {
        report,
      });
    }
  });
};

export const emitReportAssigned = (
  reportId: string,
  officerId: string
): void => {
  safeEmit((io) => {
    io.to(`officer:${officerId}`).emit(SOCKET_EVENTS.REPORT_ASSIGNED, {
      reportId,
      officerId,
    });
  });
};

export const emitStatusChanged = (
  reportId: string,
  oldStatus: string,
  newStatus: string,
  ownerId: string,
  officerId?: string
): void => {
  safeEmit((io) => {
    const payload = { reportId, oldStatus, newStatus };
    io.to(`user:${ownerId}`).emit(SOCKET_EVENTS.REPORT_STATUS_CHANGED, payload);
    io.to('admin').emit(SOCKET_EVENTS.REPORT_STATUS_CHANGED, payload);
    if (officerId) {
      io.to(`officer:${officerId}`).emit(
        SOCKET_EVENTS.REPORT_STATUS_CHANGED,
        payload
      );
    }
  });
};

export const emitNotification = (
  targetRooms: string[],
  notification: {
    title: string;
    message: string;
    type?: string;
    reportId?: string;
  }
): void => {
  safeEmit((io) => {
    targetRooms.forEach((room) => {
      io.to(room).emit(SOCKET_EVENTS.NOTIFICATION, notification);
    });
  });
};

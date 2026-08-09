import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    let backendOrigin = 'http://localhost:5000';
    try {
      backendOrigin = new URL(apiUrl).origin;
    } catch {
      backendOrigin = window.location.origin;
    }

    socketInstance = io(backendOrigin, {
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true,
    });
  }

  if (!socketInstance.connected && !socketInstance.active) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const joinUserRoom = (user: { id: string; role: string }) => {
  const socket = getSocket();
  const roleLower = (user.role || '').toLowerCase();
  let backendRole = 'USER';
  if (roleLower === 'admin') backendRole = 'ADMIN';
  else if (roleLower === 'officer' || roleLower === 'municipal_officer') backendRole = 'OFFICER';

  const payload = {
    userId: user.id,
    role: backendRole,
  };

  const doJoin = () => {
    socket.emit('join', payload);
  };

  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
  }
};

import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    let backendOrigin = 'http://localhost:8000';
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

export const joinUserRoom = (_user: { id: string; role: string }) => {
  const socket = getSocket();

  const doJoin = () => {
    socket.emit('join');
  };

  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
  }
};

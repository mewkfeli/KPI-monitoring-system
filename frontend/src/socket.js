// frontend/src/socket.js
import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (userId) => {
  if (!socket && userId) {
    socket = io('http://localhost:5000', {
      auth: { employeeId: userId },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
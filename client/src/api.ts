import { io, Socket } from 'socket.io-client';

const BASE_URL = '';
const TOKEN_KEY = 'hivemind_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Reconnect socket with new token
  if (socket.connected) {
    socket.disconnect();
  }
  socket.auth = { token };
  socket.connect();
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  socket.disconnect();
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

export const socket: Socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  auth: { token: getAuthToken() },
  autoConnect: !!getAuthToken(),
});

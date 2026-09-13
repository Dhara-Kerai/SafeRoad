const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

let refreshInFlight: Promise<boolean> | null = null;

export const refreshAccessToken = async (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/verify-otp', '/reset-password'];

export const redirectToLogin = () => {
  if (typeof window !== 'undefined' && !PUBLIC_PATHS.includes(window.location.pathname)) {
    window.location.assign('/login');
  }
};

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  retryAfterRefresh = false
): Promise<T> => {
  const makeRequest = () => fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let response = await makeRequest();
  if (response.status === 401 && retryAfterRefresh) {
    if (await refreshAccessToken()) {
      response = await makeRequest();
    } else {
      redirectToLogin();
    }
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.detail ?? payload?.message ?? 'Request failed');
  }

  return payload as T;
};

export const authenticatedRequestJson = <T>(path: string, init?: RequestInit) =>
  requestJson<T>(path, init, true);

import type {
  LoginRequest,
  OTPRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from '../types/auth';

export interface BackendAuthResponse {
  status: string;
  data: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export const login = async (request: LoginRequest): Promise<BackendAuthResponse> => {
  const response = await requestJson<BackendAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: request.email,
      password: request.password,
    }),
  });

  return response;
};

export const register = async (request: RegisterRequest): Promise<BackendAuthResponse> => {
  const response = await requestJson<BackendAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: request.fullName,
      name: request.fullName,
      email: request.email,
      password: request.password,
    }),
  });

  return response;
};

export const getProfile = async () => {
  return await requestJson<{
    status: string;
    data: {
      user: {
        id: string;
        fullName: string;
        email: string;
        role: string;
        createdAt: string;
        updatedAt: string;
      };
    };
  }>('/auth/me', undefined, false);
};

export const updateProfile = async (fullName: string) => {
  return requestJson<{
    status: string;
    data: { user: BackendAuthResponse['data']['user'] };
  }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ fullName }),
  });
};

export const changePassword = async (input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  return requestJson<{ status: string; message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

export const logout = async (): Promise<void> => {
  await requestJson('/auth/logout', { method: 'POST' });
};

export const forgotPassword = async (email: string) => {
  return requestJson<{ status: string; message: string; data?: { otp: string } }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const verifyOTP = async (request: OTPRequest) => {
  return requestJson<{ status: string; data: { token: string } }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(request),
  });
};

export const resetPassword = async (request: ResetPasswordRequest) => {
  return requestJson<{ status: string; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(request),
  });
};

// Authentication state provider with backend integration and session restoration.
import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';

import type { AuthUser, UserRole } from '../types/auth';
import { getProfile, logout as logoutRequest } from '../services/authService';

interface AuthContextValue {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (user: AuthUser) => void;
  updateCurrentUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mapRole = (backendRole: string): UserRole => {
  const roleLower = (backendRole || '').toLowerCase();
  if (roleLower === 'admin') return 'admin';
  if (roleLower === 'officer' || roleLower === 'municipal_officer') return 'municipal_officer';
  return 'citizen';
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    void logoutRequest().catch(() => undefined);
    setCurrentUser(null);
    setIsLoading(false);
  };

  const signIn = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoading(false);
  };

  const updateCurrentUser = (user: Partial<AuthUser>) => {
    setCurrentUser((previousUser) => previousUser ? { ...previousUser, ...user } : previousUser);
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await getProfile();
        const user = response.data.user;
        const mappedUser = {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: mapRole(user.role),
        };
        setCurrentUser(mappedUser);
      } catch (error) {
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    isAuthenticated: currentUser !== null,
    isLoading,
    signIn,
    updateCurrentUser,
    logout,
  }), [currentUser, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

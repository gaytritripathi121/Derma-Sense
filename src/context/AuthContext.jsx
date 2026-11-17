import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children, onLogoutClear }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [databaseConfigured, setDatabaseConfigured] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await authService.getStatus();
      setDatabaseConfigured(Boolean(data?.databaseConfigured));
      setDatabaseConnected(Boolean(data?.databaseConnected));
      setUser(data?.authenticated && data?.user ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const login = async ({ email, password, rememberMe }) => {
    const data = await authService.login({ email, password, rememberMe });
    setUser(data.user);
    return data.user;
  };

  const register = async ({ name, email, password, confirmPassword, rememberMe }) => {
    const data = await authService.register({
      name,
      email,
      password,
      confirmPassword,
      rememberMe,
    });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      if (onLogoutClear) onLogoutClear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        databaseConfigured,
        databaseConnected,
        refreshStatus,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

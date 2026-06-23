/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const loginWithToken = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {
      // Wylogowanie lokalne ma pierwszeństwo nawet przy błędzie API.
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = user?.rola === 'admin';
  const isWorker = ['admin', 'pracownik'].includes(user?.rola);
  const kierownikZespolIds = user?.kierownik_zespol_ids || [];
  const isKierownik = kierownikZespolIds.length > 0;

  return (
    <AuthContext.Provider value={{ user, login, loginWithToken, logout, isAdmin, isWorker, isKierownik, kierownikZespolIds }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

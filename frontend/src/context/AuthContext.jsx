/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_USER_KEY = 'adminUser';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [impersonator, setImpersonator] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ADMIN_USER_KEY)); } catch { return null; }
  });

  const login = async (email, password, remember = false) => {
    const { data } = await api.post('/auth/login', { email, password, remember });
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setImpersonator(null);
    setUser(data.user);
    return data.user;
  };

  const loginWithToken = (token, userData) => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setImpersonator(null);
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {
      // Wylogowanie lokalne ma pierwszeństwo nawet przy błędzie API.
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setImpersonator(null);
    setUser(null);
  };

  // Admin "loguje się jako" wskazany użytkownik — bieżąca (admińska) sesja jest
  // odkładana w adminToken/adminUser, żeby stopImpersonating mógł do niej wrócić
  // bez ponownego logowania. Drugi impersonate() z rzędu nie nadpisuje już
  // odłożonej sesji (backend i tak by go zablokował — patrz requireAdmin na
  // /:id/impersonate, który widzi rolę impersonowanego usera).
  const impersonateUser = async (userId) => {
    const { data } = await api.post(`/users/${userId}/impersonate`);
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      localStorage.setItem(ADMIN_TOKEN_KEY, localStorage.getItem('token'));
      localStorage.setItem(ADMIN_USER_KEY, localStorage.getItem('user'));
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    try { setImpersonator(JSON.parse(localStorage.getItem(ADMIN_USER_KEY))); } catch { /* noop */ }
    return data.user;
  };

  const stopImpersonating = () => {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const adminUser = localStorage.getItem(ADMIN_USER_KEY);
    if (!adminToken || !adminUser) return;
    localStorage.setItem('token', adminToken);
    localStorage.setItem('user', adminUser);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setImpersonator(null);
    try { setUser(JSON.parse(adminUser)); } catch { setUser(null); }
  };

  // Scala częściową aktualizację (np. nowe avatar_path po wgraniu zdjęcia) do user w
  // stanie i localStorage, bez konieczności ponownego logowania ani GET /auth/me.
  const updateUser = (partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const isAdmin = user?.rola === 'admin';
  const isWorker = ['admin', 'pracownik'].includes(user?.rola);
  const kierownikZespolIds = user?.kierownik_zespol_ids || [];
  const isKierownik = kierownikZespolIds.length > 0;
  const isImpersonating = !!impersonator;

  return (
    <AuthContext.Provider value={{
      user, login, loginWithToken, logout, isAdmin, isWorker, isKierownik, kierownikZespolIds,
      impersonateUser, stopImpersonating, isImpersonating, impersonator, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

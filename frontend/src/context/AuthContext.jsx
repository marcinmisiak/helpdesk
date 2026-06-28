/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../api/client';

const AuthContext = createContext(null);

const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_USER_KEY = 'adminUser';
const MAX_TIMEOUT_MS = 2 ** 31 - 1; // maks. bezpieczny delay dla setTimeout (~24.8 dnia)

// Odczytuje `exp` (sekundy epoch) z payloadu JWT bez weryfikacji podpisu —
// wystarcza do lokalnego wykrycia momentu wygaśnięcia, podpis i tak waliduje backend.
function getTokenExpiryMs(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const { exp } = JSON.parse(atob(padded));
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const { t } = useTranslation();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [impersonator, setImpersonator] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ADMIN_USER_KEY)); } catch { return null; }
  });
  const expiryTimerRef = useRef(null);

  // Bez tego sesja wygasająca w tle (token przestaje być ważny, a użytkownik nic
  // nie klika) byłaby niewidoczna do następnego zapytania do API — menu/Layout
  // wyglądałyby jak zalogowane aż do pierwszego 401. Timer ustawiony na dokładny
  // moment wygaśnięcia tokenu wylogowuje od razu, niezależnie od aktywności.
  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const forceLogout = useCallback((reason) => {
    clearExpiryTimer();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setImpersonator(null);
    setUser(null);
    if (reason === 'expired') toast.error(t('login.session_expired'));
  }, [clearExpiryTimer, t]);

  // setTimeout przyjmuje delay jako 32-bitową liczbę całkowitą — dla tokenów
  // "zapamiętaj mnie" (do 30 dni) trzeba dzielić odliczanie na kawałki, inaczej
  // delay > ~24.8 dni przepełnia się i timer odpala się natychmiast.
  const scheduleExpiry = useCallback((token) => {
    clearExpiryTimer();
    const expiryMs = token ? getTokenExpiryMs(token) : null;
    if (!expiryMs) return;

    const tick = () => {
      // setTimeout (nawet z 0ms, gdy token jest już przeterminowany) zamiast
      // wywołania forceLogout tutaj bezpośrednio — unika synchronicznego
      // setState w ciele efektu przy wywołaniu z useEffect poniżej.
      const msLeft = Math.max(expiryMs - Date.now(), 0);
      if (msLeft > MAX_TIMEOUT_MS) {
        expiryTimerRef.current = setTimeout(tick, MAX_TIMEOUT_MS);
      } else {
        expiryTimerRef.current = setTimeout(() => forceLogout('expired'), msLeft);
      }
    };
    tick();
  }, [clearExpiryTimer, forceLogout]);

  useEffect(() => {
    scheduleExpiry(localStorage.getItem('token'));
    return clearExpiryTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password, remember = false) => {
    const { data } = await api.post('/auth/login', { email, password, remember });
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setImpersonator(null);
    setUser(data.user);
    scheduleExpiry(data.token);
    return data.user;
  };

  const loginWithToken = (token, userData) => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setImpersonator(null);
    setUser(userData);
    scheduleExpiry(token);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {
      // Wylogowanie lokalne ma pierwszeństwo nawet przy błędzie API.
    }
    clearExpiryTimer();
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
    scheduleExpiry(data.token);
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
    scheduleExpiry(adminToken);
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

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n/index.js';
import api from '../api/client';
import axios from 'axios';
import usePushNotifications from '../hooks/usePushNotifications';
import useTheme from '../hooks/useTheme';
import useNewTicketAlert, { isSoundMuted, toggleSoundMute } from '../hooks/useNewTicketAlert';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

const BADGE_COLORS = {
  red:    'bg-red-500 text-white',
  yellow: 'bg-yellow-400 text-yellow-900',
  blue:   'bg-blue-500 text-white',
  gray:   'bg-gray-400 text-white',
};

function NavBadge({ count, color = 'red' }) {
  if (!count) return null;
  return (
    <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight font-semibold ${BADGE_COLORS[color] || BADGE_COLORS.red}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function UserAvatar({ imie, nazwisko }) {
  const initials = [imie, nazwisko]
    .filter(Boolean)
    .map(s => s[0].toUpperCase())
    .join('');
  return (
    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
      {initials || '?'}
    </div>
  );
}

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [muted, setMuted] = useState(isSoundMuted);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebarOpen') !== 'false'; } catch { return true; }
  });

  const toggleSidebar = () => setSidebarOpen(v => {
    const next = !v;
    try { localStorage.setItem('sidebarOpen', String(next)); } catch {}
    return next;
  });

  const closeSidebarMobile = () => {
    if (window.innerWidth < 1024) setSidebarOpen(v => {
      try { localStorage.setItem('sidebarOpen', 'false'); } catch {}
      return false;
    });
  };

  const { isSupported, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    const handleLeave = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      fetch(`${apiUrl}/alerts/leave`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Authorization': `Bearer ${token}` },
      });
    };
    window.addEventListener('pagehide', handleLeave);
    return () => window.removeEventListener('pagehide', handleLeave);
  }, []);

  const { data: counts } = useQuery({
    queryKey: ['counts'],
    queryFn: () => api.get('/alerts/count').then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => axios.get(`${API_BASE}/api/ustawienia/app-name`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const showNotif = (icon, title, href) => {
    toast.custom(
      (toastState) => (
        <div
          style={{
            opacity: toastState.visible ? 1 : 0,
            transform: toastState.visible ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
          className="max-w-sm w-full bg-white dark:bg-gray-800 shadow-2xl rounded-xl pointer-events-auto border-l-4 border-l-blue-500 border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{title}</p>
              {href && (
                <a
                  href={href}
                  onClick={() => toast.dismiss(toastState.id)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5 font-medium"
                >
                  {t('toast.go_to')}
                </a>
              )}
            </div>
            <button
              onClick={() => toast.dismiss(toastState.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      ),
      { duration: 8000, position: 'bottom-right' }
    );
  };

  useNewTicketAlert(counts, {
    isAdmin,
    onNewTicket: () => showNotif('🎫', t('toast.new_ticket'), '/tickets'),
    onNewReply: (id) => showNotif('💬', t('toast.new_reply'), id ? `/tickets/${id}` : '/moje'),
    onAssigned: (id) => showNotif('📋', t('toast.assigned'), id ? `/tickets/${id}` : '/moje'),
    onUserOnline: (u) => {
      if (u.id !== user?.id) {
        showNotif('🟢', `${u.imie} ${u.nazwisko} ${t('toast.user_online')}`, null);
      }
    },
    onUserOffline: (u) => {
      if (u.id !== user?.id) {
        showNotif('🔴', `${u.imie} ${u.nazwisko} ${t('toast.user_offline')}`, null);
      }
    },
  });

  const logoUrl = branding?.logo_path ? `${API_BASE}/pliki/${branding.logo_path}` : null;
  const appName = branding?.app_name || 'Helpdesk';

  const handlePushToggle = async () => {
    try {
      if (isSubscribed) { await unsubscribe(); toast.success(t('push.disabled')); }
      else { await subscribe(); toast.success(t('push.enabled')); }
    } catch (err) {
      toast.error(err.message === 'permission_denied' ? t('push.perm_denied') : t('push.config_error'));
    }
  };

  const handleSoundToggle = () => {
    const nowMuted = toggleSoundMute();
    setMuted(nowMuted);
    toast(nowMuted ? t('sound.muted') : t('sound.enabled'), { icon: nowMuted ? '🔇' : '🔊' });
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinks = [
    ...(isAdmin ? [{ to: '/tickets', label: t('nav.tickets'), icon: '🎫', badges: [
      { count: counts?.nowe, color: 'red' },
      { count: counts?.wtoku, color: 'yellow' },
    ]}] : []),
    { to: '/moje', label: t('nav.my_tickets'), icon: '📋', badge: counts?.moje },
    { to: '/odlozone', label: t('nav.deferred'), icon: '⏸️', badge: counts?.odlozone },
    { to: '/kalendarz', label: t('nav.calendar'), icon: '📅' },
    ...(isAdmin ? [
      { to: '/statystyki', label: t('nav.statistics'), icon: '📊' },
      { to: '/uzytkownicy', label: t('nav.users'), icon: '👥' },
      { to: '/ustawienia', label: t('nav.settings'), icon: '⚙️' },
      { to: '/spam', label: t('nav.spam'), icon: '🚫', badge: counts?.spam },
    ] : []),
    { to: '/pomoc', label: t('nav.help'), icon: '❓' },
  ];

  const phones = branding?.kontakt_telefony?.split('\n').map(s => s.trim()).filter(Boolean) || [];
  const emails = branding?.kontakt_emaile?.split('\n').map(s => s.trim()).filter(Boolean) || [];

  const SidebarContent = ({ onLinkClick }) => (
    <div className="flex flex-col h-full">
      {/* User info */}
      <div className="p-4 border-b border-blue-700">
        <div className="flex items-center gap-3">
          <UserAvatar imie={user?.imie} nazwisko={user?.nazwisko} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.imie} {user?.nazwisko}</p>
            <p className="text-xs text-blue-300 capitalize">{user?.rola === 'admin' ? t('nav.role_admin') : t('nav.role_worker')}</p>
          </div>
        </div>
        {/* Quick stats */}
        <div className="mt-3 grid grid-cols-3 gap-1 text-center">
          {isAdmin ? (
            <>
              <div className="bg-blue-700/50 rounded-lg py-1.5 px-1">
                <p className="text-lg font-bold text-red-400 leading-none">{counts?.nowe ?? '–'}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t('nav.new_count')}</p>
              </div>
              <div className="bg-blue-700/50 rounded-lg py-1.5 px-1">
                <p className="text-lg font-bold text-yellow-300 leading-none">{counts?.wtoku ?? '–'}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t('nav.inprogress_count')}</p>
              </div>
              <div className="bg-blue-700/50 rounded-lg py-1.5 px-1">
                <p className="text-lg font-bold text-white leading-none">{counts?.moje ?? '–'}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t('nav.my_count')}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-700/50 rounded-lg py-1.5 px-1">
                <p className="text-lg font-bold text-white leading-none">{counts?.moje ?? '–'}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t('nav.my_count')}</p>
              </div>
              <div className="bg-blue-700/50 rounded-lg py-1.5 px-1">
                <p className="text-lg font-bold text-white leading-none">{counts?.odlozone ?? '–'}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">{t('nav.deferred_count')}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navLinks.map(({ to, label, icon, badge, badges }) => (
          <Link
            key={to}
            to={to}
            onClick={onLinkClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(to)
                ? 'bg-white/20 text-white'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-base leading-none flex-shrink-0">{icon}</span>
            <span className="flex-1 truncate">{label}</span>
            {badges
              ? badges.map((b, i) => <NavBadge key={i} count={b.count} color={b.color} />)
              : badge ? <NavBadge count={badge} /> : null}
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-blue-700 space-y-1">
        {/* Language switcher */}
        <div className="flex items-center justify-center gap-1 mb-1">
          <button
            onClick={() => setLanguage('pl')}
            className={`text-xs px-2 py-1 rounded transition-colors ${i18n.language === 'pl' ? 'bg-white/20 text-white font-semibold' : 'text-blue-300 hover:text-white hover:bg-white/10'}`}
          >
            PL
          </button>
          <span className="text-blue-600 text-xs">|</span>
          <button
            onClick={() => setLanguage('en')}
            className={`text-xs px-2 py-1 rounded transition-colors ${i18n.language === 'en' ? 'bg-white/20 text-white font-semibold' : 'text-blue-300 hover:text-white hover:bg-white/10'}`}
          >
            EN
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            title={isDark ? t('theme.toggle_light') : t('theme.toggle_dark')}
          >
            {isDark ? '🌙' : '☀️'} {isDark ? t('theme.dark') : t('theme.light')}
          </button>
          <button
            onClick={handleSoundToggle}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            title={muted ? t('sound.label') : t('sound.label')}
          >
            {muted ? '🔇' : '🔊'} {t('sound.label')}
          </button>
          {isSupported && (
            <button
              onClick={handlePushToggle}
              disabled={pushLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-blue-200 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title={isSubscribed ? t('push.disable_title') : t('push.enable_title')}
            >
              {isSubscribed ? '🔔' : '🔕'} {t('push.label')}
            </button>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-red-500/20 hover:text-red-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Topbar ──────────────────────────────────────────────── */}
      <header className="bg-blue-800 text-white shadow-lg sticky top-0 z-40 h-14 flex items-center px-4 gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-white hover:text-blue-200 transition-colors flex-shrink-0"
        >
          {logoUrl
            ? <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[120px] object-contain" />
            : <span className="text-xl">🎫</span>}
          <span className="text-base hidden sm:block">{appName}</span>
        </Link>

        <div className="flex-1" />

        {isAdmin && (counts?.nowe > 0 || counts?.wtoku > 0) && (
          <Link to="/tickets" className="flex items-center gap-1 text-sm text-blue-200 hover:text-white transition-colors">
            🎫
            {counts?.nowe > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{counts.nowe > 99 ? '99+' : counts.nowe}</span>}
            {counts?.wtoku > 0 && <span className="bg-yellow-400 text-yellow-900 text-xs rounded-full px-1.5 py-0.5 font-semibold">{counts.wtoku > 99 ? '99+' : counts.wtoku}</span>}
          </Link>
        )}
      </header>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={closeSidebarMobile}
          />
        )}

        <aside
          className={`
            fixed top-14 left-0 bottom-0 z-40 w-60 bg-blue-800 border-r border-blue-700
            flex flex-col transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <SidebarContent onLinkClick={closeSidebarMobile} />
        </aside>

        <div
          className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ease-in-out ${sidebarOpen ? 'lg:ml-60' : ''}`}
        >
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>

          <footer className="bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-500">
                <div className="flex items-center gap-2">
                  {logoUrl && <img src={logoUrl} alt={appName} className="h-5 w-auto opacity-60" />}
                  <span>{appName} &copy; {new Date().getFullYear()} · v{__APP_VERSION__}</span>
                </div>
                {(phones.length > 0 || emails.length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-end">
                    {phones.map((p, i) => (
                      <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        📞 {p}
                      </a>
                    ))}
                    {emails.map((e, i) => (
                      <a key={i} href={`mailto:${e}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        ✉️ {e}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n/index.js';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');
const API_URL  = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function OAuthButton({ provider, label, icon, primary }) {
  return (
    <button
      type="button"
      onClick={() => { window.location.href = `${API_URL}/auth/${provider}`; }}
      className={
        primary
          ? 'w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-colors bg-blue-700 hover:bg-blue-800 text-white border border-blue-700'
          : 'w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 shadow-sm'
      }
    >
      {icon}
      {label}
    </button>
  );
}

const MicrosoftIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </svg>
);

const GoogleIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Login() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [branding, setBranding] = useState({ app_name: 'Helpdesk', logo_path: null, kontakt_telefony: '', kontakt_emaile: '', app_language: 'pl' });
  const [providers, setProviders] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const oauthError = new URLSearchParams(window.location.search).get('error');

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/api/ustawienia/app-name`).then(r => r.data).catch(() => ({})),
      axios.get(`${API_BASE}/api/auth/providers`).then(r => r.data).catch(() => ({ microsoft: false, google: false })),
    ]).then(([brandingData, providersData]) => {
      setBranding(prev => ({ ...prev, ...brandingData }));
      setProviders(providersData);
      if (brandingData.app_language && !localStorage.getItem('helpdesk_lang')) {
        setLanguage(brandingData.app_language);
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.language) setLanguage(user.language);
      navigate(user.rola === 'admin' ? '/tickets' : '/moje');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error_default'));
    } finally {
      setLoading(false);
    }
  };

  const oauthErrorMsg = oauthError ? ({
    oauth_denied: t('login.oauth_denied'),
    oauth_not_configured: t('login.oauth_not_configured'),
    oauth_error: t('login.oauth_error'),
  }[oauthError] || t('login.oauth_error')) : null;

  const logoUrl = branding.logo_path ? `${API_BASE}/pliki/${branding.logo_path}` : null;
  const phones = branding.kontakt_telefony?.split('\n').map(s => s.trim()).filter(Boolean) || [];
  const emails = branding.kontakt_emaile?.split('\n').map(s => s.trim()).filter(Boolean) || [];
  const hasContacts = phones.length > 0 || emails.length > 0;

  const hasOAuth = providers && (providers.microsoft || providers.google);
  const emailFormVisible = !hasOAuth || showEmailForm;

  return (
    <div className="min-h-screen flex bg-slate-100">

      {/* ── Lewa strona — branding ───────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-blue-800 p-12 text-white">
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt={branding.app_name} className="h-14 w-auto object-contain mb-8" />
          ) : (
            <div className="text-5xl mb-8">🎫</div>
          )}
          <h1 className="text-3xl font-bold mb-3">{branding.app_name}</h1>
          <p className="text-blue-200 text-base leading-relaxed max-w-sm">
            {t('login.tagline')}
          </p>
        </div>

        {hasContacts && (
          <div className="space-y-2">
            <p className="text-blue-300 text-xs uppercase font-semibold tracking-wide mb-3">{t('login.contact')}</p>
            {phones.map((p, i) => (
              <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="flex items-center gap-2 text-blue-100 hover:text-white text-sm transition-colors">
                <span className="text-base">📞</span> {p}
              </a>
            ))}
            {emails.map((e, i) => (
              <a key={i} href={`mailto:${e}`} className="flex items-center gap-2 text-blue-100 hover:text-white text-sm transition-colors">
                <span className="text-base">✉️</span> {e}
              </a>
            ))}
          </div>
        )}

        <p className="text-blue-300 text-xs">&copy; {new Date().getFullYear()} {branding.app_name}</p>
      </div>

      {/* ── Prawa strona — formularz logowania ─────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">

        {/* Logo mobile */}
        <div className="lg:hidden text-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt={branding.app_name} className="h-12 w-auto object-contain mx-auto mb-3" />
          ) : (
            <div className="text-4xl mb-3">🎫</div>
          )}
          <h1 className="text-xl font-bold text-slate-900">{branding.app_name}</h1>
        </div>

        <div className="w-full max-w-sm">
          {/* Przełącznik języka */}
          <div className="flex justify-end mb-4 gap-2">
            <button
              onClick={() => setLanguage('pl')}
              className={`text-xs px-2 py-1 rounded ${i18n.language === 'pl' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              PL
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`text-xs px-2 py-1 rounded ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EN
            </button>
          </div>

          <div className="mb-8 lg:mt-0">
            <h2 className="text-2xl font-bold text-slate-900">{t('login.title')}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {hasOAuth ? t('login.subtitle_oauth') : t('login.subtitle_plain')}
            </p>
          </div>

          {(error || oauthErrorMsg) && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error || oauthErrorMsg}
            </div>
          )}

          {/* ── Przyciski OAuth ── */}
          {providers && (
            <div className="space-y-2.5">
              {providers.microsoft && (
                <OAuthButton provider="microsoft" label={t('login.microsoft')} icon={MicrosoftIcon} primary />
              )}
              {providers.google && (
                <OAuthButton provider="google" label={t('login.google')} icon={GoogleIcon} />
              )}
            </div>
          )}

          {/* ── Inne metody ── */}
          {hasOAuth && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowEmailForm(v => !v)}
                className="w-full text-sm text-slate-500 hover:text-slate-700 py-2 flex items-center justify-center gap-1 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showEmailForm ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {showEmailForm ? t('login.hide_methods') : t('login.other_methods')}
              </button>
            </div>
          )}

          {emailFormVisible && (
            <form onSubmit={handleSubmit} className={`space-y-4 ${hasOAuth ? 'mt-2 pt-4 border-t border-slate-200' : ''}`}>
              <div>
                <label className="label">{t('login.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder={t('login.email_placeholder')}
                  required
                  autoFocus={!hasOAuth}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">{t('login.password')}</label>
                  <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                    {t('login.forgot_password')}
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                {loading ? t('login.submitting') : t('login.submit')}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">v{__APP_VERSION__}</p>

          {/* Kontakt mobile */}
          {hasContacts && (
            <div className="mt-8 pt-6 border-t border-slate-200 lg:hidden">
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-2">{t('login.contact')}</p>
              <div className="space-y-1">
                {phones.map((p, i) => (
                  <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="block text-sm text-slate-600 hover:text-blue-600">📞 {p}</a>
                ))}
                {emails.map((e, i) => (
                  <a key={i} href={`mailto:${e}`} className="block text-sm text-slate-600 hover:text-blue-600">✉️ {e}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

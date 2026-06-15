import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n/index.js';
import api from '../api/client';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err) {
      const msgs = {
        oauth_denied: t('oauth_callback.error_denied'),
        oauth_invalid_state: t('oauth_callback.error_invalid_state'),
        oauth_not_configured: t('oauth_callback.error_not_configured'),
        oauth_error: t('oauth_callback.error_generic'),
      };
      setError(msgs[err] || t('oauth_callback.error_unknown'));
      return;
    }

    if (!token) {
      setError(t('oauth_callback.error_no_token'));
      return;
    }

    api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        loginWithToken(token, data.user);
        if (data.user.language) setLanguage(data.user.language);
        navigate(data.user.rola === 'admin' ? '/tickets' : '/moje', { replace: true });
      })
      .catch(() => {
        setError(t('oauth_callback.error_verify'));
      });
  }, [searchParams, navigate, loginWithToken, t]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="card w-full max-w-sm text-center space-y-4">
          <div className="text-4xl">❌</div>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-2.5">
            {t('oauth_callback.back_to_login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="card w-full max-w-sm text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">{t('oauth_callback.signing_in')}</p>
      </div>
    </div>
  );
}

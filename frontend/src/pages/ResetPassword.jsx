import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="card w-full max-w-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-4">{t('reset_password.invalid_link')}</p>
          <Link to="/login" className="btn-primary justify-center py-2.5">
            {t('reset_password.back_to_login')}
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('reset_password.error_min_length'));
    if (password !== confirm) return setError(t('reset_password.error_mismatch'));
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || t('reset_password.error_default'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reset_password.title')}</h1>
          <p className="text-sm text-gray-500">{t('reset_password.subtitle')}</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
              {t('reset_password.success')}
            </div>
            <Link to="/login" className="btn-primary w-full justify-center py-2.5 block text-center">
              {t('reset_password.go_to_login')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="label">{t('reset_password.new_password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t('reset_password.placeholder_min')}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">{t('reset_password.confirm_password')}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? t('reset_password.submitting') : t('reset_password.submit')}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link to="/login" className="text-blue-600 hover:underline">
                {t('reset_password.back_to_login')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

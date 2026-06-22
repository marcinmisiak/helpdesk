import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
const API_BASE = BASE.replace('/api', '');
const pub = axios.create({ baseURL: BASE });

export default function CsatSurvey() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [branding, setBranding] = useState({ app_name: 'Helpdesk', logo_path: null });

  useEffect(() => {
    axios.get(`${API_BASE}/api/ustawienia/app-name`).then(r => setBranding(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    pub.get(`/public/ocena/${token}`)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || t('csat_survey.not_found')))
      .finally(() => setLoading(false));
  }, [token, t]);

  const submit = async () => {
    if (!rating) return setError(t('csat_survey.error_choose_rating'));
    setSubmitting(true);
    setError('');
    try {
      await pub.post(`/public/ocena/${token}`, { rating, comment });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || t('csat_survey.error_default'));
    } finally {
      setSubmitting(false);
    }
  };

  const logoUrl = branding.logo_path ? `${API_BASE}/pliki/${branding.logo_path}` : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            {logoUrl
              ? <img src={logoUrl} alt={branding.app_name} className="h-12 w-auto object-contain mx-auto mb-3" />
              : <div className="text-4xl mb-3">⭐</div>}
            <h1 className="text-xl font-bold text-gray-900">{branding.app_name}</h1>
          </div>

          {loading && (
            <div className="text-center py-16 text-gray-600">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p>{t('csat_survey.loading')}</p>
            </div>
          )}

          {error && !loading && !data && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {data && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {submitted || data.already_submitted ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">🙏</div>
                  <p className="text-gray-800 font-medium">{t('csat_survey.thank_you')}</p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">
                    {t('csat_survey.title', { numer: data.numer })}
                  </h2>
                  <p className="text-sm text-gray-600 text-center mb-5">{t('csat_survey.rating_label')}</p>

                  <div className="flex justify-center gap-2 mb-5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={`text-3xl transition-transform ${rating >= n ? 'scale-110' : 'opacity-40'}`}
                        aria-label={String(n)}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>

                  <label className="block text-sm text-gray-700 mb-1">{t('csat_survey.comment_label')}</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder={t('csat_survey.comment_placeholder')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
                  />

                  {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? t('csat_survey.submitting') : t('csat_survey.submit')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

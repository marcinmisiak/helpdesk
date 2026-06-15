import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n/index.js';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
const API_BASE = BASE.replace('/api', '');
const pub = axios.create({ baseURL: BASE });

const LANGS = [
  { code: 'pl', label: 'PL', title: 'Polski' },
  { code: 'en', label: 'EN', title: 'English' },
  { code: 'uk', label: 'UA', title: 'Українська' },
];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function LdapBadge({ result }) {
  if (!result) return null;

  const typeLabels = {
    student: { label: 'Student', color: 'bg-blue-100 text-blue-800' },
    teacher: { label: 'Wykładowca', color: 'bg-green-100 text-green-800' },
    staff: { label: 'Pracownik', color: 'bg-yellow-100 text-yellow-800' },
    pracownik: { label: 'Pracownik', color: 'bg-yellow-100 text-yellow-800' },
    wykladowca: { label: 'Wykładowca', color: 'bg-green-100 text-green-800' },
  };

  const typeKey = result.type?.toLowerCase();
  const typeInfo = typeLabels[typeKey] || { label: result.type, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="flex items-center gap-2 mt-1.5 p-2 bg-green-50 border border-green-200 rounded text-sm">
      <span className="text-green-600">✓</span>
      <span className="text-green-700 font-medium">{result.name}</span>
      {result.type && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
      )}
      {result.department && (
        <span className="text-gray-500 text-xs">{result.department}</span>
      )}
    </div>
  );
}

export default function PublicForm() {
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState({ enabled: true, tytul: '', app_name: 'Helpdesk', logo_path: null, kontakt_telefony: '', kontakt_emaile: '', app_language: 'pl' });
  const [kategorie, setKategorie] = useState([]);
  const [captcha, setCaptcha] = useState(null);
  const [form, setForm] = useState({ email: '', kategoria_id: '', opis: '', captchaAnswer: '', website: '' });
  const [files, setFiles] = useState([]);
  const [ldapResult, setLdapResult] = useState(null);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const honeypotRef = useRef();
  const fileInputRef = useRef();

  const ALLOWED_EXT = ['.jpg','.jpeg','.png','.gif','.webp','.pdf','.doc','.docx','.xls','.xlsx','.odt','.ods','.txt','.zip'];
  const MAX_SIZE = 10 * 1024 * 1024;

  const handleFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    const errors = [];
    const valid = arr.filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) { errors.push(`${f.name}: niedozwolony typ pliku`); return false; }
      if (f.size > MAX_SIZE) { errors.push(`${f.name}: plik za duży (max 10 MB)`); return false; }
      return true;
    });
    if (errors.length) setError(errors.join(', '));
    setFiles(prev => [...prev, ...valid].slice(0, 5));
  };

  const debouncedEmail = useDebounce(form.email, 600);

  useEffect(() => {
    pub.get('/public/info').then(r => {
      setInfo(r.data);
      if (r.data.app_language && !localStorage.getItem('helpdesk_lang')) {
        setLanguage(r.data.app_language);
      }
    }).catch(() => {});
    pub.get('/public/kategorie').then(r => setKategorie(r.data.data || [])).catch(() => {});
    refreshCaptcha();
  }, []);

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail)) {
      setLdapResult(null);
      return;
    }
    setLdapLoading(true);
    pub.get('/public/ldap-lookup', { params: { email: debouncedEmail } })
      .then(r => setLdapResult(r.data.found ? r.data : null))
      .catch(() => setLdapResult(null))
      .finally(() => setLdapLoading(false));
  }, [debouncedEmail]);

  const refreshCaptcha = useCallback(() => {
    pub.get('/public/captcha').then(r => {
      setCaptcha(r.data);
      setForm(f => ({ ...f, captchaAnswer: '' }));
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captcha) return setError(t('public_form.error_default'));
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('email', form.email);
      fd.append('opis', form.opis);
      fd.append('captchaId', captcha.id);
      fd.append('captchaAnswer', form.captchaAnswer);
      fd.append('website', form.website);
      if (form.kategoria_id) fd.append('kategoria_id', form.kategoria_id);
      if (ldapResult?.name) fd.append('ldap_name', ldapResult.name);
      for (const file of files) fd.append('attachments', file);
      const { data } = await pub.post('/public/zgloszenie', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(data.numer);
    } catch (err) {
      setError(err.response?.data?.error || t('public_form.error_default'));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const phones = (info.kontakt_telefony || '').split('\n').map(s => s.trim()).filter(Boolean);
  const emails = (info.kontakt_emaile || '').split('\n').map(s => s.trim()).filter(Boolean);

  // ── Selektor języka ──────────────────────────────────────────────────────────
  const LangSwitcher = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {LANGS.map(({ code, label, title }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          title={title}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            i18n.language === code || (i18n.language?.startsWith(code))
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (!info.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <LangSwitcher />
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-700">{t('public_form.not_available')}</h1>
          <p className="text-gray-500 mt-2">{t('public_form.not_available_desc')}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
          <LangSwitcher />
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('public_form.success_title')}</h2>
          <p className="text-gray-600 mb-4">{t('public_form.success_desc')}</p>
          <div className="inline-block bg-blue-50 border border-blue-200 text-blue-800 font-mono text-xl font-bold px-6 py-3 rounded-xl mb-6">
            #{success}
          </div>
          <p className="text-sm text-gray-500 mb-6">{t('public_form.success_email')}</p>
          <button
            onClick={() => {
              setSuccess(null);
              setForm({ email: '', kategoria_id: '', opis: '', captchaAnswer: '', website: '' });
              setFiles([]);
              setLdapResult(null);
              refreshCaptcha();
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            {t('public_form.new_report')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          {info.logo_path ? (
            <img src={`${API_BASE}/pliki/${info.logo_path}`} alt={info.app_name} className="h-14 w-auto object-contain mx-auto mb-4" />
          ) : (
            <div className="text-4xl mb-3">🎫</div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{info.tytul || t('public_form.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{info.app_name}</p>
        </div>

        <LangSwitcher />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('public_form.email_label')}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('login.email_placeholder')}
                required
                autoFocus
              />
              {ldapLoading && (
                <p className="text-xs text-gray-400 mt-1">{t('common.loading')}</p>
              )}
              <LdapBadge result={ldapResult} />
            </div>

            {kategorie.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('public_form.category_label')}
                </label>
                <select
                  value={form.kategoria_id}
                  onChange={set('kategoria_id')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">{t('public_form.category_placeholder')}</option>
                  {kategorie.map(k => (
                    <option key={k.id} value={k.id}>{k.nazwa}</option>
                  ))}
                </select>
                {form.kategoria_id && kategorie.find(k => k.id == form.kategoria_id)?.opis && (
                  <p className="text-xs text-gray-500 mt-1">
                    {kategorie.find(k => k.id == form.kategoria_id).opis}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('public_form.message_label')}
              </label>
              <textarea
                value={form.opis}
                onChange={set('opis')}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder={t('public_form.message_label')}
                required
                minLength={10}
              />
              <p className="text-xs text-gray-400 mt-1">{t('public_form.chars_count', { count: form.opis.length })}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('public_form.attachment_label')} <span className="text-gray-400 font-normal">({t('public_form.attachment_hint')})</span>
              </label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <p className="text-sm text-gray-500">{t('public_form.drop_files')}</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.zip"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                      <span className="truncate text-gray-700">📎 {f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} KB)</span></span>
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                      >×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('public_form.captcha_label')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 font-mono text-lg font-bold text-gray-800 select-none">
                  {captcha ? `${captcha.question} = ?` : '...'}
                </div>
                <input
                  type="number"
                  value={form.captchaAnswer}
                  onChange={set('captchaAnswer')}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="?"
                  required
                />
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-xs text-blue-600 hover:underline flex-shrink-0"
                >
                  ↻ {t('common.refresh')}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('public_form.captcha_hint')}</p>
            </div>

            <input
              ref={honeypotRef}
              type="text"
              name="website"
              value={form.website}
              onChange={set('website')}
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0 }}
            />

            <button
              type="submit"
              disabled={loading || !captcha}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t('public_form.submitting')}
                </>
              ) : t('public_form.submit')}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
          <p>{t('public_form.footer_note')}</p>
          {(phones.length > 0 || emails.length > 0) && (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
              {phones.map((p, i) => (
                <a key={i} href={`tel:${p.replace(/\s/g, '')}`} className="hover:text-gray-600">📞 {p}</a>
              ))}
              {emails.map((e, i) => (
                <a key={i} href={`mailto:${e}`} className="hover:text-gray-600">✉️ {e}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

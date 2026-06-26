import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

function UserModal({ user, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    email: user?.email || '',
    imie: user?.imie || '',
    nazwisko: user?.nazwisko || '',
    rola: user?.rola || 'pracownik',
    password: '',
    status: user?.status ?? 10,
    language: user?.language || '',
  });
  const [avatarPath, setAvatarPath] = useState(user?.avatar_path || null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isEdit = !!user;

  const handleAvatarUpload = async (file) => {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post(`/users/${user.id}/avatar`, formData);
      setAvatarPath(data.avatar_path);
      onSuccess();
      toast.success(t('users.avatar_updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('users.avatar_error'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const save = async () => {
    try {
      if (isEdit) {
        await api.put(`/users/${user.id}`, form);
        toast.success(t('users.saved'));
      } else {
        if (!form.password) return toast.error(t('users.error_no_password'));
        await api.post('/users', form);
        toast.success(t('users.created'));
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('users.error_save'));
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md dark:bg-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold dark:text-gray-100">{isEdit ? t('users.modal_edit_title') : t('users.modal_new_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="relative group cursor-pointer flex-shrink-0" title={t('users.change_photo')}>
                <Avatar imie={form.imie} nazwisko={form.nazwisko} avatarPath={avatarPath} className="w-16 h-16 text-lg" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = '';
                  }}
                />
                <span className="absolute inset-0 rounded-full flex items-center justify-center text-white text-[11px] text-center bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all">
                  {avatarUploading ? '…' : t('users.change_photo')}
                </span>
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('users.avatar_hint')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('users.field_first_name')}</label>
              <input value={form.imie} onChange={set('imie')} className="input" />
            </div>
            <div>
              <label className="label">{t('users.field_last_name')}</label>
              <input value={form.nazwisko} onChange={set('nazwisko')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">{t('users.field_email')}</label>
            <input type="email" value={form.email} onChange={set('email')} className="input" />
          </div>
          <div>
            <label className="label">{isEdit ? t('users.field_password_edit') : t('users.field_password_new')}</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              className="input"
              placeholder={isEdit ? t('users.field_password_placeholder_opt') : t('users.field_password_placeholder_req')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('users.field_role')}</label>
              <select value={form.rola} onChange={set('rola')} className="input">
                <option value="pracownik">{t('users.role_worker')}</option>
                <option value="admin">{t('users.role_admin')}</option>
                <option value="user">{t('users.role_user')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('users.field_status')}</label>
              <select value={form.status} onChange={set('status')} className="input">
                <option value={10}>{t('users.status_active')}</option>
                <option value={9}>{t('users.status_inactive')}</option>
                <option value={0}>{t('users.status_deleted')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('users.field_language')}</label>
            <select value={form.language} onChange={set('language')} className="input">
              <option value="">— {t('common.language_pl')} / {t('common.language_en')} (default) —</option>
              <option value="pl">{t('common.language_pl')}</option>
              <option value="en">{t('common.language_en')}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">{t('users.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('users.save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function Uzytkownicy() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser, impersonateUser } = useAuth();

  const ROLE_LABELS = {
    admin: t('users.role_admin'),
    pracownik: t('users.role_worker'),
    user: t('users.role_user'),
  };
  const ROLE_COLORS = { admin: 'badge-red', pracownik: 'badge-blue', user: 'badge-gray' };

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const users = data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      `${u.imie} ${u.nazwisko} ${u.email}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleImpersonate = async (u) => {
    try {
      await impersonateUser(u.id);
      navigate(u.rola === 'admin' ? '/tickets' : '/moje');
    } catch (err) {
      toast.error(err.response?.data?.error || t('users.impersonate_error'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('users.title')}</h2>
        <button onClick={() => setModal('new')} className="btn-primary">{t('users.add_user')}</button>
      </div>
      <div className="mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('users.search_placeholder')}
          className="input max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">{t('users.loading')}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('users.col_name')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('users.col_email')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('users.col_role')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('users.col_status')}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">{t('users.col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-2">
                      <Avatar imie={u.imie} nazwisko={u.nazwisko} avatarPath={u.avatar_path} className="w-7 h-7 text-xs" />
                      {u.is_online ? (
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title={t('users.online')} />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" title={t('users.offline')} />
                      )}
                      {u.imie} {u.nazwisko}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className={ROLE_COLORS[u.rola] || 'badge-gray'}>
                      {ROLE_LABELS[u.rola] || u.rola}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={u.status === 10 ? 'badge-green' : 'badge-gray'}>
                      {u.status === 10 ? t('users.status_active') : t('users.status_inactive')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal(u)} className="btn-secondary btn-sm">{t('users.edit')}</button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleImpersonate(u)} className="btn-secondary btn-sm">
                          {t('users.impersonate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries(['users'])}
        />
      )}
    </div>
  );
}

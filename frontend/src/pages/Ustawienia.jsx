import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

// ─── Panel logo ───────────────────────────────────────────────────────────────
function LogoPanel({ logoCurrent, onUploaded }) {
  const fileRef = useRef();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    setUploading(true);
    try {
      await api.post('/ustawienia/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo wgrane');
      qc.invalidateQueries(['ustawienia']);
      qc.invalidateQueries(['branding']);
      onUploaded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Błąd wgrywania logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = async () => {
    if (!confirm('Usunąć logo?')) return;
    try {
      await api.delete('/ustawienia/logo');
      toast.success('Logo usunięte');
      qc.invalidateQueries(['ustawienia']);
      qc.invalidateQueries(['branding']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Błąd usuwania');
    }
  };

  const logoUrl = logoCurrent ? `${API_BASE}/pliki/${logoCurrent}` : null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3">Logo systemu</h3>
      <p className="text-xs text-slate-500 mb-4">Logo jest wyświetlane w nawigacji, stopce i na stronie logowania. Dozwolone formaty: JPG, PNG, SVG, WebP (max 5 MB).</p>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-32 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="text-slate-400 text-xs text-center px-2">Brak logo</span>
          )}
        </div>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp" onChange={upload} className="hidden" />
          <button onClick={() => fileRef.current.click()} disabled={uploading} className="btn-primary btn-sm">
            {uploading ? 'Wgrywanie...' : logoUrl ? 'Zmień logo' : '+ Wgraj logo'}
          </button>
          {logoUrl && (
            <button onClick={remove} className="btn-danger btn-sm ml-2">Usuń</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Panel dokumentów AI ──────────────────────────────────────────────────────
function DocsPanel() {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [generating, setGenerating] = useState(false);
  const [genLimit, setGenLimit] = useState(60);
  const [genResult, setGenResult] = useState(null); // { count, size, filename } | { error }

  const { data } = useQuery({
    queryKey: ['docs'],
    queryFn: () => api.get('/docs').then(r => r.data.data),
  });

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post('/docs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Wgrano: ${file.name}`);
      qc.invalidateQueries(['docs']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Błąd wgrywania');
    }
    e.target.value = '';
  };

  const remove = async (name) => {
    if (!confirm(`Usunąć ${name}?`)) return;
    await api.delete(`/docs/${encodeURIComponent(name)}`);
    toast.success('Usunięto');
    qc.invalidateQueries(['docs']);
  };

  const generate = async () => {
    setGenerating(true);
    setGenResult(null);
    try {
      const r = await api.post('/docs/generate-ai-replies', { limit: genLimit });
      setGenResult(r.data);
      qc.invalidateQueries(['docs']);
      toast.success(`Wygenerowano ${r.data.count} przykładów → ${r.data.filename}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Błąd generowania';
      setGenResult({ error: msg });
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const files = data || [];

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Baza wiedzy AI (pliki .md)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pliki Markdown dołączane do kontekstu AI przy generowaniu propozycji odpowiedzi.
        </p>
      </div>

      {/* Lista plików */}
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">Brak plików</p>
      ) : (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.name} className="flex items-center justify-between text-sm">
              <span className="font-mono text-gray-700 dark:text-gray-300">{f.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => remove(f.name)} className="text-red-500 hover:text-red-700 text-xs">Usuń</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Wgraj ręcznie */}
      <div>
        <input ref={fileRef} type="file" accept=".md" onChange={upload} className="hidden" />
        <button onClick={() => fileRef.current.click()} className="btn-secondary btn-sm">
          + Wgraj plik .md
        </button>
      </div>

      {/* Separator */}
      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Generator Q&A */}
      <div>
        <h4 className="text-sm font-semibold mb-1">Generuj dokument dla AI</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Tworzy plik <span className="font-mono">ai-udzielone-odp.md</span> na podstawie zamkniętych zgłoszeń
          i rzeczywistych odpowiedzi pracowników. AI uczy się tonu i stylu Twojego helpdesku.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Liczba przykładów:
          </label>
          <input
            type="number"
            min={10}
            max={200}
            value={genLimit}
            onChange={e => setGenLimit(Number(e.target.value))}
            className="input w-20 text-sm"
          />
          <button
            onClick={generate}
            disabled={generating}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            {generating ? 'Generuję…' : '✦ Generuj dokument dla AI'}
          </button>
        </div>

        {genResult && !genResult.error && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded px-3 py-2">
            <span>✓</span>
            <span>
              Zapisano <strong>{genResult.count}</strong> przykładów do <span className="font-mono">{genResult.filename}</span>
              {' '}({(genResult.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
        {genResult?.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded px-3 py-2">
            {genResult.error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel kategorii zgłoszeń ─────────────────────────────────────────────────
function KategoriePanel() {
  const qc = useQueryClient();
  const [newNazwa, setNewNazwa] = useState('');
  const [newOpis, setNewOpis] = useState('');
  const [newKol, setNewKol] = useState('0');
  const [editing, setEditing] = useState(null); // { id, nazwa, opis, kolejnosc }

  const { data, isLoading } = useQuery({
    queryKey: ['kategorie'],
    queryFn: () => api.get('/kategorie').then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/kategorie', { nazwa: newNazwa, opis: newOpis, kolejnosc: parseInt(newKol) || 0 }),
    onSuccess: () => {
      toast.success('Kategoria dodana');
      setNewNazwa(''); setNewOpis(''); setNewKol('0');
      qc.invalidateQueries(['kategorie']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Błąd dodawania'),
  });

  const update = useMutation({
    mutationFn: (data) => api.put(`/kategorie/${editing.id}`, data),
    onSuccess: () => {
      toast.success('Zapisano');
      setEditing(null);
      qc.invalidateQueries(['kategorie']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Błąd zapisu'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, aktywna }) => api.put(`/kategorie/${id}`, { aktywna: !aktywna }),
    onSuccess: () => qc.invalidateQueries(['kategorie']),
    onError: (err) => toast.error(err.response?.data?.error || 'Błąd'),
  });

  const rows = data || [];

  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Kategorie zgłoszeń</h3>
      <p className="text-xs text-gray-500 mb-4">
        Kategorie są widoczne w publicznym formularzu zgłoszeń. Użyj pola „Kolejność" do sortowania.
      </p>

      {/* Tabela istniejących */}
      {isLoading ? (
        <p className="text-sm text-gray-400">Ładowanie...</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Nazwa</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Opis</th>
                <th className="pb-2 font-medium text-center w-16">Kol.</th>
                <th className="pb-2 font-medium text-center w-20">Status</th>
                <th className="pb-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400">Brak kategorii</td></tr>
              )}
              {rows.map(k => (
                <tr key={k.id} className={!k.aktywna ? 'opacity-50' : ''}>
                  {editing?.id === k.id ? (
                    <>
                      <td className="py-2 pr-2">
                        <input
                          className="input py-1 text-sm"
                          value={editing.nazwa}
                          onChange={e => setEditing(v => ({ ...v, nazwa: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 pr-2 hidden sm:table-cell">
                        <input
                          className="input py-1 text-sm"
                          value={editing.opis || ''}
                          onChange={e => setEditing(v => ({ ...v, opis: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 pr-2 text-center">
                        <input
                          type="number"
                          className="input py-1 text-sm w-16 text-center"
                          value={editing.kolejnosc}
                          onChange={e => setEditing(v => ({ ...v, kolejnosc: e.target.value }))}
                        />
                      </td>
                      <td></td>
                      <td className="py-2 flex gap-1">
                        <button
                          onClick={() => update.mutate({ nazwa: editing.nazwa, opis: editing.opis, kolejnosc: parseInt(editing.kolejnosc) || 0 })}
                          className="btn-primary btn-sm py-1 px-2 text-xs"
                        >Zapisz</button>
                        <button onClick={() => setEditing(null)} className="btn-secondary btn-sm py-1 px-2 text-xs">✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-2 font-medium">{k.nazwa}</td>
                      <td className="py-2 pr-2 text-gray-500 hidden sm:table-cell">{k.opis || '—'}</td>
                      <td className="py-2 pr-2 text-center text-gray-500">{k.kolejnosc}</td>
                      <td className="py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${k.aktywna ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {k.aktywna ? 'Aktywna' : 'Ukryta'}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditing({ id: k.id, nazwa: k.nazwa, opis: k.opis || '', kolejnosc: k.kolejnosc })} className="text-blue-600 hover:underline text-xs">Edytuj</button>
                          <button onClick={() => toggleActive.mutate({ id: k.id, aktywna: k.aktywna })} className="text-gray-500 hover:text-gray-700 text-xs">
                            {k.aktywna ? 'Ukryj' : 'Pokaż'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formularz dodawania */}
      <div className="border-t pt-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Dodaj nową kategorię</p>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input py-1.5 text-sm flex-1 min-w-40"
            placeholder="Nazwa kategorii"
            value={newNazwa}
            onChange={e => setNewNazwa(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newNazwa.trim() && create.mutate()}
          />
          <input
            className="input py-1.5 text-sm flex-1 min-w-40"
            placeholder="Opis (opcjonalnie)"
            value={newOpis}
            onChange={e => setNewOpis(e.target.value)}
          />
          <input
            type="number"
            className="input py-1.5 text-sm w-20 text-center"
            placeholder="Kol."
            value={newKol}
            onChange={e => setNewKol(e.target.value)}
            title="Kolejność sortowania"
          />
          <button
            onClick={() => newNazwa.trim() && create.mutate()}
            disabled={!newNazwa.trim() || create.isPending}
            className="btn-primary btn-sm"
          >
            + Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal edycji etykiety LDAP ───────────────────────────────────────────────
const EMPTY_LABEL = { label: '', icon: '👤', condition_field: 'ldap_ou', condition_value: '', link_template: '', link_label: '' };

function LabelModal({ initial, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY_LABEL, ...initial });
  const ch = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const valid = f.label.trim() && f.condition_field.trim() && f.condition_value.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <h4 className="font-semibold text-sm">{initial?.label ? 'Edytuj etykietę' : 'Nowa etykieta'}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Ikona</label>
              <input value={f.icon} onChange={ch('icon')} className="input text-center text-lg" placeholder="👤" />
            </div>
            <div className="col-span-3">
              <label className="label">Etykieta <span className="text-red-500">*</span></label>
              <input value={f.label} onChange={ch('label')} className="input" placeholder="np. Student" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pole warunku <span className="text-red-500">*</span></label>
              <input value={f.condition_field} onChange={ch('condition_field')} className="input font-mono text-sm" placeholder="ldap_ou" />
              <p className="text-xs text-gray-400 mt-0.5">ldap_ou lub atrybut z ldap_data</p>
            </div>
            <div>
              <label className="label">Wartość warunku <span className="text-red-500">*</span></label>
              <input value={f.condition_value} onChange={ch('condition_value')} className="input font-mono text-sm" placeholder="studenci" />
            </div>
          </div>
          <div>
            <label className="label">Szablon linku</label>
            <input value={f.link_template} onChange={ch('link_template')} className="input font-mono text-sm" placeholder="https://app.pl/user/{studid}" />
            <p className="text-xs text-gray-400 mt-0.5"><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{param}'}</code> = atrybut z LDAP, np. <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{studid}'}</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{uid}'}</code></p>
          </div>
          <div>
            <label className="label">Tekst linku</label>
            <input value={f.link_label} onChange={ch('link_label')} className="input" placeholder="Otwórz kartotekę" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary btn-sm">Anuluj</button>
          <button onClick={() => valid && onSave(f)} disabled={!valid} className="btn-primary btn-sm disabled:opacity-50">Zapisz</button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel LDAP ───────────────────────────────────────────────────────────────
function LdapPanel({ form, set, setCheck, setVal }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [editing, setEditing] = useState(null); // null=zamknięty, -1=nowy, n>=0=edycja

  const parsedLabels = (() => {
    try { return form.ldap_labels ? JSON.parse(form.ldap_labels) : []; } catch { return []; }
  })();

  const updateLabels = (labels) => setVal('ldap_labels')(JSON.stringify(labels));
  const saveLabel = (lbl) => {
    if (editing === -1) updateLabels([...parsedLabels, lbl]);
    else updateLabels(parsedLabels.map((l, i) => i === editing ? lbl : l));
    setEditing(null);
  };
  const removeLabel = (i) => updateLabels(parsedLabels.filter((_, idx) => idx !== i));
  const moveLabel = (i, dir) => {
    const arr = [...parsedLabels];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    updateLabels(arr);
  };

  const testLdap = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/ustawienia/ldap-test');
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || 'Błąd połączenia' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Integracja LDAP</h3>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="ldap_enabled" checked={!!form.ldap_enabled} onChange={setCheck('ldap_enabled')} />
          <label htmlFor="ldap_enabled" className="text-sm">Włącz LDAP</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        LDAP jest używany do identyfikacji zgłaszających (studentów/wykładowców) w publicznym formularzu.
        Używany tylko do odczytu — nie loguje użytkowników przez LDAP.
      </p>

      <div className={`space-y-3 ${!form.ldap_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Serwer LDAP</label>
            <input value={form.ldap_host || ''} onChange={set('ldap_host')} className="input" placeholder="ldap.example.com" />
          </div>
          <div>
            <label className="label">Port</label>
            <input type="number" value={form.ldap_port || 389} onChange={set('ldap_port')} className="input" placeholder="389" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="ldap_tls" checked={!!form.ldap_tls} onChange={setCheck('ldap_tls')} />
          <label htmlFor="ldap_tls" className="text-sm">Użyj LDAPS (port 636, TLS)</label>
        </div>

        <div>
          <label className="label">Base DN</label>
          <input value={form.ldap_base_dn || ''} onChange={set('ldap_base_dn')} className="input font-mono text-sm" placeholder="dc=example,dc=com" />
        </div>

        <div>
          <label className="label">Bind DN (konto do wyszukiwania)</label>
          <input value={form.ldap_bind_dn || ''} onChange={set('ldap_bind_dn')} className="input font-mono text-sm" placeholder="cn=readonly,dc=example,dc=com" />
          <p className="text-xs text-gray-400 mt-0.5">Zostaw puste dla anonimowego bindowania</p>
        </div>

        <div>
          <label className="label">Hasło Bind DN</label>
          <input type="password" value={form.ldap_bind_password || ''} onChange={set('ldap_bind_password')} className="input" placeholder="(zostaw puste aby nie zmieniać)" />
        </div>

        <div>
          <label className="label">Filtr wyszukiwania użytkownika</label>
          <input value={form.ldap_user_filter || '(mail={email})'} onChange={set('ldap_user_filter')} className="input font-mono text-sm" placeholder="(mail={email})" />
          <p className="text-xs text-gray-400 mt-0.5">{'{email}'} zostanie zastąpiony adresem email. Dla AD: <code className="bg-gray-100 px-1">(userPrincipalName={'{email}'})</code></p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Atrybut imienia i nazwiska</label>
            <input value={form.ldap_attr_name || 'cn'} onChange={set('ldap_attr_name')} className="input font-mono text-sm" placeholder="cn" />
          </div>
          <div>
            <label className="label">Atrybut typu użytkownika</label>
            <input value={form.ldap_attr_type || 'employeeType'} onChange={set('ldap_attr_type')} className="input font-mono text-sm" placeholder="employeeType" />
            <p className="text-xs text-gray-400 mt-0.5">np. employeeType, eduPersonAffiliation</p>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button type="button" onClick={testLdap} disabled={testing || !form.ldap_host} className="btn-secondary btn-sm">
            {testing ? 'Testowanie...' : 'Testuj połączenie'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.msg}
            </span>
          )}
        </div>

        {/* ── Karta LDAP w zgłoszeniu ── */}
        <div className="mt-2 pt-4 border-t dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Karta LDAP w zgłoszeniu</h4>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ldap_card_enabled" checked={form.ldap_card_enabled !== undefined ? !!form.ldap_card_enabled : true} onChange={setCheck('ldap_card_enabled')} />
              <label htmlFor="ldap_card_enabled" className="text-sm">Pokazuj kartę</label>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Etykiety dopasowywane są do zgłoszenia na podstawie wartości atrybutu LDAP. Pierwsza pasująca etykieta wygrywa.
          </p>

          <div className={`space-y-1.5 ${!form.ldap_card_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {parsedLabels.length === 0 && (
              <p className="text-xs text-gray-400 italic py-2">Brak etykiet — dodaj pierwszą.</p>
            )}
            {parsedLabels.map((lbl, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded border dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm">
                <span className="text-base w-6 text-center flex-shrink-0">{lbl.icon || '👤'}</span>
                <span className="font-medium w-24 flex-shrink-0 truncate">{lbl.label}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{lbl.condition_field}</code>
                  {' = '}
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{lbl.condition_value}</code>
                </span>
                {lbl.link_template && (
                  <span className="text-xs text-blue-500 truncate flex-1 min-w-0" title={lbl.link_template}>{lbl.link_template}</span>
                )}
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  <button onClick={() => moveLabel(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↑</button>
                  <button onClick={() => moveLabel(i, 1)} disabled={i === parsedLabels.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">↓</button>
                  <button onClick={() => setEditing(i)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-1">Edytuj</button>
                  <button onClick={() => removeLabel(i)} className="text-xs text-red-500 hover:underline px-1">Usuń</button>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing(-1)} className="btn-secondary btn-sm w-full mt-1">
              + Dodaj etykietę
            </button>
          </div>
        </div>
      </div>

      {editing !== null && (
        <LabelModal
          initial={editing === -1 ? {} : parsedLabels[editing]}
          onSave={saveLabel}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Panel Microsoft 365 Graph ────────────────────────────────────────────────
function MsGraphPanel({ form, set, setCheck }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testGraph = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/ustawienia/ms-graph-test');
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || 'Błąd połączenia' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">☁️</span>
          <h3 className="font-semibold">Microsoft 365 (Graph API)</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ms_graph_enabled"
            checked={!!form.ms_graph_enabled}
            onChange={setCheck('ms_graph_enabled')}
          />
          <label htmlFor="ms_graph_enabled" className="text-sm font-medium">Włącz</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Wysyłanie i odbieranie przez Microsoft Graph API (rekomendowane dla Microsoft 365 / Exchange Online).
        Wymaga rejestracji aplikacji w Azure AD z uprawnieniami aplikacyjnymi{' '}
        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Mail.Send</code> i{' '}
        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Mail.ReadWrite</code> oraz{' '}
        <strong>Admin Consent</strong>.
      </p>

      <div className={`space-y-3 ${!form.ms_graph_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="label">Client ID (Application ID)</label>
          <input
            value={form.ms_graph_client_id || ''}
            onChange={set('ms_graph_client_id')}
            className="input font-mono text-sm"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </div>
        <div>
          <label className="label">Client Secret</label>
          <input
            type="password"
            value={form.ms_graph_client_secret || ''}
            onChange={set('ms_graph_client_secret')}
            className="input"
            placeholder="(zostaw puste aby nie zmieniać)"
          />
        </div>
        <div>
          <label className="label">Tenant ID</label>
          <input
            value={form.ms_graph_tenant_id || ''}
            onChange={set('ms_graph_tenant_id')}
            className="input font-mono text-sm"
            placeholder="contoso.onmicrosoft.com lub GUID tenanta"
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Znajdziesz go w Azure AD → Przegląd → ID katalogu (tenanta)
          </p>
        </div>
        <div>
          <label className="label">Adres skrzynki pocztowej</label>
          <input
            type="email"
            value={form.ms_graph_mailbox || ''}
            onChange={set('ms_graph_mailbox')}
            className="input"
            placeholder="helpdesk@firma.pl"
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Skrzynka, z której system będzie wysyłał i odbierał wiadomości
          </p>
        </div>

        <div className="pt-1 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={testGraph}
            disabled={testing || !form.ms_graph_client_id || !form.ms_graph_mailbox}
            className="btn-secondary btn-sm"
          >
            {testing ? 'Testowanie...' : 'Testuj połączenie'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.msg}
            </span>
          )}
        </div>

        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
          <strong>Konfiguracja w Azure AD:</strong>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>Azure Active Directory → Rejestracje aplikacji → Nowa rejestracja</li>
            <li>Uprawnienia API → Microsoft Graph → Uprawnienia aplikacji → <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">Mail.Send</code> + <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">Mail.ReadWrite</code></li>
            <li>Udziel zgody administratora (Grant admin consent)</li>
            <li>Certyfikaty i wpisy tajne → Nowy wpis tajny (Client Secret)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Panel Facebook Messenger ─────────────────────────────────────────────────
function MessengerPanel({ form, set, setCheck }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: zespoly } = useQuery({
    queryKey: ['zespoly'],
    queryFn: () => api.get('/zespoly').then((r) => r.data.data),
  });

  const webhookUrl = `${API_BASE}/api/messenger/webhook`;

  const testMessenger = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/ustawienia/messenger-test');
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || 'Błąd połączenia' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📘</span>
          <h3 className="font-semibold">Facebook Messenger</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="messenger_enabled"
            checked={!!form.messenger_enabled}
            onChange={setCheck('messenger_enabled')}
          />
          <label htmlFor="messenger_enabled" className="text-sm font-medium">Włącz</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Odbieranie i wysyłanie wiadomości przez Messenger Platform (Facebook Graph API).
        Wymaga własnej aplikacji w Meta for Developers podłączonej do strony szkoły oraz przejścia
        App Review dla uprawnienia <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">pages_messaging</code>.
      </p>

      <div className={`space-y-3 ${!form.messenger_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="label">Page ID</label>
          <input
            value={form.messenger_page_id || ''}
            onChange={set('messenger_page_id')}
            className="input font-mono text-sm"
            placeholder="np. 123456789012345"
          />
        </div>
        <div>
          <label className="label">Page Access Token</label>
          <input
            type="password"
            value={form.messenger_page_access_token || ''}
            onChange={set('messenger_page_access_token')}
            className="input"
            placeholder="(zostaw puste aby nie zmieniać)"
          />
        </div>
        <div>
          <label className="label">App Secret</label>
          <input
            type="password"
            value={form.messenger_app_secret || ''}
            onChange={set('messenger_app_secret')}
            className="input"
            placeholder="(zostaw puste aby nie zmieniać)"
          />
        </div>
        <div>
          <label className="label">Zespół powiadamiany o nowych wiadomościach</label>
          <select
            value={form.messenger_zespol_id || ''}
            onChange={set('messenger_zespol_id')}
            className="input"
          >
            <option value="">(brak — powiadamiaj wszystkich adminów)</option>
            {zespoly?.map((z) => (
              <option key={z.id} value={z.id}>{z.nazwa}</option>
            ))}
          </select>
        </div>

        <div className="pt-1 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={testMessenger}
            disabled={testing || !form.messenger_page_access_token}
            className="btn-secondary btn-sm"
          >
            {testing ? 'Testowanie...' : 'Testuj połączenie'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.msg}
            </span>
          )}
        </div>

        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
          <strong>Konfiguracja webhooka w Meta for Developers:</strong>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>Callback URL: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded break-all">{webhookUrl}</code></li>
            <li>Verify Token: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded break-all">{form.messenger_verify_token || '(zostanie wygenerowany po zapisaniu)'}</code></li>
            <li>Subskrybuj pole webhooka <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">messages</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Panel webhooka n8n (automatyzacja odpowiedzi) ────────────────────────────
function WebhookN8nPanel({ form, set, setCheck, setVal }) {
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const replyUrl = `${API_BASE}/api/webhook/n8n/reply`;

  const copy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Skopiowano');
  };

  const testWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/ustawienia/webhook-test');
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || 'Błąd połączenia' });
    } finally {
      setTesting(false);
    }
  };

  const regenerateSecret = async () => {
    if (!confirm('Wygenerować nowy sekret? Trzeba będzie zaktualizować konfigurację w n8n.')) return;
    setRegenerating(true);
    try {
      const { data } = await api.post('/ustawienia/webhook-regenerate-secret');
      toast.success('Nowy sekret wygenerowany');
      setVal('webhook_secret')(data.webhook_secret);
      qc.invalidateQueries(['ustawienia']);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Błąd');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="card border-indigo-200 dark:border-indigo-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold">n8n — automatyzacja odpowiedzi</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="webhook_enabled"
            checked={!!form.webhook_enabled}
            onChange={setCheck('webhook_enabled')}
          />
          <label htmlFor="webhook_enabled" className="text-sm font-medium">Włącz</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Gdy włączone: helpdesk wysyła zdarzenia (nowy ticket, nowa wiadomość od klienta) na adres
        webhooka n8n, a n8n może wywołać poniższy endpoint, aby wstawić automatyczną odpowiedź do ticketu.
      </p>

      <div className={`space-y-3 ${!form.webhook_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="label">URL webhooka n8n (helpdesk → n8n)</label>
          <input
            value={form.webhook_url || ''}
            onChange={set('webhook_url')}
            className="input font-mono text-sm"
            placeholder="https://n8n.twojadomena.pl/webhook/..."
          />
        </div>

        <div className="pt-1 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={testWebhook}
            disabled={testing || !form.webhook_url}
            className="btn-secondary btn-sm"
          >
            {testing ? 'Testowanie...' : 'Testuj webhook'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.msg}
            </span>
          )}
        </div>

        <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs text-indigo-800 dark:text-indigo-200">
          <strong>Konfiguracja w n8n (n8n → helpdesk):</strong>
          <ol className="mt-1 ml-4 list-decimal space-y-1">
            <li>
              URL do wywołania (HTTP Request node, metoda POST):
              <div className="flex items-center gap-1 mt-0.5">
                <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded break-all flex-1">{replyUrl}</code>
                <button type="button" onClick={() => copy(replyUrl)} className="text-indigo-600 dark:text-indigo-300 hover:underline shrink-0">kopiuj</button>
              </div>
            </li>
            <li>
              Nagłówek <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">X-Webhook-Secret</code>:
              <div className="flex items-center gap-1 mt-0.5">
                <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded break-all flex-1">{form.webhook_secret || '(zostanie wygenerowany po odświeżeniu)'}</code>
                <button type="button" onClick={() => copy(form.webhook_secret)} disabled={!form.webhook_secret} className="text-indigo-600 dark:text-indigo-300 hover:underline shrink-0">kopiuj</button>
              </div>
            </li>
            <li>
              Treść JSON: <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">{'{ ticket_numer, tresc, html?, close? }'}</code>
              {' '}— <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">ticket_numer</code> i treść wiadomości otrzymujesz w zdarzeniu wysłanym do n8n.
            </li>
          </ol>
          <button
            type="button"
            onClick={regenerateSecret}
            disabled={regenerating}
            className="mt-2 text-indigo-700 dark:text-indigo-300 hover:underline"
          >
            {regenerating ? 'Generowanie...' : 'Wygeneruj nowy sekret'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel czyszczenia skrzynki ───────────────────────────────────────────────
function MailboxCleanupPanel({ form, set, setCheck }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data } = await api.get('/ustawienia/ms-graph-stats');
      setStats(data);
    } catch (err) {
      setStatsError(err.response?.data?.error || 'Błąd pobierania statystyk');
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold mb-3">Zarządzanie skrzynką</h3>

      {/* Statystyki skrzynki Graph */}
      {!!form.ms_graph_enabled && (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Statystyki skrzynki Microsoft</p>
            <button
              type="button"
              onClick={loadStats}
              disabled={statsLoading}
              className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              {statsLoading ? 'Pobieranie...' : stats ? 'Odśwież' : 'Pokaż'}
            </button>
          </div>
          {statsError && (
            <p className="text-xs text-red-600">{statsError}</p>
          )}
          {stats && !statsError && (
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="text-center">
                <p className="text-slate-500 mb-0.5">Skrzynka odbiorcza</p>
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.inboxItems}</p>
                <p className="text-slate-400">wiadomości</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 mb-0.5">Nieprzeczytane</p>
                <p className="text-lg font-semibold text-blue-600">{stats.inboxUnread}</p>
                <p className="text-slate-400">w skrzynce</p>
              </div>
              <div className="text-center">
                {stats.storageUsedInBytes != null ? (
                  <>
                    <p className="text-slate-500 mb-0.5">Zajętość skrzynki</p>
                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {stats.storageUsedInBytes >= 1073741824
                        ? (stats.storageUsedInBytes / 1073741824).toFixed(2) + ' GB'
                        : (stats.storageUsedInBytes / 1048576).toFixed(0) + ' MB'}
                    </p>
                    <p className="text-slate-400">
                      {stats.quotaInBytes
                        ? `z ${stats.quotaInBytes >= 1073741824 ? (stats.quotaInBytes / 1073741824).toFixed(0) + ' GB' : (stats.quotaInBytes / 1048576).toFixed(0) + ' MB'} limitu`
                        : `${stats.totalItems} wiad. łącznie`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-500 mb-0.5">Inbox + Sent + Spam…</p>
                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.totalItems}</p>
                    <p className="text-slate-400">wiadomości łącznie</p>
                    {stats.storageError && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" title={stats.storageError}>
                        ⚠ zajętość niedostępna
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {!stats && !statsError && !statsLoading && (
            <p className="text-xs text-slate-400">Kliknij „Pokaż" aby odczytać rozmiar skrzynki.</p>
          )}
        </div>
      )}

      {/* Czyszczenie po pobraniu */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="clean_mailbox"
            checked={!!form.clean_mailbox}
            onChange={setCheck('clean_mailbox')}
            className="mt-0.5"
          />
          <div>
            <label htmlFor="clean_mailbox" className="text-sm font-medium cursor-pointer">
              Usuń wiadomość ze skrzynki po pobraniu
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Po przetworzeniu każda wiadomość zostanie trwale usunięta
              ({form.ms_graph_enabled ? 'Graph: DELETE' : 'IMAP: \\Deleted + EXPUNGE'}).
              Bez tej opcji wiadomości są tylko oznaczane jako przeczytane.
            </p>
          </div>
        </div>

        {/* Auto-delete starych */}
        <div>
          <label className="label">Automatycznie usuń wiadomości starsze niż (dni)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={form.clean_mailbox_days ?? 0}
              onChange={set('clean_mailbox_days')}
              className="input w-24"
              placeholder="0"
            />
            <span className="text-sm text-gray-500">dni (0 = wyłączone)</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Przykład: 14 dni — wiadomości, na które nie odpowiedziano od 2 tygodni, zostaną usunięte ze skrzynki.
            Operacja wykonywana przy każdym cyklu odczytu poczty.
          </p>
        </div>

        {/* Usuwanie historii cytowanej */}
        <div className="border-t pt-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="strip_quoted_reply"
              checked={form.strip_quoted_reply !== undefined ? !!form.strip_quoted_reply : true}
              onChange={setCheck('strip_quoted_reply')}
              className="mt-0.5"
            />
            <div>
              <label htmlFor="strip_quoted_reply" className="text-sm font-medium cursor-pointer">
                Przytnij historię cytowaną z odpowiedzi
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Gdy odbiorca odpowiada na email helpdesku, jego program pocztowy dokłada historię poprzednich wiadomości.
                Ta opcja automatycznie usuwa zacytowaną część — w systemie zapisuje się tylko nowa treść odpowiedzi.
                Obsługuje formaty Outlook, Gmail, Apple Mail i Thunderbird.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel przypomnień email ──────────────────────────────────────────────────
function ReminderPanel({ form, set, setCheck }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testReminder = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/ustawienia/reminder-test');
      setTestResult({ ok: true, msg: data.message });
    } catch (err) {
      setTestResult({ ok: false, msg: err.response?.data?.error || 'Błąd' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Przypomnienia email dla pracowników</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="reminder_enabled"
            checked={form.reminder_enabled !== undefined ? !!form.reminder_enabled : true}
            onChange={setCheck('reminder_enabled')}
          />
          <label htmlFor="reminder_enabled" className="text-sm">Włącz</label>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        System wysyła automatyczne przypomnienia raz dziennie:
        adminów o nieprzypisanych zgłoszeniach, pracowników o korespondencji bez odpowiedzi.
      </p>

      <div className={`space-y-3 ${!form.reminder_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Brak reakcji przez (godziny)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={form.reminder_delay_hours ?? 24}
              onChange={set('reminder_delay_hours')}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-0.5">Domyślnie: 24 godziny</p>
          </div>
          <div>
            <label className="label">Godzina wysyłki</label>
            <input
              type="number"
              min="0"
              max="23"
              value={form.reminder_hour ?? 8}
              onChange={set('reminder_hour')}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-0.5">Godz. 0–23 (domyślnie: 8)</p>
          </div>
        </div>

        <div className="pt-1 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={testReminder}
            disabled={testing}
            className="btn-secondary btn-sm"
          >
            {testing ? 'Wysyłanie...' : 'Wyślij teraz (test)'}
          </button>
          {testResult && (
            <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.msg}
            </span>
          )}
        </div>

        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <p><strong>Adminowie otrzymują:</strong> listę nowych zgłoszeń bez przypisanego pracownika starszych niż X godzin.</p>
          <p><strong>Pracownicy otrzymują:</strong> listę przypisanych im zgłoszeń z korespondencją nieodpowiedzi&shy;aną przez X godzin.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Główna strona Ustawień ───────────────────────────────────────────────────

const TABS = [
  { id: 'ogolne', label: 'Ogólne' },
  { id: 'smtp', label: 'SMTP' },
  { id: 'imap', label: 'IMAP' },
  { id: 'kategorie', label: 'Kategorie zgłoszeń' },
  { id: 'ldap', label: 'LDAP' },
  { id: 'messenger', label: 'Facebook Messenger' },
  { id: 'n8n', label: 'n8n' },
  { id: 'inne', label: 'Inne' },
];

export default function Ustawienia() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('ogolne');
  const [form, setForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['ustawienia'],
    queryFn: () => api.get('/ustawienia').then(r => r.data.ustawienia),
  });

  const effectiveForm = Object.keys(form).length ? form : (data || {});

  const save = useMutation({
    mutationFn: () => api.put('/ustawienia', effectiveForm),
    onSuccess: () => toast.success('Ustawienia zapisane'),
    onError: (err) => toast.error(err.response?.data?.error || 'Błąd zapisu'),
  });

  const set = (k) => (e) => setForm(f => ({ ...effectiveForm, ...f, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(f => ({ ...effectiveForm, ...f, [k]: e.target.checked ? 1 : 0 }));
  const setVal = (k) => (v) => setForm(f => ({ ...effectiveForm, ...f, [k]: v }));

  if (isLoading) return <div className="text-center py-12 text-gray-500">Ładowanie...</div>;

  const isFormTab = ['ogolne', 'smtp', 'imap', 'ldap', 'messenger', 'n8n', 'inne'].includes(activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Ustawienia systemu</h2>
        {isFormTab && (
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'Zapisuję...' : 'Zapisz ustawienia'}
          </button>
        )}
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Zawartość zakładek */}
      {activeTab === 'ogolne' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logo */}
          <div className="md:col-span-2">
            <LogoPanel logoCurrent={effectiveForm.logo_path} />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Ogólne</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Nazwa systemu</label>
                <input value={effectiveForm.app_name || ''} onChange={set('app_name')} className="input" placeholder="Helpdesk" />
              </div>
              <div>
                <label className="label">{t('settings.language')}</label>
                <select value={effectiveForm.app_language || 'pl'} onChange={set('app_language')} className="input">
                  <option value="pl">{t('common.language_pl')}</option>
                  <option value="en">{t('common.language_en')}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('settings.language_hint')}</p>
              </div>
              <div>
                <label className="label">Adres strony pomocy</label>
                <input
                  type="url"
                  value={effectiveForm.site_url || ''}
                  onChange={set('site_url')}
                  className="input"
                  placeholder="https://pomoc.twojadomena.pl"
                />
                <p className="text-xs text-gray-400 mt-1">Używany w linkach wysyłanych e-mailem (linki do ticketów, tokeny dostępu, przypomnienia). Bez ukośnika na końcu.</p>
              </div>
              <div>
                <label className="label">Email administratora</label>
                <input type="email" value={effectiveForm.adminEmail || ''} onChange={set('adminEmail')} className="input" />
              </div>
              <div>
                <label className="label">Nadawca (email)</label>
                <input type="email" value={effectiveForm.senderEmail || ''} onChange={set('senderEmail')} className="input" />
              </div>
              <div>
                <label className="label">Nadawca (nazwa)</label>
                <input value={effectiveForm.senderName || ''} onChange={set('senderName')} className="input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="powiadom_nadawce" checked={!!effectiveForm.powiadom_nadawce} onChange={setCheck('powiadom_nadawce')} />
                <label htmlFor="powiadom_nadawce" className="text-sm">Powiadamiaj nadawcę o nowym tickecie</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="powiadom_rejestracja" checked={!!effectiveForm.powiadom_rejestracja} onChange={setCheck('powiadom_rejestracja')} />
                <label htmlFor="powiadom_rejestracja" className="text-sm">
                  Powiadamiaj zgłaszającego o przyjęciu zgłoszenia
                  <span className="block text-xs text-slate-400 font-normal">Wyślij email z numerem ticketu zaraz po jego zarejestrowaniu (email przychodzący i nowy ticket ręczny)</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="csat_survey_enabled" checked={!!effectiveForm.csat_survey_enabled} onChange={setCheck('csat_survey_enabled')} />
                <label htmlFor="csat_survey_enabled" className="text-sm">{t('settings.csat_enabled_label')}</label>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Dane kontaktowe</h3>
            <p className="text-xs text-slate-500 mb-3">Widoczne na stronie logowania i w stopce aplikacji. Jeden wpis na linię.</p>
            <div className="space-y-3">
              <div>
                <label className="label">Telefony kontaktowe</label>
                <textarea
                  value={effectiveForm.kontakt_telefony || ''}
                  onChange={set('kontakt_telefony')}
                  rows={3}
                  className="input resize-y"
                  placeholder="+48 123 456 789&#10;+48 987 654 321"
                />
              </div>
              <div>
                <label className="label">Adresy email kontaktowe</label>
                <textarea
                  value={effectiveForm.kontakt_emaile || ''}
                  onChange={set('kontakt_emaile')}
                  rows={3}
                  className="input resize-y"
                  placeholder="helpdesk@szkola.pl&#10;it@szkola.pl"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Formularz publiczny</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="formularz_publiczny" checked={!!effectiveForm.formularz_publiczny} onChange={setCheck('formularz_publiczny')} />
                <label htmlFor="formularz_publiczny" className="text-sm">Włącz formularz publiczny (/zgloszenie)</label>
              </div>
              <div>
                <label className="label">Tytuł formularza</label>
                <input value={effectiveForm.formularz_tytul || ''} onChange={set('formularz_tytul')} className="input" placeholder="Formularz zgłoszenia" />
              </div>
              <div className="pt-1">
                <a href="/zgloszenie" target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                  Otwórz formularz publiczny →
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Tryb weekendowy (AI auto-odpowiedź)</h3>
            <p className="text-xs text-slate-500 mb-3">
              Gdy wpłynie nowe zgłoszenie poza godzinami pracy, system automatycznie wyśle odpowiedź
              z linkiem do strony statusu, gdzie zgłaszający może zapytać AI o swój problem.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Początek weekendu — piątek od godziny</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={effectiveForm.weekend_start_hour ?? 18}
                    onChange={set('weekend_start_hour')}
                    className="input w-24"
                  />
                  <span className="text-sm text-slate-500">:00</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Weekend trwa od piątku o tej godzinie do poniedziałku rano (strefa Europe/Warsaw).
                  Wpisz 0, aby weekend zaczynał się od początku piątku. Sobota i niedziela zawsze objęte.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'smtp' && (
        <div className="space-y-4 max-w-lg">
          {/* Sekcja Microsoft 365 Graph */}
          <MsGraphPanel form={effectiveForm} set={set} setCheck={setCheck} />

          {/* Standardowy SMTP */}
          <div className={`card transition-opacity ${effectiveForm.ms_graph_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Serwer SMTP (wysyłanie)</h3>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...effectiveForm, ...f, host: 'smtp.gmail.com', port: 587, encryption: 'tls' }))}
                className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                Użyj Gmaila
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Host</label>
                <input value={effectiveForm.host || ''} onChange={set('host')} className="input" placeholder="smtp.example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Port</label>
                  <input type="number" value={effectiveForm.port || ''} onChange={set('port')} className="input" placeholder="587" />
                </div>
                <div>
                  <label className="label">Szyfrowanie</label>
                  <select value={effectiveForm.encryption || ''} onChange={set('encryption')} className="input">
                    <option value="">Brak</option>
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Użytkownik</label>
                <input value={effectiveForm.username || ''} onChange={set('username')} className="input" />
              </div>
              <div>
                <label className="label">Hasło SMTP</label>
                <input type="password" value={effectiveForm.password || ''} onChange={set('password')} className="input" placeholder="(zostaw puste aby nie zmieniać)" />
                {effectiveForm.host === 'smtp.gmail.com' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Użyj{' '}
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      hasła aplikacji Google (App Password)
                    </a>
                    , nie zwykłego hasła Gmail.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'imap' && (
        <div className="space-y-4 max-w-lg">
          {effectiveForm.ms_graph_enabled ? (
            <div className="card border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-start gap-3">
                <span className="text-2xl">☁️</span>
                <div className="flex-1">
                  <p className="font-semibold text-blue-800 dark:text-blue-200">Microsoft Graph aktywny</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Odbieranie wiadomości odbywa się przez Microsoft Graph API. Skrzynka:{' '}
                    <strong>{effectiveForm.ms_graph_mailbox || '—'}</strong>.
                    Konfiguracja IMAP nie jest wymagana.
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Aby włączyć tradycyjny IMAP, wyłącz Microsoft Graph w zakładce SMTP.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Serwer IMAP (odbieranie)</h3>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...effectiveForm, ...f, imapServer: 'imap.gmail.com', imapPort: 993, imapPath: 'INBOX' }))}
                  className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  Użyj Gmaila
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="email_receive" checked={!!effectiveForm.email_receive} onChange={setCheck('email_receive')} />
                  <label htmlFor="email_receive" className="text-sm">Włącz odbieranie emaili przez IMAP</label>
                </div>
                <div>
                  <label className="label">Serwer IMAP</label>
                  <input value={effectiveForm.imapServer || ''} onChange={set('imapServer')} className="input" placeholder="imap.example.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Port</label>
                    <input type="number" value={effectiveForm.imapPort || ''} onChange={set('imapPort')} className="input" placeholder="993" />
                  </div>
                  <div>
                    <label className="label">Ścieżka</label>
                    <input value={effectiveForm.imapPath || ''} onChange={set('imapPath')} className="input" placeholder="INBOX" />
                  </div>
                </div>
                <div>
                  <label className="label">Login IMAP</label>
                  <input value={effectiveForm.imapLogin || ''} onChange={set('imapLogin')} className="input" />
                </div>
                <div>
                  <label className="label">Hasło IMAP</label>
                  <input type="password" value={effectiveForm.imapPassword || ''} onChange={set('imapPassword')} className="input" placeholder="(zostaw puste aby nie zmieniać)" />
                  {effectiveForm.imapServer === 'imap.gmail.com' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Użyj hasła aplikacji Google, nie zwykłego hasła Gmail.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Opcje czyszczenia skrzynki */}
          <MailboxCleanupPanel form={effectiveForm} set={set} setCheck={setCheck} />
        </div>
      )}

      {activeTab === 'kategorie' && (
        <KategoriePanel />
      )}

      {activeTab === 'ldap' && (
        <LdapPanel form={effectiveForm} set={set} setCheck={setCheck} setVal={setVal} />
      )}

      {activeTab === 'messenger' && (
        <div className="space-y-4 max-w-lg">
          <MessengerPanel form={effectiveForm} set={set} setCheck={setCheck} />
        </div>
      )}

      {activeTab === 'n8n' && (
        <div className="space-y-4 max-w-lg">
          <WebhookN8nPanel form={effectiveForm} set={set} setCheck={setCheck} setVal={setVal} />
        </div>
      )}

      {activeTab === 'inne' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Timery ticketów</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Czas ostrzeżenia o zamknięciu (dni)</label>
                <input type="number" value={effectiveForm.ticket_czas_ostrzezenia || ''} onChange={set('ticket_czas_ostrzezenia')} className="input" />
              </div>
              <div>
                <label className="label">Czas automatycznego zamknięcia (dni)</label>
                <input type="number" value={effectiveForm.ticket_czas_zamykania || ''} onChange={set('ticket_czas_zamykania')} className="input" />
              </div>
              <div>
                <label className="label">Stopka email</label>
                <textarea value={effectiveForm.email_stopka || ''} onChange={set('email_stopka')} rows={4} className="input resize-y" />
              </div>
            </div>
          </div>
          <DocsPanel />

          {/* Przypomnienia email */}
          <ReminderPanel form={effectiveForm} set={set} setCheck={setCheck} />
        </div>
      )}
    </div>
  );
}

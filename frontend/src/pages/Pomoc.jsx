import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/client';

export default function Pomoc() {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const lang = i18n.language?.startsWith('en') ? 'en' : 'pl';

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['pomoc-list', lang],
    queryFn: () => api.get('/pomoc', { params: { lang } }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const files = listData?.data || [];

  useEffect(() => {
    if (files.length > 0) {
      setSelected(files[0].name);
    }
  }, [lang]);

  useEffect(() => {
    if (!selected && files.length > 0) {
      setSelected(files[0].name);
    }
  }, [files, selected]);

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['pomoc-file', selected, lang],
    queryFn: () => api.get(`/pomoc/${selected}`, { params: { lang } }).then(r => r.data),
    enabled: !!selected,
    staleTime: 5 * 60 * 1000,
  });

  const selectedTitle = files.find(f => f.name === selected)?.title || '';

  return (
    <div className="flex gap-6">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-20">
          <div className="px-4 py-3 bg-blue-700 text-white font-semibold text-sm flex items-center gap-2">
            <span>📖</span> {t('help.title')}
          </div>
          <nav className="py-1">
            {listLoading ? (
              <div className="px-4 py-3 space-y-2">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
            ) : files.map(f => (
              <button
                key={f.name}
                onClick={() => setSelected(f.name)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-l-2 ${
                  selected === f.name
                    ? 'border-l-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'border-l-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {f.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Główna treść */}
      <div className="flex-1 min-w-0">
        {/* Wybór rozdziału na mobile */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm"
          >
            <span className="flex items-center gap-2">
              <span>📖</span>
              <span className="truncate">{selectedTitle || 'Wybierz rozdział'}</span>
            </span>
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mobileOpen && (
            <div className="mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {files.map(f => (
                <button
                  key={f.name}
                  onClick={() => { setSelected(f.name); setMobileOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
                    selected === f.name
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {f.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Treść artykułu */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[400px]">
          {fileLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/5" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/5" />
            </div>
          ) : fileData?.content ? (
            <article className="prose-helpdesk">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-gray-700 dark:text-gray-300">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-gray-700 dark:text-gray-300">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-50 dark:bg-gray-700/50">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50">{children}</td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-400 pl-4 py-1 my-3 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg text-blue-800 dark:text-blue-200 text-sm">{children}</blockquote>
                  ),
                  code: ({ inline, children }) =>
                    inline ? (
                      <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                    ) : (
                      <code className="block bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-3">{children}</code>
                    ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                  hr: () => <hr className="my-5 border-gray-200 dark:border-gray-700" />,
                }}
              >
                {fileData.content}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <span className="text-5xl mb-3">📖</span>
              <p className="text-base">Wybierz rozdział z listy po lewej stronie</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

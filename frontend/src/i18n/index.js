import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pl from './pl.json';
import en from './en.json';
import uk from './uk.json';

const SUPPORTED = ['pl', 'en', 'uk'];

function detectInitialLang() {
  const saved = localStorage.getItem('helpdesk_lang');
  if (saved && SUPPORTED.includes(saved)) return saved;
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED.includes(code)) return code;
  }
  return null;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
      en: { translation: en },
      uk: { translation: uk },
    },
    lng: detectInitialLang() || 'pl',
    fallbackLng: 'pl',
    interpolation: { escapeValue: false },
  });

export function setLanguage(lang) {
  i18n.changeLanguage(lang);
  localStorage.setItem('helpdesk_lang', lang);
}

export default i18n;

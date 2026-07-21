import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en/common.json'
import ru from '@/locales/ru/common.json'

const STORAGE_KEY = 'hmdm-locale-v2'

function getInitialLanguage(): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'ru') {
    return stored
  }
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    ru: { common: ru },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
})

export function setAppLanguage(lang: 'en' | 'ru'): void {
  localStorage.setItem(STORAGE_KEY, lang)
  void i18n.changeLanguage(lang)
}

export default i18n

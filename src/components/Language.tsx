'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMessages, INTL_LOCALE, LOCALES, type Locale } from '@/lib/i18n';

const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: 'en',
  setLocale: () => {},
});

/**
 * The interface language, kept in memory for the visit only: nothing is stored or sent, and
 * a reload starts in English. `<html lang>` follows the choice for screen readers.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  useEffect(() => { document.documentElement.lang = INTL_LOCALE[locale]; }, [locale]);
  return <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>;
}

export const useLocale = () => useContext(LanguageContext).locale;
export const useMessages = () => getMessages(useLocale());

const NAMES: Record<Locale, string> = { en: 'English', fr: 'Français' };

/** EN/FR switch. Each option is named and tagged in its own language. */
export function LanguageToggle() {
  const { locale, setLocale } = useContext(LanguageContext);
  return (
    <div className="units-toggle language-toggle" role="group" aria-label={getMessages(locale).language.group}>
      {LOCALES.map(option => (
        <button
          key={option}
          type="button"
          lang={INTL_LOCALE[option]}
          aria-label={NAMES[option]}
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

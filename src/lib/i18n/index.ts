import { fr } from './fr';
import { messages as en, type Messages } from './messages';

export type { Messages };
export type Locale = 'en' | 'fr';
export const LOCALES: readonly Locale[] = ['en', 'fr'];

/** BCP 47 tag used for `<html lang>` and for every `Intl` formatter. */
export const INTL_LOCALE: Record<Locale, 'en-CA' | 'fr-CA'> = { en: 'en-CA', fr: 'fr-CA' };

const DICTIONARIES: Record<Locale, Messages> = { en, fr };

export const getMessages = (locale: Locale = 'en'): Messages => DICTIONARIES[locale];

'use client';

import Link from 'next/link';
import { LanguageToggle, useMessages } from './Language';
import { UnitsToggle } from './Units';
import { LiveWeatherLabel } from './world/LiveWeatherLabel';

export function SiteHeader() {
  return (
    <header className="site-header">
      <h1 className="wordmark">Weather Window</h1>
      <LiveWeatherLabel />
      <div className="header-switches">
        <UnitsToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useMessages();
  return (
    <footer>
      <p>
        {t.footer.weatherBy}{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Open-Meteo.com
        </a>
        {t.footer.citiesFrom}
        <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>
        {' ('}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        {')'}
        {' · '}
        <Link href="/privacy">{t.footer.privacy}</Link>
      </p>
    </footer>
  );
}

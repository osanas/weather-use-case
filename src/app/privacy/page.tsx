import type { Metadata } from 'next';
import Link from 'next/link';
import { PRIVACY_SETTINGS } from '@/lib/privacy-settings';

export const metadata: Metadata = {
  title: 'Privacy notice | Weather Window',
  description: 'What Weather Window processes, who receives it and for how long.',
};

const { operator, contact, functionRegion, aiProvider, aiRetention, lastReviewed } = PRIVACY_SETTINGS;

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <header>
        <p><Link href="/">← Back to Weather Window</Link></p>
        <h1>Privacy notice</h1>
        <p>Last reviewed: {lastReviewed}</p>
      </header>

      <section aria-labelledby="who">
        <h2 id="who">Who runs this app</h2>
        <p>
          Weather Window is operated by {operator}. For any privacy question or request, contact{' '}
          {contact}.
        </p>
      </section>

      <section aria-labelledby="not-collected">
        <h2 id="not-collected">What the app does not collect</h2>
        <p>
          There are no accounts, no browser geolocation, no street addresses, no free-text fields, no
          analytics, no advertising, no tracking cookies and no history of your searches. City search runs in
          your browser; your keystrokes are not sent anywhere.
        </p>
      </section>

      <section aria-labelledby="processed">
        <h2 id="processed">What is processed and who receives it</h2>
        <ul>
          <li>
            <strong>Our hosting provider (Vercel)</strong> receives your connection, including your IP address
            and browser headers, as for any website. It runs the app&apos;s server functions in region{' '}
            {functionRegion} and may keep platform and security logs under its own settings.
          </li>
          <li>
            <strong>Open-Meteo</strong> receives the public coordinates and time zone of the city you select,
            to return a forecast. It never receives your IP address or browser headers from the app.
          </li>
          <li>
            <strong>{aiProvider} (only when AI assistance is enabled)</strong> receives the city name, activity, date,
            duration, the app&apos;s fixed weather limits and the public hourly forecast for that day. It never
            receives your IP address, browser headers or any identifier. {aiProvider} data retention for this
            deployment: {aiRetention}.
          </li>
        </ul>
      </section>

      <section aria-labelledby="logs">
        <h2 id="logs">Application logs</h2>
        <p>
          The app logs only operational fields: the route, a status category, a provider outcome and the elapsed
          time. It does not log request bodies, planning choices, IP addresses, headers, cookies or model text.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Your rights</h2>
        <p>
          You can ask what information about you is held, and request access or correction, by contacting{' '}
          {contact}. Because the app does not keep accounts or search history, it usually holds nothing that
          identifies you; platform logs are handled under the hosting provider&apos;s retention settings.
        </p>
      </section>
    </main>
  );
}

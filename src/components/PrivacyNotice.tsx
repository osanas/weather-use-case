'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { PRIVACY_SETTINGS } from '@/lib/privacy-settings';
import { LanguageToggle, useLocale } from './Language';

const { operator, contact, functionRegion, aiProvider, aiRetention, aiRetentionFr, lastReviewed } = PRIVACY_SETTINGS;
const TITLE = { en: 'Privacy notice | Weather Window', fr: 'Avis de confidentialité | Weather Window' };

/** The privacy notice in the interface language; both versions state the same facts. */
export function PrivacyNotice() {
  const locale = useLocale();
  useEffect(() => { document.title = TITLE[locale]; }, [locale]);
  return (
    <main className="privacy">
      <LanguageToggle />
      {locale === 'fr' ? <FrenchNotice /> : <EnglishNotice />}
    </main>
  );
}

function EnglishNotice() {
  return (
    <>
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
          There are no accounts, no browser geolocation, no street addresses, no free text sent from your browser, no
          analytics, no advertising, no tracking cookies and no history of your searches. City search runs in
          your browser on a list of cities downloaded from this site; your keystrokes are not sent anywhere.
          If you switch between °C and °F, that choice is saved in your browser only and never sent.
          The interface language you choose lasts for your visit only: it is neither saved nor sent.
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
            <strong>Default city from your approximate location</strong>: on the first visit, the server reads the
            approximate latitude and longitude that the hosting provider attaches to the request and picks the
            nearest city in the app&apos;s list (or Laval if none is within 300 km). The position is used only for
            that choice, is not stored or logged, and is never sent to Open-Meteo or the AI provider. No browser
            permission is requested.
          </li>
          <li>
            <strong>Open-Meteo</strong> receives the public coordinates and time zone of the city you select,
            to return a forecast. It never receives your IP address or browser headers from the app.
          </li>
          <li>
            <strong>{aiProvider} (only when AI assistance is enabled)</strong> receives the city name, activity, date,
            duration, the app&apos;s fixed weather limits and the public hourly forecast for that day. It never
            receives your IP address, browser headers or any identifier. An activity name you type stays in your
            browser: only the &ldquo;other activity&rdquo; profile is sent. {aiProvider} data retention for this
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
    </>
  );
}

function FrenchNotice() {
  return (
    <>
      <header>
        <p><Link href="/">← Retour à Weather Window</Link></p>
        <h1>Avis de confidentialité</h1>
        <p>Dernière révision : {lastReviewed}</p>
      </header>

      <section aria-labelledby="who">
        <h2 id="who">Qui exploite cette application</h2>
        <p>
          Weather Window est exploitée par {operator}. Pour toute question ou demande liée à la vie privée,
          écrivez à {contact}.
        </p>
      </section>

      <section aria-labelledby="not-collected">
        <h2 id="not-collected">Ce que l&apos;application ne recueille pas</h2>
        <p>
          Il n&apos;y a pas de comptes, pas de géolocalisation par le navigateur, pas d&apos;adresses civiques, aucun
          texte libre envoyé depuis votre navigateur, aucune mesure d&apos;audience, aucune publicité, aucun témoin de
          suivi et aucun historique de vos recherches. La recherche de villes s&apos;exécute dans votre navigateur à
          partir d&apos;une liste de villes téléchargée de ce site; vos frappes ne sont envoyées nulle part. Si vous
          passez de °C à °F, ce choix est enregistré dans votre navigateur seulement et n&apos;est jamais envoyé.
          La langue d&apos;affichage choisie ne dure que le temps de votre visite : elle n&apos;est ni enregistrée ni
          envoyée.
        </p>
      </section>

      <section aria-labelledby="processed">
        <h2 id="processed">Ce qui est traité et qui le reçoit</h2>
        <ul>
          <li>
            <strong>Notre hébergeur (Vercel)</strong> reçoit votre connexion, y compris votre adresse IP et les
            en-têtes de votre navigateur, comme pour tout site Web. Il exécute les fonctions serveur de
            l&apos;application dans la région {functionRegion} et peut conserver des journaux de plateforme et de
            sécurité selon ses propres réglages.
          </li>
          <li>
            <strong>Ville par défaut selon votre position approximative</strong> : à la première visite, le serveur
            lit la latitude et la longitude approximatives que l&apos;hébergeur joint à la requête et choisit la ville
            la plus proche dans la liste de l&apos;application (ou Laval s&apos;il n&apos;y en a aucune à moins de
            300 km). La position ne sert qu&apos;à ce choix, n&apos;est ni conservée ni journalisée, et n&apos;est jamais
            envoyée à Open-Meteo ni au fournisseur d&apos;IA. Aucune permission n&apos;est demandée au navigateur.
          </li>
          <li>
            <strong>Open-Meteo</strong> reçoit les coordonnées publiques et le fuseau horaire de la ville choisie
            pour renvoyer des prévisions. L&apos;application ne lui transmet jamais votre adresse IP ni les en-têtes
            de votre navigateur.
          </li>
          <li>
            <strong>{aiProvider} (seulement lorsque l&apos;assistance par IA est activée)</strong> reçoit le nom de la
            ville, l&apos;activité, la date, la durée, les limites météo fixes de l&apos;application et les prévisions
            horaires publiques de ce jour. Il ne reçoit jamais votre adresse IP, les en-têtes de votre navigateur
            ni aucun identifiant. Le nom d&apos;activité que vous écrivez reste dans votre navigateur : seul le profil
            « autre activité » est envoyé. Conservation des données par {aiProvider} pour ce déploiement :{' '}
            {aiRetentionFr}.
          </li>
        </ul>
      </section>

      <section aria-labelledby="logs">
        <h2 id="logs">Journaux de l&apos;application</h2>
        <p>
          L&apos;application ne journalise que des champs d&apos;exploitation : la route, une catégorie de statut, le
          résultat chez le fournisseur et le temps écoulé. Elle ne journalise ni le contenu des requêtes, ni vos
          choix de planification, ni les adresses IP, les en-têtes, les témoins ou le texte du modèle.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">Vos droits</h2>
        <p>
          Vous pouvez demander quels renseignements à votre sujet sont détenus, et en demander l&apos;accès ou la
          rectification, en écrivant à {contact}. Comme l&apos;application ne tient ni comptes ni historique de
          recherche, elle ne détient habituellement rien qui vous identifie; les journaux de plateforme sont
          traités selon les réglages de conservation de l&apos;hébergeur.
        </p>
      </section>
    </>
  );
}

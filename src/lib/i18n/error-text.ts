import type { Messages } from './messages';

/**
 * Localised text for a server error code. An unknown or missing code (a perimeter limit, a
 * network failure) falls back to the route's generic message; server text is not shown.
 */
export function errorText(t: Messages, code: string | undefined, route: 'weather' | 'plan'): string {
  const { errors } = t;
  switch (code) {
    case 'invalid_city': return errors.unknownCity;
    case 'payload_too_large': return errors.tooLarge;
    case 'unsupported_media_type': return errors.mediaType;
    case 'invalid_criteria': return errors.criteria;
    case 'weather_unavailable': return errors.weather;
    default: return route === 'weather' ? errors.weather : errors.planning;
  }
}

import { getCached } from './cache';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getTimezones(): Promise<string[]> {
  return getCached('timezones', DAY_MS, async () => {
    if (typeof Intl !== 'undefined' && typeof (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === 'function') {
      return (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
    }
    // Fallback: minimal list if environment doesn't support it
    return [
      'UTC',
      'Etc/UTC',
      'Europe/London',
      'America/New_York',
    ];
  });
}

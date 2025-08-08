import { getCached } from './cache';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getTimezones(): Promise<string[]> {
  return getCached('timezones', DAY_MS, async () => {
    if (typeof (Intl as any)?.supportedValuesOf === 'function') {
      return (Intl as any).supportedValuesOf('timeZone') as string[];
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

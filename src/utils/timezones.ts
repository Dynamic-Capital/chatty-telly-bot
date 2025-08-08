import { getCached } from './cache';

const DAY_MS = 24 * 60 * 60 * 1000;

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

export function getTimezones(): Promise<string[]> {
  return getCached('timezones', DAY_MS, () => {
    const intl = Intl as IntlWithSupportedValues;
    if (typeof intl.supportedValuesOf === 'function') {
      return Promise.resolve(intl.supportedValuesOf('timeZone'));
    }
    // Fallback: minimal list if environment doesn't support it
    return Promise.resolve([
      'UTC',
      'Etc/UTC',
      'Europe/London',
      'America/New_York',
    ]);
  });
}

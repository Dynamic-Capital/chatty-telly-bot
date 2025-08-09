export const BUILTIN_TEMPLATES: Record<string, Record<string, string>> = {
  en: {
    'welcome.title': '👋 Welcome',
    'welcome.body': 'Welcome to the bot!',
    'help.body': 'This bot helps you interact with our service.',
    'info.body': 'Just a friendly bot.',
    'errors.rate_limited': 'Too many requests, slow down please.',
    'admin.labels.content': 'Content',
  },
};

const kvStore = new Map<string, string>();

function makeKey(lang: string, key: string): string {
  return `${lang}:${key}`;
}

export function getTemplate(lang: string, key: string): string | undefined {
  const stored = kvStore.get(makeKey(lang, key));
  if (stored !== undefined) return stored;
  const langBuiltins = BUILTIN_TEMPLATES[lang];
  if (langBuiltins && key in langBuiltins) return langBuiltins[key];
  return undefined;
}

export function setTemplate(lang: string, key: string, text: string): void {
  kvStore.set(makeKey(lang, key), text);
}

export function listKeys(lang: string): string[] {
  const keys = new Set<string>();
  const langBuiltins = BUILTIN_TEMPLATES[lang] || {};
  for (const k of Object.keys(langBuiltins)) keys.add(k);
  for (const storedKey of kvStore.keys()) {
    const [l, k] = storedKey.split(':');
    if (l === lang) keys.add(k);
  }
  return [...keys];
}

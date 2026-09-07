/**
 * Email validation shared by the login screen and the auth boundary.
 *
 * Syntax alone is not enough here: `name@gmail.xyz` is syntactically an
 * email address, but it is not a Gmail address. Known consumer providers are
 * therefore matched against their real domains, while custom domains remain
 * supported when they look like a real domain.
 */

const KNOWN_PROVIDER_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'aol.com',
  'zoho.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'yandex.com',
  'fastmail.com',
]);

// Prevent a brand name from being used with a different TLD (gmail.xyz,
// outlook.net, etc.). The real provider domains are handled above.
const PROVIDER_LOOKALIKE = /(?:^|[-.])(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|protonmail|proton|aol|zoho|gmx|yandex|fastmail)(?:[-.]|$)/i;

const EMAIL_PATTERN = /^[^\s@\\]+@[^\s@\\]+$/;

export function getEmailValidationError(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';

  const [localPart, domain] = email.split('@');
  const normalizedDomain = domain.toLowerCase();

  if (
    !localPart ||
    localPart.length > 64 ||
    email.length > 254 ||
    normalizedDomain.length > 253 ||
    normalizedDomain.startsWith('.') ||
    normalizedDomain.endsWith('.') ||
    normalizedDomain.includes('..') ||
    !normalizedDomain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  ) {
    return 'Enter a valid email address.';
  }

  if (KNOWN_PROVIDER_DOMAINS.has(normalizedDomain)) return null;
  if (PROVIDER_LOOKALIKE.test(normalizedDomain)) {
    return 'Use the provider’s official email domain, such as gmail.com or outlook.com.';
  }

  // Custom domains need a host name and a real-looking public suffix. This
  // intentionally does not claim that the mailbox exists; Supabase email
  // confirmation is the ownership check when enabled.
  const labels = normalizedDomain.split('.');
  if (labels.length < 2 || labels.at(-1)!.length < 2) {
    return 'Enter a valid email domain.';
  }

  return null;
}

export function isValidEmail(value: string): boolean {
  return getEmailValidationError(value) === null;
}

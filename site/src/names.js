// Player-name rules: short enough for the leaderboard, unique on this device, and friendly.
export const MIN = 3, MAX = 12;

// Rude words are matched anywhere in the name, after undoing letter swaps like 5h1t.
const BLOCK_ANYWHERE = [
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'whore',
  'slut', 'nigg', 'nigga', 'fag', 'rape', 'porn', 'sex', 'nazi', 'hitler', 'bastard', 'wank',
  'twat', 'piss', 'boob', 'tits', 'retard', 'killyourself', 'bollock', 'bellend', 'dildo', 'jizz',
];
// Short words that are only a problem on their own (so "Bass" or "Hassan" are fine).
const BLOCK_WORD = ['ass', 'arse', 'cum', 'hoe', 'fck', 'fk', 'sht', 'kys', 'wtf', 'stfu', 'tit', 'poop'];
// Innocent words that happen to contain a blocked word.
const ALLOW = [
  'peacock', 'hancock', 'hitchcock', 'cockpit', 'cockatoo', 'cockerel', 'essex', 'sussex', 'middlesex',
  'dickens', 'grape', 'drape', 'scrape', 'scunthorpe', 'shitake', 'titan', 'titanic', 'arsenal',
  'passion', 'classic', 'assassin', 'bassist', 'cumbria', 'document',
];
// Spelling dodges of the worst word: fack, fck, phuk, fuq...
const PATTERNS = [/f[aeiouy]*c+k/, /ph[aeiouy]*c?k/, /f[aeiouy]+q/];
const RESERVED =['bot', 'admin', 'moderator'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', '$': 's', '!': 'i' };

export const tidy = s => s.trim().replace(/\s+/g, ' ');
export const key = s => tidy(s).toLowerCase().replace(/[\s_-]/g, '');

function rude(name) {
  const lower = name.toLowerCase();
  const deleet = lower.replace(/[01345789@$!]/g, c => LEET[c]);
  const words = deleet.split(/[^a-z]+/).filter(Boolean);
  let joined = deleet.replace(/[^a-z]/g, '');
  for (const w of ALLOW) joined = joined.split(w).join('');
  const squashed = joined.replace(/(.)\1+/g, '$1'); // fuuuck -> fuck
  if (BLOCK_ANYWHERE.some(b => joined.includes(b) || squashed.includes(b))) return true;
  if (PATTERNS.some(p => p.test(joined) || p.test(squashed))) return true;
  const wordForms = [...words, ...words.map(w => w.replace(/(.)\1+/g, '$1')), joined];
  return BLOCK_WORD.some(b => wordForms.includes(b));
}

// Returns an error message, or null if the name is fine.
export function check(raw, existing = []) {
  const name = tidy(raw);
  if (name.length < MIN) return `Names need at least ${MIN} characters.`;
  if (name.length > MAX) return `Names can be up to ${MAX} characters.`;
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Use letters, numbers, spaces, _ or - only.';
  if (!/[A-Za-z]/.test(name)) return 'Names need at least one letter.';
  if (RESERVED.includes(key(name))) return 'That name is reserved. Pick another.';
  if (rude(name)) return "Let's keep names friendly. Try another.";
  if (existing.some(e => key(e) === key(name))) return 'You already play as that name on this computer. Tap it above.';
  return null;
}

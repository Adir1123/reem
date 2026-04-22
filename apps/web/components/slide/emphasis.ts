// Splits a string into tokens so that `emphasis` substrings can be styled
// separately. Each substring is matched once, case-sensitively, at its first
// occurrence from the left. Non-matching segments stay plain.

export type Token = { text: string; emphasized: boolean };

export function tokenizeEmphasis(source: string, emphasis: string[]): Token[] {
  if (!source) return [];
  const filtered = emphasis.filter((e) => e && source.includes(e));
  if (filtered.length === 0) return [{ text: source, emphasized: false }];

  let rest = source;
  const tokens: Token[] = [];
  while (rest.length > 0) {
    const hit = filtered
      .map((e) => ({ e, i: rest.indexOf(e) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0];
    if (!hit) {
      tokens.push({ text: rest, emphasized: false });
      break;
    }
    if (hit.i > 0) tokens.push({ text: rest.slice(0, hit.i), emphasized: false });
    tokens.push({ text: hit.e, emphasized: true });
    rest = rest.slice(hit.i + hit.e.length);
  }
  return tokens;
}

export function splitHeadline(
  headline: string,
  italic: string | null,
): Token[] {
  return tokenizeEmphasis(headline, italic ? [italic] : []);
}

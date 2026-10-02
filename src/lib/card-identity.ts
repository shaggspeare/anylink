const TINTS = ["#ff5a1f", "#7c8cff", "#d6f24b", "#9aa3ad", "#17181b", "#e0855a"];
const STRIPES = ["#ffffff", "#17181b", "#d6f24b"];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The stripe doubles as the initial's colour, so it can never match the tint — with 6
 * tints and 3 stripes, lime always drew lime and near-black always drew near-black.
 * Also repairs rows stored before that was fixed. */
export function legibleStripe(tint: string, stripe: string) {
  if (stripe !== tint) return stripe;
  return tint === "#17181b" ? "#ffffff" : "#17181b";
}

/** Deterministic card tint/stripe/initial for a domain — same domain always looks the same. */
export function identityForDomain(domain: string) {
  const h = hash(domain);
  const tint = TINTS[h % TINTS.length];
  return {
    tint,
    stripe: legibleStripe(tint, STRIPES[h % STRIPES.length]),
    initial: domain[0]?.toUpperCase() ?? "?",
  };
}

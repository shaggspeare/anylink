const TINTS = ["#ff5a1f", "#7c8cff", "#d6f24b", "#9aa3ad", "#17181b", "#e0855a"];
const STRIPES = ["#ffffff", "#17181b", "#d6f24b"];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic card tint/stripe/initial for a domain — same domain always looks the same. */
export function identityForDomain(domain: string) {
  const h = hash(domain);
  return {
    tint: TINTS[h % TINTS.length],
    stripe: STRIPES[h % STRIPES.length],
    initial: domain[0]?.toUpperCase() ?? "?",
  };
}

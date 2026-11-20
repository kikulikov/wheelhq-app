const PRODUCTION_DOMAIN = 'wheelhq.xyz';

export const PRODUCTION_HOSTS = new Set([PRODUCTION_DOMAIN, `www.${PRODUCTION_DOMAIN}`]);

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname);
}

/** Dataset origin for this app host; null means "use the bundled snapshots". */
export function datasetBaseUrl(hostname: string): string | null {
  if (isProductionHost(hostname)) return `https://datasets.${PRODUCTION_DOMAIN}`;
  const derived = hostname.replace('-app.', '-datasets.');
  return derived === hostname ? null : `https://${derived}`;
}

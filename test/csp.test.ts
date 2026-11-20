import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function cspFromVite(): string {
  const source = readFileSync('vite.config.ts', 'utf8');
  const match = /const csp =\s*\n?\s*"([^"]+)"/.exec(source);
  if (!match) throw new Error('vite CSP not found');
  return match[1];
}

function cspFromRender(): string {
  const source = readFileSync('render.yaml', 'utf8');
  const match = /value: "([^"]*default-src[^"]*)"/.exec(source);
  if (!match) throw new Error('render CSP not found');
  return match[1];
}

describe('Content-Security-Policy', () => {
  it('keeps the build and Render policies in sync', () => {
    const render = cspFromRender().replace("; frame-ancestors 'self'", '');
    expect(render).toBe(cspFromVite());
  });

  it('no longer allows the removed donation-widget hosts', () => {
    const csp = cspFromVite();
    expect(csp).not.toContain('buymeacoffee');
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
  });

  it('allows the GoatCounter pixel and no third-party script', () => {
    const csp = cspFromVite();
    expect(csp).toContain("img-src 'self' data: https://wheelhq.goatcounter.com");
    expect(csp).not.toContain('cloudflareinsights');
    const script = /(?:^|; )script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(script).toBe("'self'");
  });

  it('keeps unsafe-inline out of script-src', () => {
    const csp = cspFromVite();
    const style = /(?:^|; )style-src ([^;]+)/.exec(csp)?.[1] ?? '';
    const script = /(?:^|; )script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(style).toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it('drops the widget page and its path-specific policy', () => {
    const render = readFileSync('render.yaml', 'utf8');
    expect(render).not.toContain('/bmc.html');
    expect(render).toContain("frame-ancestors 'self'");
    expect(render).toMatch(/name: X-Frame-Options\n\s+value: SAMEORIGIN/);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync('index.html', 'utf8');
const app = readFileSync('src/App.svelte', 'utf8');
const about = readFileSync('static/about/index.html', 'utf8');
const donateUrl = 'https://buymeacoffee.com/wheelhq';

describe('donation link', () => {
  it('links to Buy Me a Coffee from the header with a visible text label', () => {
    expect(app).toContain(`href="${donateUrl}"`);
    expect(app).toContain('Buy me a coffee');
    expect(app).toMatch(/target="_blank"/);
    expect(app).toMatch(/rel="noopener noreferrer"/);
  });

  it('sits left of the status and key controls', () => {
    const linkAt = app.indexOf(donateUrl);
    const statusAt = app.indexOf('<DataStatus');
    const keyBadgeAt = app.indexOf('title={keyInfo.detail}');
    expect(linkAt).toBeGreaterThan(-1);
    expect(statusAt).toBeGreaterThan(-1);
    expect(keyBadgeAt).toBeGreaterThan(-1);
    expect(linkAt).toBeLessThan(statusAt);
    expect(statusAt).toBeLessThan(keyBadgeAt);
  });

  it('uses the standard Buy Me a Coffee yellow with dark text', () => {
    expect(app).toContain('bg-[#FFDD00]');
    expect(app).toContain('text-black');
  });

  it('removes the widget iframe, its page, and its top strip', () => {
    expect(index).not.toContain('bmc-strip');
    expect(index).not.toContain('<iframe');
    expect(about).not.toContain('/bmc.html');
    expect(about).not.toContain('<iframe');
    expect(existsSync('static/bmc.html')).toBe(false);
  });

  it('keeps the About-page QR code', () => {
    expect(existsSync('static/about/bmc-qr.png')).toBe(true);
    expect(about).toContain('/about/bmc-qr.png');
    expect(about).toMatch(/alt="[^"]*QR[^"]*"/i);
    expect(about).toContain(donateUrl);
  });
});

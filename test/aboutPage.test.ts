import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('static/about/index.html', 'utf8');

describe('About page', () => {
  it('offers a contact email in the page and footer', () => {
    expect(html).toContain('mailto:hello@wheelhq.xyz');
  });

  it('offers the Buy Me a Coffee page as a link and a QR code, without an iframe', () => {
    expect(html).not.toContain('/bmc.html');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('https://buymeacoffee.com/wheelhq');
    expect(html).toContain('/about/bmc-qr.png');
    expect(html).toMatch(/alt="[^"]*QR[^"]*"/i);
  });

  it('explains the no-account, browser-only model', () => {
    expect(html).toContain('No account');
    expect(html).toContain('profile');
    expect(html).toContain('Alpaca');
  });

  it('documents the Alpaca key workflow', () => {
    expect(html).toContain('Your Alpaca key');
    expect(html).toContain('session-only');
    expect(html).toContain('Keep this key on this device');
    expect(html).toContain('never');
  });

  it('does not mention internal dataset plumbing', () => {
    expect(html).not.toMatch(
      /dataset|bundled snapshot|wheelhq-datasets|indexes\.json|earnings\.json/i,
    );
  });
});

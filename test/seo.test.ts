import { describe, expect, it, vi } from 'vitest';
import { applyRobotsPolicy } from '../src/lib/seo';

function fakeDocument() {
  const setAttribute = vi.fn();
  return {
    document: { querySelector: () => ({ setAttribute }) } as unknown as Document,
    setAttribute,
  };
}

describe('applyRobotsPolicy', () => {
  it('leaves the production hosts indexable', () => {
    const { document, setAttribute } = fakeDocument();
    applyRobotsPolicy('wheelhq.xyz', document);
    applyRobotsPolicy('www.wheelhq.xyz', document);
    expect(setAttribute).not.toHaveBeenCalled();
  });

  it('marks dev and local hosts noindex', () => {
    for (const hostname of ['wheelhq-app.onrender.com', 'localhost', '127.0.0.1']) {
      const { document, setAttribute } = fakeDocument();
      applyRobotsPolicy(hostname, document);
      expect(setAttribute).toHaveBeenCalledWith('content', 'noindex,nofollow');
    }
  });
});

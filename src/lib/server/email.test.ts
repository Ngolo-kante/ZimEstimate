import { describe, expect, it } from 'vitest';
import { escapeHtml } from './email';

/**
 * Support tickets are written by anonymous strangers and rendered into an HTML
 * email. Escaping is the only thing between that and markup injection into
 * whatever mail client opens it, so it gets a test rather than a code review.
 */
describe('escapeHtml', () => {
  it('neutralises tags', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes quotes so text cannot break out of an attribute', () => {
    expect(escapeHtml(`" onmouseover="evil()`)).toBe('&quot; onmouseover=&quot;evil()');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    // &lt; must survive as literal text, not turn back into a working "<".
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;');
  });

  it('leaves ordinary message text alone', () => {
    const message = 'Face brick shows $0.22 each — is that right for 1,000?';
    expect(escapeHtml(message)).toBe(message);
  });
});

/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import indexHtml from '../index.html?raw';

// NOTE: readFileSync('index.html') ではなく ?raw を使う理由:
// このリポジトリには @types/node が無く、 brief 例示の node:fs import では
// `npx tsc -b` が TS2307 で失敗するため。Vite ネイティブの ?raw で同一内容を検証する。
const CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" />`;
const REFERRER_META = '<meta name="referrer" content="no-referrer" />';

describe('security headers (index.html meta)', () => {
  test('has referrer no-referrer meta', () => {
    expect(indexHtml).toContain(REFERRER_META);
  });

  test('has CSP meta with exact policy', () => {
    expect(indexHtml).toContain(CSP_META);
  });

  test('meta tags come after charset/viewport', () => {
    const viewportPos = indexHtml.indexOf('<meta name="viewport"');
    expect(viewportPos).toBeGreaterThanOrEqual(0);
    expect(indexHtml.indexOf(REFERRER_META)).toBeGreaterThan(viewportPos);
    expect(indexHtml.indexOf(CSP_META)).toBeGreaterThan(viewportPos);
  });
});

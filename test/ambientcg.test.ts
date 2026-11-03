/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import toolSrc from '../.opencode/tools/ambientcg.ts?raw';
import polySrc from '../.opencode/tools/polyhaven.ts?raw';

// NOTE: node:fs を使わない理由は security-headers.test.ts と同じ:
// このリポジトリには @types/node が無く、node:fs import では
// `npm run build` の tsc -b が TS2307 で失敗するため。Vite ネイティブの ?raw で検証する。

function readTool(): string {
  return toolSrc as unknown as string;
}

describe('ambientcg tools (TDD RED)', () => {
  test('tool file exists and exports search/get_files/download', () => {
    const src = readTool();
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toMatch(/export const search/);
    expect(src).toMatch(/export const get_files/);
    expect(src).toMatch(/export const download/);
  });

  test('uses API v3 only, no API key for public search', () => {
    const src = readTool();
    expect(src).toContain('ambientcg.com/api/v3');
    expect(src).toContain('/assets');
    expect(src).not.toContain('/api/v2/');
    // Authorization header must not be required (no Bearer token for public)
    expect(src).not.toMatch(/Authorization.*Bearer.*<token>/);
  });

  test('Japanese to English translation covers required terms', () => {
    const src = readTool();
    for (const jp of ['草原', '草', '土', '岩', '雪', '砂', '砂漠', '木材', '石畳', 'コンクリート']) {
      expect(src).toContain(jp);
    }
    // verify real mappings exist
    expect(src).toMatch(/草原.*grass|grass.*草原/);
    expect(src).toMatch(/木材.*wood/);
  });

  test('search result shows required fields', () => {
    const src = readTool();
    for (const field of ['素材名', '素材ID', '素材の種類', 'タグ', 'プレビュー', '公式ページ', '解像度', '形式']) {
      expect(src).toContain(field);
    }
  });

  test('download saves to artifacts/ambientcg and has safety guards', () => {
    const src = readTool();
    expect(src).toContain('artifacts/ambientcg');
    expect(src).toMatch(/上書き禁止|既存ファイル/);
    expect(src).toMatch(/パストラバーサル|許可範囲外|\.\./);
    expect(src).toMatch(/https.*のみ許可|https:/);
    // ZIP handling
    expect(src).toMatch(/zip/i);
  });

  test('manifest.json has required distinct fields', () => {
    const src = readTool();
    for (const f of ['assetId', 'assetName', 'assetType', 'source', 'originalUrl', 'license', 'resolution', 'fileFormat', 'downloadedFiles', 'downloadDate']) {
      expect(src).toContain(f);
    }
    expect(src).toContain('CC0');
    expect(src).toContain('ambientcg.com');
  });

  test('recommends 1K or 2K, not 8K by default', () => {
    const src = readTool();
    expect(src).toMatch(/1K|2K/);
    // default selection prefers 1K and explicitly avoids 8K as default
    expect(src).toMatch(/1K.*優先|推奨.*1K|"1K"/);
    expect(src).toMatch(/8Kは標準で取得しない|8K.*標準.*取得しない/);
  });

  test('polyhaven.ts is untouched (coexistence)', () => {
    const src = polySrc as unknown as string;
    expect(src).toContain('api.polyhaven.com');
    expect(src).toMatch(/export const search/);
    expect(src).toMatch(/export const get_files/);
    expect(src).toMatch(/export const download/);
  });
});

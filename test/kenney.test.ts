/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import toolSrc from '../.opencode/tools/kenney.ts?raw';
import polySrc from '../.opencode/tools/polyhaven.ts?raw';
import acgSrc from '../.opencode/tools/ambientcg.ts?raw';

// NOTE: node:fs を使わない理由は ambientcg.test.ts と同じ:
// @types/node が無いため ?raw で検証する。

function readTool(): string {
  return toolSrc as unknown as string;
}

describe('kenney tools (TDD)', () => {
  test('tool file exists and exports search/get_files/download', () => {
    const src = readTool();
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toMatch(/export const search/);
    expect(src).toMatch(/export const get_files/);
    expect(src).toMatch(/export const download/);
  });

  test('does not invent an official API', () => {
    const src = readTool();
    expect(src).not.toMatch(/kenney\.nl\/api\//i);
    expect(src).not.toMatch(/api\.kenney\.nl/i);
  });

  test('Nature Kit is searchable with official URL and 330 assets', () => {
    const src = readTool();
    expect(src).toContain('nature-kit');
    expect(src).toContain('https://kenney.nl/assets/nature-kit');
    expect(src).toContain('330');
  });

  test('Japanese to English translation covers required terms', () => {
    const src = readTool();
    for (const jp of ['木', '岩', '植物', '柵', '草原', '森林', '建物']) {
      expect(src).toContain(jp);
    }
    expect(src).toContain('Nature Kit');
  });

  test('search result shows required fields and license', () => {
    const src = readTool();
    for (const field of ['素材名', '公式URL', 'カテゴリー', 'ライセンス', 'プレビュー', '素材数']) {
      expect(src).toContain(field);
    }
    expect(src).toContain('CC0');
    expect(src).toContain('kenney.nl');
  });

  test('get_files distinguishes pre/post acquisition and inspects real formats', () => {
    const src = readTool();
    expect(src).toMatch(/取得前|公式情報/);
    expect(src).toMatch(/取得後|実測|実際/);
    for (const fmt of ['GLB', 'FBX', 'OBJ', 'BLEND']) {
      expect(src).toContain(fmt);
    }
    expect(src).toMatch(/ライセンス|README/i);
  });

  test('download saves to artifacts/kenney with safety guards and manual intake', () => {
    const src = readTool();
    expect(src).toContain('artifacts/kenney');
    expect(src).toMatch(/上書き禁止|既存ファイル/);
    expect(src).toMatch(/パストラバーサル|許可範囲外/);
    expect(src).toMatch(/https.*のみ許可|https:/);
    expect(src).toMatch(/手動|inbox/i);
    expect(src).toMatch(/zip/i);
  });

  test('manifest.json has Kenney-distinct required fields including SHA-256', () => {
    const src = readTool();
    for (const f of ['assetId', 'assetName', 'assetSlug', 'source', 'originalUrl', 'license', 'licenseUrl', 'assetCount', 'downloadedFiles', 'fileFormats', 'downloadDate', 'archiveName', 'archiveSize']) {
      expect(src).toContain(f);
    }
    expect(src).toContain('Kenney');
    expect(src).toMatch(/SHA-256|sha256/i);
    expect(src).toContain('CC0');
  });

  test('existing tools are untouched (coexistence)', () => {
    const poly = polySrc as unknown as string;
    expect(poly).toContain('api.polyhaven.com');
    expect(poly).toMatch(/export const search/);
    const acg = acgSrc as unknown as string;
    expect(acg).toContain('ambientcg.com/api/v3');
    expect(acg).toMatch(/export const download/);
  });
});

/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import indexRaw from '../artifacts/index.json?raw';
import guideRaw from '../artifacts/ASSETS.md?raw';

// NOTE: node:fs を使わない理由は ambientcg.test.ts / kenney.test.ts と同じ:
// @types/node が無いため ?raw で検証する。

type IndexAsset = {
  id: string;
  path: string;
  license: string;
  formats: string[];
  tags: string[];
};

type AssetIndex = {
  version: number;
  sites: Record<string, { tool: string; assets: IndexAsset[] }>;
};

function readIndex(): AssetIndex {
  return JSON.parse(indexRaw as unknown as string) as AssetIndex;
}

describe('asset index (TDD)', () => {
  test('index.json parses with unified schema for all three sites', () => {
    const idx = readIndex();
    expect(idx.version).toBe(1);
    for (const site of ['polyhaven', 'ambientcg', 'kenney']) {
      expect(idx.sites[site]).toBeDefined();
      for (const a of idx.sites[site].assets) {
        expect(a.id.length).toBeGreaterThan(0);
        expect(a.path.length).toBeGreaterThan(0);
        expect(a.license).toBe('CC0');
        expect(a.formats.length).toBeGreaterThan(0);
        expect(a.tags.length).toBeGreaterThan(0);
      }
    }
  });

  test('existing stock is indexed with correct paths', () => {
    const idx = readIndex();
    const all = Object.values(idx.sites).flatMap((s) => s.assets);
    const byId = new Map(all.map((a) => [a.id, a]));
    expect(byId.get('brown_planks_03')?.path).toContain('artifacts/polyhaven');
    expect(byId.get('Grass005')?.path).toContain('artifacts/ambientcg');
    expect(byId.get('nature-kit')?.path).toContain('artifacts/kenney');
    expect(byId.get('nature-kit')?.formats).toContain('.glb');
  });

  test('ASSETS.md documents stock, selection flow and automation status', () => {
    const md = guideRaw as unknown as string;
    expect(md.length).toBeGreaterThan(500);
    for (const section of ['在庫', '使い分け', '既存優先', '自動化']) {
      expect(md).toContain(section);
    }
    expect(md).toContain('artifacts/index.json');
  });
});

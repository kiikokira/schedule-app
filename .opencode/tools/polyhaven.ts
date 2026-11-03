import { tool } from "@opencode-ai/plugin";
import path from "node:path";
import { mkdir, writeFile, stat } from "node:fs/promises";

const API_BASE = "https://api.polyhaven.com";
const UA =
  "schedule-app-polyhaven/0.1.0 (+https://kiikokira.github.io/schedule-app/)";
const ALLOWED_HOSTS = new Set([
  "dl.polyhaven.org",
  "api.polyhaven.com",
  "cdn.polyhaven.com",
  "polyhaven.com",
]);
const SAVE_ROOT = "artifacts/polyhaven";
const CREDIT = "Powered by Poly Haven (https://polyhaven.com/)";

const JP_DICT: Record<string, string> = {
  レンガ: "brick",
  れんが: "brick",
  木: "wood",
  木材: "wood",
  板: "planks",
  草原: "grass",
  草: "grass",
  芝: "grass",
  空: "sky",
  雲: "cloud",
  岩: "rock",
  石: "stone",
  砂: "sand",
  海: "ocean",
  水: "water",
  金属: "metal",
  布: "fabric",
  壁: "wall",
  床: "floor",
  森: "forest",
  山: "mountain",
  雪: "snow",
  夜: "night",
  車: "car",
  椅子: "chair",
  テーブル: "table",
  建物: "building",
  家: "house",
  テクスチャ: "texture",
  モデル: "model",
  背景: "background",
};

function translateQuery(q: string): string[] {
  const out = new Set<string>([q]);
  for (const [jp, en] of Object.entries(JP_DICT)) {
    if (q.includes(jp)) {
      out.add(
        q.replaceAll(jp, ` ${en} `).trim().replace(/\s+/g, " "),
      );
      out.add(en);
    }
  }
  return [...out].slice(0, 3);
}

async function phFetch(p: string, attempt = 0): Promise<Response> {
  const res = await fetch(`${API_BASE}${p}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return phFetch(p, attempt + 1);
  }
  return res;
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9_]+$/.test(slug)) {
    throw new Error(`不正なslugです: ${slug}`);
  }
}

function assertAllowedUrl(u: string): void {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    throw new Error(`不正なURLです: ${u}`);
  }
  if (url.protocol !== "https:") throw new Error(`httpsのみ許可: ${u}`);
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`許可外ドメイン: ${url.hostname}`);
  }
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

type InfoJson = {
  name?: string;
  categories?: string[];
  category?: string;
  thumbnail_url?: string;
  description?: string;
  type?: number | string;
  tags?: string[];
};

async function fetchInfo(slug: string): Promise<InfoJson> {
  assertSlug(slug);
  const res = await phFetch(`/info/${slug}`);
  if (!res.ok) throw new Error(`info取得失敗 ${slug}: HTTP ${res.status}`);
  return (await res.json()) as InfoJson;
}

function typeLabel(t: unknown, fallback: string): string {
  if (typeof t === "string") return t;
  if (t === 0) return "hdris";
  if (t === 1) return "textures";
  if (t === 2) return "models";
  return fallback;
}

export const search = tool({
  description:
    "Poly Havenの素材を検索する（日本語可）。CC0。出典: Powered by Poly Haven (https://polyhaven.com/)",
  args: {
    query: tool.schema
      .string()
      .describe("検索語（日本語可、例: レンガ、草原、wood）"),
    type: tool.schema
      .enum(["hdris", "textures", "models", "all"])
      .default("all")
      .describe("素材種別"),
    limit: tool.schema
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("最大件数"),
  },
  async execute(args) {
    const queries = translateQuery(args.query.trim());
    const seen = new Set<string>();
    const slugs: string[] = [];
    for (const q of queries) {
      const params = new URLSearchParams({ q });
      if (args.type !== "all") params.set("t", args.type);
      const res = await phFetch(`/search?${params.toString()}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: { slug: string }[];
      };
      for (const r of data.results ?? []) {
        if (!seen.has(r.slug)) {
          seen.add(r.slug);
          slugs.push(r.slug);
        }
        if (slugs.length >= args.limit * 2) break;
      }
      if (slugs.length >= args.limit) break;
    }
    const top = slugs.slice(0, args.limit);
    const items: string[] = [];
    for (let i = 0; i < top.length; i += 4) {
      const chunk = top.slice(i, i + 4);
      const infos = await Promise.all(
        chunk.map(async (slug) => {
          try {
            return { slug, info: await fetchInfo(slug) };
          } catch {
            return { slug, info: null as InfoJson | null };
          }
        }),
      );
      for (const { slug, info } of infos) {
        const name = info?.name ?? slug;
        const cats =
          info?.categories?.join(", ") ?? info?.category ?? "";
        items.push(
          [
            `■ ${name}`,
            `  slug/id: ${slug}`,
            `  type: ${typeLabel(info?.type, args.type === "all" ? "unknown" : args.type)}`,
            `  thumbnail: ${info?.thumbnail_url ?? "-"}`,
            `  page: https://polyhaven.com/a/${slug}`,
            `  categories: ${cats || "-"}`,
            `  description: ${info?.description ?? "-"}`,
            `  license: CC0 (https://polyhaven.com/license)`,
          ].join("\n"),
        );
      }
    }
    if (items.length === 0)
      return `見つかりませんでした: ${args.query}（英語でも試してください）\n${CREDIT}`;
    return `${items.join("\n\n")}\n\n${CREDIT} — 素材は全てCC0`;
  },
});

type FileEntry = {
  map: string;
  resolution: string;
  format: string;
  size: number;
  url: string;
  md5?: string;
};

function flattenFiles(filesJson: Record<string, unknown>): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (
    map: string,
    node: unknown,
    resolution = "",
    format = "",
  ): void => {
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (
      typeof rec["url"] === "string" &&
      typeof rec["size"] === "number"
    ) {
      out.push({
        map,
        resolution: resolution || "-",
        format: format || "-",
        size: rec["size"] as number,
        url: rec["url"] as string,
        md5:
          typeof rec["md5"] === "string"
            ? (rec["md5"] as string)
            : undefined,
      });
      const inc = rec["include"] as
        | Record<string, { size: number; url: string }>
        | undefined;
      if (inc) {
        for (const [k, v] of Object.entries(inc)) {
          out.push({
            map: `${map} (related: ${k})`,
            resolution: resolution || "-",
            format: "related",
            size: v.size,
            url: v.url,
          });
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === "include") continue;
      if (!resolution) walk(map, v, k, format);
      else if (!format || format === "-") walk(map, v, resolution, k);
      else walk(map, v, resolution, format);
    }
  };
  for (const [map, node] of Object.entries(filesJson)) walk(map, node);
  return out;
}

function pickPriority(a: FileEntry, b: FileEntry): number {
  const score = (e: FileEntry): number => {
    let s = 0;
    if (e.map === "blend") s += 100;
    else if (e.map === "gltf") s += 90;
    if (e.format === "blend" || e.format === "gltf") s += 10;
    if (e.format === "jpg") s += 5;
    const m = e.resolution.match(/(\d+)k/i);
    if (m) s += parseInt(m[1], 10);
    return s;
  };
  return score(b) - score(a);
}

export const get_files = tool({
  description:
    "指定slugのダウンロード可能ファイル（形式・解像度・容量・URL・関連ファイル）を確認する",
  args: {
    slug: tool.schema.string().describe("素材slug（例: brown_planks_03）"),
  },
  async execute(args) {
    assertSlug(args.slug);
    const [info, fres] = await Promise.all([
      fetchInfo(args.slug),
      phFetch(`/files/${args.slug}`),
    ]);
    if (!fres.ok) throw new Error(`files取得失敗: HTTP ${fres.status}`);
    const filesJson = (await fres.json()) as Record<string, unknown>;
    const entries = flattenFiles(filesJson).sort(pickPriority);
    const total = entries.reduce((n, e) => n + e.size, 0);
    const lines = entries
      .slice(0, 40)
      .map(
        (e) =>
          `  - [${e.map}] ${e.resolution} / ${e.format} : ${fmtMB(e.size)} (${e.size} bytes)\n    ${e.url}`,
      );
    return [
      `■ ${info.name ?? args.slug} (${args.slug})`,
      `page: https://polyhaven.com/a/${args.slug}`,
      `license: CC0`,
      `files (${entries.length}件, 合計 ${fmtMB(total)}):`,
      ...lines,
      entries.length > 40 ? `  ...他 ${entries.length - 40}件` : "",
      `推奨: ${entries[0] ? `[${entries[0].map}] ${entries[0].resolution}/${entries[0].format} ${fmtMB(entries[0].size)}` : "-"}`,
      `※ ダウンロード前に容量・形式を確認し、polyhaven_downloadで単品取得してください。`,
      CREDIT,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const download = tool({
  description:
    "選択したPoly Haven素材1件をartifacts/polyhaven/にダウンロードする（単品のみ・上書き禁止・関連ファイル込み）。他セクションからは manifest.json の相対パスで参照可能",
  args: {
    slug: tool.schema
      .string()
      .describe(
        "素材slug（例: brown_planks_03）。必ず先にpolyhaven_search/get_filesで確認",
      ),
    resolution: tool.schema
      .string()
      .optional()
      .describe("解像度（例: 1k, 2k, 4k）。省略時は.blend最小解像度"),
    format: tool.schema
      .string()
      .optional()
      .describe("形式（例: blend, gltf, jpg, png, exr）。省略時はblend優先"),
    includeRelated: tool.schema
      .boolean()
      .default(true)
      .describe("関連テクスチャも取得するか"),
  },
  async execute(args, context) {
    assertSlug(args.slug);
    const root = (context?.worktree ??
      context?.directory ??
      process.cwd()) as string;
    const fres = await phFetch(`/files/${args.slug}`);
    if (!fres.ok) throw new Error(`files取得失敗: HTTP ${fres.status}`);
    const filesJson = (await fres.json()) as Record<string, unknown>;
    let entries = flattenFiles(filesJson).filter(
      (e) => e.format !== "related",
    );
    if (entries.length === 0)
      throw new Error("ダウンロード可能ファイルがありません");
    if (args.format) {
      const want = args.format.toLowerCase();
      const hit = entries.filter(
        (e) =>
          e.map.toLowerCase() === want || e.format.toLowerCase() === want,
      );
      if (hit.length === 0)
        throw new Error(
          `形式 ${args.format} が見つかりません。先にpolyhaven_get_filesで確認してください`,
        );
      entries = hit;
    }
    if (args.resolution) {
      const want = args.resolution.toLowerCase();
      const hit = entries.filter(
        (e) => e.resolution.toLowerCase() === want,
      );
      if (hit.length === 0)
        throw new Error(`解像度 ${args.resolution} が見つかりません`);
      entries = hit;
    }
    if (!args.format && !args.resolution) {
      const sorted = [...entries].sort((a, b) => {
        const prio = (m: string): number =>
          m === "blend" ? 0 : m === "gltf" ? 1 : 2;
        return prio(a.map) - prio(b.map) || a.size - b.size;
      });
      const main = sorted[0];
      entries = entries.filter(
        (e) => e.map === main.map && e.resolution === main.resolution,
      );
    }
    const info = await fetchInfo(args.slug).catch(() => null);
    const dir = path.join(root, SAVE_ROOT, args.slug);
    await mkdir(dir, { recursive: true });
    const jobs: FileEntry[] = [];
    for (const main of entries) {
      jobs.push(main);
      if (args.includeRelated) {
        const all = flattenFiles(filesJson).filter(
          (e) =>
            e.map.startsWith(`${main.map} (related`) &&
            e.resolution === main.resolution,
        );
        jobs.push(...all);
      }
    }
    const uniq = [...new Map(jobs.map((j) => [j.url, j])).values()];
    if (uniq.length === 0) throw new Error("対象ファイルがありません");
    let totalBytes = 0;
    const saved: string[] = [];
    for (const j of uniq) {
      assertAllowedUrl(j.url);
      const fname = path.basename(new URL(j.url).pathname);
      if (!fname || fname.includes(".."))
        throw new Error(`不正なファイル名: ${fname}`);
      const dest = path.join(dir, fname);
      const resolved = path.resolve(dest);
      if (!resolved.startsWith(path.resolve(dir))) {
        throw new Error("保存先が許可範囲外です");
      }
      try {
        await stat(dest);
        throw new Error(
          `既存ファイルのためスキップ（上書き禁止）: ${fname}。削除してから再実行してください`,
        );
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          e.message.startsWith("既存ファイル")
        )
          throw e;
      }
      const dl = await fetch(j.url, { headers: { "User-Agent": UA } });
      if (!dl.ok || !dl.body)
        throw new Error(`ダウンロード失敗 ${fname}: HTTP ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      totalBytes += buf.length;
      await writeFile(dest, buf);
      saved.push(fname);
    }
    const manifest = {
      id: args.slug,
      name: info?.name ?? args.slug,
      page: `https://polyhaven.com/a/${args.slug}`,
      license: "CC0",
      license_url: "https://polyhaven.com/license",
      credit: CREDIT,
      files: saved,
      total_bytes: totalBytes,
      downloaded_at: new Date().toISOString(),
    };
    await writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    const rel = path.relative(root, dir) || dir;
    return [
      `ダウンロード完了: ${saved.length}件 → ${rel}`,
      ...saved.map((f) => `- ${f}`),
      `合計 ${fmtMB(totalBytes)}`,
      `manifest: ${rel}/manifest.json（他セクションからはこの相対パスで参照）`,
      `manifest.jsonにID・名称・ページ・CC0を記録しました。`,
      CREDIT,
    ].join("\n");
  },
});

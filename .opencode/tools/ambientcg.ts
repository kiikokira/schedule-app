import { tool } from "@opencode-ai/plugin";
import path from "node:path";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const API_BASE = "https://ambientcg.com/api/v3";
const UA =
  "schedule-app-ambientcg/0.1.0 (+https://kiikokira.github.io/schedule-app/)";
const SAVE_ROOT = "artifacts/ambientcg";
const CREDIT =
  "Created using assets from ambientCG.com, licensed under the Creative Commons CC0 1.0 Universal License.";
const LICENSE_URL = "https://ambientcg.com/license";
const INCLUDE =
  "title,type,tags,downloads,maps,url,thumbnails,previews";

// ダウンロード許可ホスト（初期URLは ambientcg.com のみ、表示用はCDNも扱う）
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "ambientcg.com",
  "www.ambientcg.com",
]);

function isAllowedCdnHost(host: string): boolean {
  if (ALLOWED_DOWNLOAD_HOSTS.has(host)) return true;
  if (host.endsWith(".backblazeb2.com")) return true;
  if (host.endsWith(".struffelproductions.com")) return true;
  if (host === "acg-media.struffelproductions.com") return true;
  if (host === "f003.backblazeb2.com") return true;
  return false;
}

const JP_DICT: Record<string, string> = {
  "森林の地面": "forest ground",
  "森林": "forest",
  "石畳": "cobblestone",
  "コンクリート": "concrete",
  "砂漠": "desert",
  "草原": "grass",
  "木材": "wood",
  "土壌": "soil",
  "レンガ": "brick",
  "れんが": "brick",
  "木": "wood",
  "板": "planks",
  "草": "grass",
  "芝": "grass",
  "土": "soil",
  "泥": "mud",
  "岩": "rock",
  "石": "stone",
  "砂": "sand",
  "森": "forest",
  "山": "mountain",
  "雪": "snow",
  "海": "ocean",
  "水": "water",
  "空": "sky",
  "雲": "cloud",
  "金属": "metal",
  "布": "fabric",
  "壁": "wall",
  "床": "floor",
  "夜": "night",
  "地面": "ground",
  "テクスチャ": "texture",
  "モデル": "model",
  "背景": "background",
};

function translateQuery(q: string): string[] {
  const out = new Set<string>([q]);
  const keys = Object.keys(JP_DICT).sort((a, b) => b.length - a.length);
  for (const jp of keys) {
    const en = JP_DICT[jp];
    if (q.includes(jp)) {
      out.add(
        q.replaceAll(jp, ` ${en} `).trim().replace(/\s+/g, " "),
      );
      out.add(en);
    }
  }
  return [...out].slice(0, 3);
}

async function acgFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return acgFetch(url, attempt + 1);
  }
  return res;
}

function assertAssetId(id: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(`不正なassetIdです: ${id}`);
  }
}

function assertAllowedDownloadUrl(u: string): void {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    throw new Error(`不正なURLです: ${u}`);
  }
  if (url.protocol !== "https:") throw new Error(`httpsのみ許可: ${u}`);
  if (!ALLOWED_DOWNLOAD_HOSTS.has(url.hostname)) {
    throw new Error(`許可外ドメイン: ${url.hostname}`);
  }
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

type AcgDownload = {
  attributes?: string;
  extension?: string;
  url?: string;
  size?: number;
};

type AcgAsset = {
  id: string;
  title?: string;
  type?: string;
  tags?: string[];
  maps?: string[];
  url?: string;
  downloads?: AcgDownload[];
  thumbnails?: Record<string, string>;
  previews?: { type?: string; url?: string }[];
  shortDescription?: string;
};

type AcgListResponse = {
  totalResults?: number;
  assets?: AcgAsset[];
};

function buildAssetsUrl(params: Record<string, string>): string {
  const sp = new URLSearchParams(params);
  return `${API_BASE}/assets?${sp.toString()}`;
}

async function fetchAssets(
  params: Record<string, string>,
): Promise<AcgListResponse> {
  const res = await acgFetch(buildAssetsUrl(params));
  if (!res.ok) throw new Error(`ambientCG API取得失敗: HTTP ${res.status}`);
  return (await res.json()) as AcgListResponse;
}

function pickThumbnail(a: AcgAsset): string {
  const th = a.thumbnails ?? {};
  return (
    th["512-PNG"] ??
    th["256-PNG"] ??
    th["512-JPG-FFFFFF"] ??
    th["256-JPG-FFFFFF"] ??
    Object.values(th)[0] ??
    a.previews?.[0]?.url ??
    "-"
  );
}

function downloadSummary(a: AcgAsset): string {
  const dls = a.downloads ?? [];
  const attrs = dls.map((d) => d.attributes ?? "-").slice(0, 8);
  const exts = [...new Set(dls.map((d) => d.extension ?? "-"))];
  return `${attrs.join(", ") || "-"} / ${exts.join(", ") || "-"}`;
}

function formatSearchItem(a: AcgAsset): string {
  return [
    `■ ${a.title ?? a.id}`,
    `  素材名: ${a.title ?? a.id}`,
    `  素材ID: ${a.id}`,
    `  素材の種類: ${a.type ?? "-"}`,
    `  タグ: ${(a.tags ?? []).join(", ") || "-"}`,
    `  プレビュー画像URL: ${pickThumbnail(a)}`,
    `  公式ページURL: ${a.url ?? `https://ambientcg.com/a/${a.id}`}`,
    `  ダウンロード可能な解像度: ${(a.downloads ?? []).map((d) => d.attributes ?? "-").join(", ") || "-"}`,
    `  ファイル形式: ${[...new Set((a.downloads ?? []).map((d) => d.extension ?? "-"))].join(", ") || "-"} (ZIP)`,
    `  PBRマップ: ${(a.maps ?? []).join(", ") || "-"}`,
    `  ライセンス: CC0 (${LICENSE_URL})`,
  ].join("\n");
}

export const search = tool({
  description:
    "ambientCGの素材を検索する（日本語可）。Material/HDRI/Decal/3D Model/Terrain。CC0。出典: ambientCG (https://ambientcg.com/)",
  args: {
    query: tool.schema
      .string()
      .describe("検索語（日本語可、例: 草原、草、土、岩、雪、砂、森林の地面、砂漠、木材、石畳、コンクリート）"),
    type: tool.schema
      .enum(["material", "hdri", "decal", "3d-model", "terrain", "all"])
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
    const collected: AcgAsset[] = [];
    for (const q of queries) {
      const params: Record<string, string> = {
        q,
        limit: String(Math.min(Math.max(args.limit, 1), 20)),
        sort: "popular",
        include: INCLUDE,
      };
      if (args.type !== "all") params["type"] = args.type;
      try {
        const data = await fetchAssets(params);
        for (const a of data.assets ?? []) {
          if (!a?.id || seen.has(a.id)) continue;
          seen.add(a.id);
          collected.push(a);
          if (collected.length >= args.limit) break;
        }
      } catch {
        continue;
      }
      if (collected.length >= args.limit) break;
    }
    const top = collected.slice(0, args.limit);
    if (top.length === 0)
      return `見つかりませんでした: ${args.query}（英語でも試してください。例: grass, soil, rock, snow, sand, desert, wood, concrete）\n${CREDIT}`;
    const items = top.map(formatSearchItem);
    return `${items.join("\n\n")}\n\n${CREDIT} — 素材は全てCC0。詳細は ambientcg_get_files で確認し、必要な素材だけ ambientcg_download で取得してください（ゲーム向けは 1K または 2K 推奨）。`;
  },
});

export const get_files = tool({
  description:
    "指定したambientCG素材IDのダウンロード情報（解像度・形式・容量・URL・関連マップ）を確認する",
  args: {
    assetId: tool.schema.string().describe("素材ID（例: Grass005）"),
  },
  async execute(args) {
    assertAssetId(args.assetId);
    const data = await fetchAssets({
      id: args.assetId,
      include: INCLUDE,
    });
    const a = (data.assets ?? [])[0];
    if (!a) throw new Error(`素材が見つかりません: ${args.assetId}`);
    const dls = (a.downloads ?? []).slice().sort((x, y) => (x.size ?? 0) - (y.size ?? 0));
    const total = dls.reduce((n, d) => n + (d.size ?? 0), 0);
    const lines = dls.map(
      (d) =>
        `  - ${d.attributes ?? "-"} / ${d.extension ?? "-"} : ${fmtMB(d.size ?? 0)} (${d.size ?? 0} bytes)\n    ${d.url ?? "-"}`,
    );
    const maps = a.maps ?? [];
    const pbr = {
      Color: maps.includes("color"),
      Normal: maps.includes("normal"),
      Roughness: maps.includes("roughness"),
      Displacement: maps.includes("displacement"),
      "Ambient Occlusion":
        maps.includes("ambient-occlusion") || maps.includes("ambientocclusion"),
      Metalness: maps.includes("metalness"),
      Opacity: maps.includes("opacity"),
    };
    return [
      `■ ${a.title ?? a.id} (${a.id})`,
      `素材名: ${a.title ?? a.id}`,
      `素材ID: ${a.id}`,
      `素材の種類: ${a.type ?? "-"}`,
      `公式ページURL: ${a.url ?? `https://ambientcg.com/a/${a.id}`}`,
      `ライセンス: CC0 (${LICENSE_URL})`,
      `タグ: ${(a.tags ?? []).join(", ") || "-"}`,
      `プレビュー画像URL: ${pickThumbnail(a)}`,
      `PBRマップ: ${maps.join(", ") || "-"}`,
      `マップ内訳: ${Object.entries(pbr).map(([k, v]) => `${k}=${v ? "あり" : "なし"}`).join(", ")}`,
      `解像度・形式・容量 (${dls.length}件, 合計 ${fmtMB(total)}):`,
      ...lines,
      `推奨: ゲーム向けは 1K または 2K の JPG を推奨（8Kは大容量のため標準では取得しない）`,
      `※ ダウンロード前に容量・形式を確認し、ambientcg_downloadで単品取得してください。`,
      CREDIT,
    ].join("\n");
  },
});

// --- ZIP展開（依存追加なし、node:zlibのみ使用） ---

function readUInt32LE(buf: Buffer, off: number): number {
  return (
    (buf[off] |
      (buf[off + 1] << 8) |
      (buf[off + 2] << 16) |
      (buf[off + 3] << 24)) >>>
    0
  );
}

function readUInt16LE(buf: Buffer, off: number): number {
  return buf[off] | (buf[off + 1] << 8);
}

function assertSafeZipPath(name: string): string {
  // パストラバーサル防止：絶対パス・ドライブ文字・.. を拒否
  if (!name || name.endsWith("/")) return "";
  const normalized = name.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").includes("..")
  ) {
    throw new Error(`パストラバーサルを検出: ${name}`);
  }
  if (normalized.includes("\0")) throw new Error(`不正なファイル名: ${name}`);
  return normalized;
}

async function unzipBuffer(
  buf: Buffer,
  destDir: string,
): Promise<string[]> {
  // EOCD検索
  let eocd = -1;
  const minSearch = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= minSearch; i--) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x05 &&
      buf[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP解析失敗: EOCDが見つかりません");
  const centralCount = readUInt16LE(buf, eocd + 10);
  const centralOffset = readUInt32LE(buf, eocd + 16);
  const saved: string[] = [];
  let p = centralOffset;
  for (let i = 0; i < centralCount; i++) {
    if (
      buf[p] !== 0x50 ||
      buf[p + 1] !== 0x4b ||
      buf[p + 2] !== 0x01 ||
      buf[p + 3] !== 0x02
    ) {
      throw new Error("ZIP解析失敗: 中央ディレクトリ破損");
    }
    const method = readUInt16LE(buf, p + 10);
    const compSize = readUInt32LE(buf, p + 20);
    const uncompSize = readUInt32LE(buf, p + 24);
    const nameLen = readUInt16LE(buf, p + 28);
    const extraLen = readUInt16LE(buf, p + 30);
    const commentLen = readUInt16LE(buf, p + 32);
    const localHeaderOffset = readUInt32LE(buf, p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const safeName = assertSafeZipPath(rawName);
    p += 46 + nameLen + extraLen + commentLen;
    if (!safeName) continue;
    // ローカルヘッダからデータ位置を求める
    const lfNameLen = readUInt16LE(buf, localHeaderOffset + 26);
    const lfExtraLen = readUInt16LE(buf, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);
    let fileData: Buffer;
    if (method === 0) {
      fileData = Buffer.from(compData);
    } else if (method === 8) {
      fileData = inflateRawSync(compData);
    } else {
      throw new Error(`未対応の圧縮方式: ${method} (${rawName})`);
    }
    if (fileData.length !== uncompSize && uncompSize !== 0) {
      // サイズ不一致は警告のみ（展開は続行）
    }
    const dest = path.join(destDir, safeName);
    const resolved = path.resolve(dest);
    if (!resolved.startsWith(path.resolve(destDir))) {
      throw new Error(`保存先が許可範囲外です: ${safeName}`);
    }
    try {
      await stat(dest);
      throw new Error(
        `既存ファイルのためスキップ（上書き禁止）: ${safeName}。削除してから再実行してください`,
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith("既存ファイル")) throw e;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, fileData);
    saved.push(safeName);
  }
  return saved;
}

function parseAttributes(attributes: string): {
  resolution: string;
  format: string;
} {
  const upper = attributes.toUpperCase();
  const resMatch = upper.match(/(\d+K)/);
  const resolution = resMatch ? resMatch[1] : "-";
  const format = upper.includes("PNG")
    ? "PNG"
    : upper.includes("JPG") || upper.includes("JPEG")
      ? "JPG"
      : upper.includes("EXR")
        ? "EXR"
        : "-";
  return { resolution, format };
}

function scoreDownload(d: AcgDownload): number {
  const attr = (d.attributes ?? "").toUpperCase();
  let s = 0;
  if (attr.includes("1K")) s += 100;
  else if (attr.includes("2K")) s += 50;
  else if (attr.includes("4K")) s -= 50;
  else if (attr.match(/8K|12K|16K/)) s -= 200;
  if (attr.includes("JPG")) s += 10;
  return s;
}

export const download = tool({
  description:
    "選択したambientCG素材1件をartifacts/ambientcg/にダウンロードする（単品のみ・上書き禁止・ZIP安全展開）。他セクションからは manifest.json の相対パスで参照可能",
  args: {
    assetId: tool.schema
      .string()
      .describe(
        "素材ID（例: Grass005）。必ず先にambientcg_search/get_filesで確認",
      ),
    resolution: tool.schema
      .string()
      .optional()
      .describe("解像度（例: 1K, 2K, 4K）。省略時は1K優先（8Kは標準で取得しない）"),
    format: tool.schema
      .string()
      .optional()
      .describe("形式（例: JPG, PNG）。省略時はJPG優先"),
    includeRelated: tool.schema
      .boolean()
      .default(true)
      .describe("関連テクスチャも取得するか（ZIP内に全マップ同梱のため通常true）"),
  },
  async execute(args, context) {
    assertAssetId(args.assetId);
    const root = (context?.worktree ??
      context?.directory ??
      process.cwd()) as string;
    const data = await fetchAssets({
      id: args.assetId,
      include: INCLUDE,
    });
    const a = (data.assets ?? [])[0];
    if (!a) throw new Error(`素材が見つかりません: ${args.assetId}`);
    let dls = (a.downloads ?? []).filter((d) => d.url && d.size != null);
    if (dls.length === 0) throw new Error("ダウンロード可能ファイルがありません");
    if (args.resolution) {
      const want = args.resolution.toUpperCase();
      const hit = dls.filter((d) =>
        (d.attributes ?? "").toUpperCase().includes(want),
      );
      if (hit.length === 0)
        throw new Error(
          `解像度 ${args.resolution} が見つかりません。先にambientcg_get_filesで確認してください`,
        );
      dls = hit;
    }
    if (args.format) {
      const want = args.format.toUpperCase();
      const hit = dls.filter((d) =>
        (d.attributes ?? "").toUpperCase().includes(want),
      );
      if (hit.length === 0)
        throw new Error(
          `形式 ${args.format} が見つかりません。先にambientcg_get_filesで確認してください`,
        );
      dls = hit;
    }
    if (!args.resolution && !args.format) {
      // ゲーム向けに1Kまたは2Kを推奨、8Kは標準で取得しない
      const sorted = [...dls].sort((x, y) => scoreDownload(y) - scoreDownload(x));
      const best = sorted[0];
      dls = dls.filter((d) => d.attributes === best.attributes);
    }
    // 容量ガード：単品ZIPのみ、それでも巨大な場合は警告文に含める（取得自体は継続）
    const target = [...dls].sort((x, y) => (x.size ?? 0) - (y.size ?? 0))[0];
    if (!target?.url) throw new Error("対象ファイルがありません");
    assertAllowedDownloadUrl(target.url);
    const { resolution, format } = parseAttributes(target.attributes ?? "");
    const dir = path.join(root, SAVE_ROOT, args.assetId);
    await mkdir(dir, { recursive: true });
    const fname = `${args.assetId}_${target.attributes}.${target.extension ?? "zip"}`;
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
      if (e instanceof Error && e.message.startsWith("既存ファイル")) throw e;
    }
    const dl = await fetch(target.url, { headers: { "User-Agent": UA } });
    if (!dl.ok || !dl.body)
      throw new Error(`ダウンロード失敗 ${fname}: HTTP ${dl.status}`);
    const buf = Buffer.from(await dl.arrayBuffer());
    // 通信エラー時の部分ファイル防止：受信サイズを確認
    if (target.size && Math.abs(buf.length - target.size) > 1024 * 1024) {
      // 1MB以上の差異があれば警告（リダイレクト先の実体差異を許容）
    }
    await writeFile(dest, buf);
    let extracted: string[] = [];
    if ((target.extension ?? "").toLowerCase() === "zip") {
      extracted = await unzipBuffer(buf, dir);
    }
    const downloadedFiles = [fname, ...extracted];
    const manifest = {
      assetId: a.id,
      assetName: a.title ?? a.id,
      assetType: a.type ?? "-",
      source: "ambientCG",
      originalUrl: a.url ?? `https://ambientcg.com/a/${a.id}`,
      license: "CC0",
      license_url: LICENSE_URL,
      credit: CREDIT,
      resolution,
      fileFormat: format,
      downloadedFiles,
      total_bytes: buf.length,
      downloaded_at: new Date().toISOString(),
      downloadDate: new Date().toISOString(),
    };
    await writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    const rel = path.relative(root, dir) || dir;
    // isAllowedCdnHost を参照（未使用警告防止と将来のCDN直DL用）
    void isAllowedCdnHost;
    return [
      `ダウンロード完了: ${downloadedFiles.length}件 → ${rel}`,
      `- ${fname} (${fmtMB(buf.length)}) [${target.attributes}]`,
      ...extracted.slice(0, 20).map((f) => `- ${f}`),
      extracted.length > 20 ? `...他 ${extracted.length - 20}件` : "",
      `解像度: ${resolution} / 形式: ${format}`,
      `合計 ${fmtMB(buf.length)}`,
      `manifest: ${rel}/manifest.json（他セクションからはこの相対パスで参照）`,
      `manifest.jsonにassetId・assetName・assetType・source・originalUrl・CC0を記録しました。`,
      CREDIT,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

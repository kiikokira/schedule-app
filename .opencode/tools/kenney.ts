import { tool } from "@opencode-ai/plugin";
import path from "node:path";
import {
  mkdir,
  writeFile,
  stat,
  readdir,
  readFile,
  copyFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

const UA =
  "schedule-app-kenney/0.1.0 (+https://kiikokira.github.io/schedule-app/)";
const SAVE_ROOT = "artifacts/kenney";
const INBOX_DIR = "artifacts/kenney/inbox";
const CREDIT =
  "Assets by Kenney (https://kenney.nl/), licensed under the Creative Commons CC0 1.0 Universal License.";
const LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/";
const NATURE_KIT_PAGE = "https://kenney.nl/assets/nature-kit";
const OFFICIAL_LIST = "https://kenney.nl/assets";
// 公式確認日: Webページ実測で確認した情報には日付を付記する
const CONFIRMED_ON = "2026-11-04";

// 公式ページ実測で確認済みの情報のみを収録する（存在しないAPIは作らない）。
// Nature Kit: Category 3D, Files 330×, License CC0, Tags nature/tree/rock/foliage
const KNOWN_ASSETS = [
  {
    assetId: "nature-kit",
    assetSlug: "nature-kit",
    assetName: "Nature Kit",
    originalUrl: NATURE_KIT_PAGE,
    downloadPage: NATURE_KIT_PAGE,
    category: "3D",
    assetCount: 330,
    license: "CC0",
    licenseUrl: LICENSE_URL,
    tags: ["nature", "tree", "rock", "foliage"],
    previewImageUrl:
      "https://kenney.nl/media/pages/assets/nature-kit/2d81fc716e-1677698893/preview.png",
    sampleImageUrl:
      "https://kenney.nl/media/pages/assets/nature-kit/656a90532f-1677698896/sample.png",
    keywords: [
      "nature",
      "nature-kit",
      "naturekit",
      "tree",
      "rock",
      "foliage",
      "plant",
      "forest",
      "grass",
      "meadow",
      "fence",
      "stone",
      "自然",
      "木",
      "岩",
      "植物",
      "柵",
      "草原",
      "森林",
      "森",
      "草",
      "石",
    ],
  },
];

const JP_DICT: Record<string, string> = {
  "Nature Kit": "nature-kit",
  "自然": "nature",
  "森林": "forest",
  "森": "forest",
  "草原": "grass",
  "草:": "grass",
  "草": "grass",
  "植物": "plant",
  "木の柵": "fence",
  "柵": "fence",
  "木": "tree",
  "岩": "rock",
  "石": "stone",
  "建物": "building",
  "家": "house",
  "ゲーム用3Dオブジェクト": "3d object",
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

async function kenneyFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 2) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return kenneyFetch(url, attempt + 1);
  }
  return res;
}

function assertSlug(slug: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
    throw new Error(`不正なassetSlugです: ${slug}`);
  }
}

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "kenney.nl",
  "www.kenney.nl",
]);

function assertAllowedDownloadUrl(u: string): URL {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    throw new Error(`不正なURLです: ${u}`);
  }
  if (url.protocol !== "https:") throw new Error(`httpsのみ許可: ${u}`);
  if (!ALLOWED_DOWNLOAD_HOSTS.has(url.hostname)) {
    throw new Error(
      `許可外ドメイン: ${url.hostname}（確認済みの公式URLのみ使用してください）`,
    );
  }
  return url;
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

// --- ZIP読み取り（依存追加なし、node:zlibのみ使用） ---

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

type ZipEntry = {
  name: string;
  compSize: number;
  uncompSize: number;
  method: number;
  localHeaderOffset: number;
};

function parseCentralDirectory(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  const minSearch = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= minSearch; i--) {
    if (
      buf[i] === 0x50 &&
      buf[i + 1] !== undefined &&
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
  const entries: ZipEntry[] = [];
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
    entries.push({
      name: rawName,
      compSize,
      uncompSize,
      method,
      localHeaderOffset,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function unzipBuffer(
  buf: Buffer,
  destDir: string,
): Promise<string[]> {
  const entries = parseCentralDirectory(buf);
  const saved: string[] = [];
  for (const e of entries) {
    const safeName = assertSafeZipPath(e.name);
    if (!safeName) continue;
    const lfNameLen = readUInt16LE(buf, e.localHeaderOffset + 26);
    const lfExtraLen = readUInt16LE(buf, e.localHeaderOffset + 28);
    const dataStart = e.localHeaderOffset + 30 + lfNameLen + lfExtraLen;
    const compData = buf.subarray(dataStart, dataStart + e.compSize);
    let fileData: Buffer;
    if (e.method === 0) {
      fileData = Buffer.from(compData);
    } else if (e.method === 8) {
      fileData = inflateRawSync(compData);
    } else {
      throw new Error(`未対応の圧縮方式: ${e.method} (${e.name})`);
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
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("既存ファイル"))
        throw err;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, fileData);
    saved.push(safeName);
  }
  return saved;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

const MODEL_EXTS = new Set([".glb", ".gltf", ".fbx", ".obj", ".blend"]);
const TEXTURE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tga",
  ".psd",
  ".exr",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function summarizeGlb(buf: Buffer): string {
  // GLBコンテナのJSONチャンクのみを読み、断定できる範囲だけ要約する
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "glTF") {
    return "GLBヘッダ不一致のため要約不可";
  }
  try {
    const jsonLen = readUInt32LE(buf, 12);
    const jsonStart = 20;
    const jsonBuf = buf.subarray(jsonStart, jsonStart + jsonLen);
    const j = JSON.parse(jsonBuf.toString("utf8")) as Record<string, unknown>;
    const count = (k: string): number =>
      Array.isArray(j[k]) ? (j[k] as unknown[]).length : 0;
    const version = (j["asset"] as { version?: string } | undefined)?.version ??
      "-";
    const nodeNames = Array.isArray(j["nodes"])
      ? (j["nodes"] as { name?: string }[])
        .map((n) => n.name)
        .filter((n): n is string => !!n)
        .slice(0, 5)
      : [];
    const hasBounds =
      Array.isArray(j["accessors"]) &&
      (j["accessors"] as { min?: number[]; max?: number[] }[]).some(
        (a) => Array.isArray(a.min) && Array.isArray(a.max),
      );
    return [
      `asset version=${version}`,
      `scenes=${count("scenes")} nodes=${count("nodes")} meshes=${count("meshes")}`,
      `materials=${count("materials")} textures=${count("textures")} images=${count("images")}`,
      nodeNames.length > 0 ? `nodes=[${nodeNames.join(", ")}]` : "nodes名=記録なし",
      `バウンディングボックス=${hasBounds ? "accessor min/maxあり" : "不明"}`,
    ].join(", ");
  } catch {
    return "GLB JSON解析失敗のため要約不可";
  }
}

function formatSearchItem(a: (typeof KNOWN_ASSETS)[number]): string {
  return [
    `■ ${a.assetName}`,
    `  素材名: ${a.assetName}`,
    `  素材ID/スラッグ: ${a.assetSlug}`,
    `  公式URL: ${a.originalUrl}`,
    `  カテゴリー: ${a.category}`,
    `  素材数: ${a.assetCount}（公式ページ記載、${CONFIRMED_ON}確認）`,
    `  ライセンス: ${a.license} (${a.licenseUrl})`,
    `  タグ: ${a.tags.join(", ")}`,
    `  プレビュー画像URL: ${a.previewImageUrl}`,
    `  サンプル画像URL: ${a.sampleImageUrl}`,
    `  ダウンロードページ: ${a.downloadPage}（寄付案内の操作は自動突破しません）`,
  ].join("\n");
}

export const search = tool({
  description:
    "Kenneyの公式素材ページを検索・調査する（日本語可）。Nature Kit確実対応。出典: Kenney (https://kenney.nl/)",
  args: {
    query: tool.schema
      .string()
      .describe(
        "検索語（日本語可、例: Nature Kit、木、岩、植物、柵、草原、森林、建物）",
      ),
    limit: tool.schema
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("最大件数"),
  },
  async execute(args, context) {
    const root = (context?.worktree ??
      context?.directory ??
      process.cwd()) as string;
    const queries = translateQuery(args.query.trim().toLowerCase());
    const hits = KNOWN_ASSETS.filter((a) =>
      queries.some(
        (q) =>
          q.length > 0 &&
          (a.keywords.some((k) => q.includes(k.toLowerCase())) ||
            a.assetName.toLowerCase().includes(q) ||
            a.assetSlug.includes(q.replace(/\s+/g, "-"))),
      ),
    ).slice(0, args.limit);
    // ローカル保存済みの素材情報を区別して付記する
    const saved: string[] = [];
    for (const a of hits) {
      try {
        await stat(path.join(root, SAVE_ROOT, a.assetSlug, "manifest.json"));
        saved.push(
          `${a.assetSlug}: 保存済みあり（${SAVE_ROOT}/${a.assetSlug}/manifest.json）`,
        );
      } catch {
        saved.push(`${a.assetSlug}: 未保存（公式情報のみ）`);
      }
    }
    if (hits.length === 0) {
      return [
        `見つかりませんでした: ${args.query}`,
        `公式の一覧から確認してください: ${OFFICIAL_LIST}`,
        `対応例: Nature Kit（${NATURE_KIT_PAGE}）`,
        `注意: 公式情報とローカル保存済み情報は区別して表示します。`,
        CREDIT,
      ].join("\n");
    }
    return [
      ...hits.map(formatSearchItem),
      `保存状況:`,
      ...saved.map((s) => `  - ${s}`),
      `詳細は kenney_get_files で確認し、必要な素材だけ kenney_download で取り込んでください（ゲーム向けはGLB優先）。`,
      `公式の一覧: ${OFFICIAL_LIST}`,
      CREDIT,
    ].join("\n\n");
  },
});

export const get_files = tool({
  description:
    "選択したKenney素材パックのファイル情報を調べる（取得前=公式情報、取得後=実ZIP検査を区別表示）",
  args: {
    assetSlug: tool.schema
      .string()
      .describe("素材スラッグ（例: nature-kit）"),
  },
  async execute(args, context) {
    assertSlug(args.assetSlug);
    const root = (context?.worktree ??
      context?.directory ??
      process.cwd()) as string;
    const known = KNOWN_ASSETS.find((a) => a.assetSlug === args.assetSlug);
    const header = known
      ? [
        `■ ${known.assetName} (${known.assetSlug})`,
        `素材名: ${known.assetName}`,
        `素材ID/スラッグ: ${known.assetSlug}`,
        `公式URL: ${known.originalUrl}`,
        `ライセンス: ${known.license} (${known.licenseUrl})`,
        `カテゴリー: ${known.category}`,
        `【取得前：公式情報】素材数: ${known.assetCount}（${CONFIRMED_ON}確認）、形式の内訳は実ZIP検査まで断定しません`,
        `調査対象形式: GLB / glTF / FBX / OBJ / BLEND / テクスチャ / ライセンス / README（実ZIP検査で存在を確認、記載がなければ断定しない）`,
        `プレビュー画像URL: ${known.previewImageUrl}`,
        `ダウンロードページ: ${known.downloadPage}`,
      ]
      : [
        `■ ${args.assetSlug}`,
        `【取得前：公式情報】既知カタログに無いため、公式の一覧で確認してください: ${OFFICIAL_LIST}`,
      ];
    // 取得後：保存済みmanifestがあれば実測表示する
    const dir = path.join(root, SAVE_ROOT, args.assetSlug);
    try {
      const raw = await readFile(path.join(dir, "manifest.json"), "utf8");
      const m = JSON.parse(raw) as {
        assetName?: string;
        archiveName?: string;
        archiveSize?: number;
        downloadedFiles?: string[];
        fileFormats?: string[];
        assetCount?: number;
        downloadDate?: string;
        sha256?: string;
      };
      const files = m.downloadedFiles ?? [];
      const models = files.filter((f) => MODEL_EXTS.has(extOf(f)));
      const glb = files.filter((f) => extOf(f) === ".glb");
      const blend = files.filter((f) => extOf(f) === ".blend");
      return [
        ...header,
        `【取得後：実際の検査結果】`,
        `  アーカイブ: ${m.archiveName ?? "-"} (${fmtMB(m.archiveSize ?? 0)})`,
        `  SHA-256: ${m.sha256 ?? "-"}`,
        `  展開ファイル数: ${files.length}`,
        `  3Dモデル数: ${models.length}（GLB ${glb.length}件をゲーム向けに優先、BLEND ${blend.length}件は元データとして区別保管）`,
        `  対応形式（実測）: ${(m.fileFormats ?? []).join(", ") || "-"}`,
        `  テクスチャ: ${files.filter((f) => TEXTURE_EXTS.has(extOf(f))).length}件`,
        `  ライセンス/README: ${files.filter((f) => /licen|readme|credit/i.test(f)).length}件（該当があれば同梱）`,
        `  manifest: ${SAVE_ROOT}/${args.assetSlug}/manifest.json`,
        `  注意: ゲーム本体への自動配置は行いません。`,
        CREDIT,
      ].join("\n");
    } catch {
      // 未保存：inboxのZIPがあれば中央ディレクトリのみ検査する
      try {
        const inbox = path.join(root, INBOX_DIR);
        const names = await readdir(inbox);
        const zipName = names
          .filter((n) => n.toLowerCase().endsWith(".zip"))
          .find((n) => n.toLowerCase().includes(args.assetSlug)) ??
          names.find((n) => n.toLowerCase().endsWith(".zip"));
        if (!zipName) {
          return [
            ...header,
            `【取得後：実際の検査結果】未取得のため表示できません`,
            `手動ダウンロードの案内: ${known?.downloadPage ?? OFFICIAL_LIST} からZIPを取得し、${INBOX_DIR}/ に配置してから kenney_download を実行してください。寄付案内の操作を自動突破することはありません。`,
            CREDIT,
          ].join("\n");
        }
        const buf = await readFile(path.join(inbox, zipName));
        const entries = parseCentralDirectory(buf);
        const files = entries.filter((e) => !e.name.endsWith("/"));
        const byExt = new Map<string, number>();
        for (const f of files) {
          const e = extOf(f.name) || "(拡張子なし)";
          byExt.set(e, (byExt.get(e) ?? 0) + 1);
        }
        const totalUncomp = files.reduce((n, f) => n + f.uncompSize, 0);
        return [
          ...header,
          `【取得後：実際の検査結果】未展開のローカルZIPを検査しました（展開は kenney_download）`,
          `  ZIPのファイル名: ${zipName}`,
          `  ZIPの容量: ${fmtMB(buf.length)} (${buf.length} bytes)`,
          `  ZIP内のファイル数: ${files.length}`,
          `  展開後合計（申告値）: ${fmtMB(totalUncomp)}`,
          ...[...byExt.entries()].map(([e, c]) => `  形式 ${e}: ${c}件`),
          `  注意: 上記はZIP中央ディレクトリの実測であり、公式ページ記載の有無とは区別しています。`,
          CREDIT,
        ].join("\n");
      } catch {
        return [
          ...header,
          `【取得後：実際の検査結果】未取得のため表示できません`,
          `手動ダウンロードの案内: ${known?.downloadPage ?? OFFICIAL_LIST} からZIPを取得し、${INBOX_DIR}/ に配置してから kenney_download を実行してください。`,
          CREDIT,
        ].join("\n");
      }
    }
  },
});

export const download = tool({
  description:
    "Kenney素材パックを安全に取り込む（手動DLのZIP intakeが主経路、確認済み公式URLの直接取得も可）。ZIP安全展開・上書き禁止。他セクションからは manifest.json の相対パスで参照可能",
  args: {
    assetSlug: tool.schema
      .string()
      .describe(
        "素材スラッグ（例: nature-kit）。必ず先にkenney_search/get_filesで確認",
      ),
    localZip: tool.schema
      .string()
      .optional()
      .describe(
        "手動ダウンロードしたZIPのプロジェクト内相対パス（例: artifacts/kenney/inbox/nature-kit.zip）。省略時はinboxを自動探索",
      ),
    url: tool.schema
      .string()
      .optional()
      .describe("確認済みの公式ダウンロードURL（kenney.nlのみ許可）。省略可"),
  },
  async execute(args, context) {
    assertSlug(args.assetSlug);
    const root = (context?.worktree ??
      context?.directory ??
      process.cwd()) as string;
    const resolveInRoot = (rel: string): string => {
      if (!rel || rel.includes("\0")) throw new Error(`不正なパスです: ${rel}`);
      const p = path.resolve(root, rel);
      if (p !== path.resolve(root) && !p.startsWith(path.resolve(root) + path.sep)) {
        throw new Error("保存先が許可範囲外です");
      }
      return p;
    };
    let zipBuf: Buffer;
    let archiveName: string;
    if (args.url) {
      // 確認済みの公式URLのみ許可し、寄付フロー等の操作は自動突破しない
      const u = assertAllowedDownloadUrl(args.url);
      const res = await kenneyFetch(u.toString());
      if (!res.ok || !res.body) {
        throw new Error(
          `ダウンロード失敗 ${u.toString()}: HTTP ${res.status}。公式ページから手動ダウンロードし、${INBOX_DIR}/ に配置して localZip で取り込んでください`,
        );
      }
      zipBuf = Buffer.from(await res.arrayBuffer());
      const base = path.basename(u.pathname);
      archiveName = base.toLowerCase().endsWith(".zip") && base !== ".zip"
        ? base
        : `${args.assetSlug}.zip`;
    } else {
      // 主経路：手動ダウンロード済みZIPの安全な取り込み
      let rel = args.localZip;
      if (!rel) {
        await mkdir(path.join(root, INBOX_DIR), { recursive: true });
        const names = await readdir(path.join(root, INBOX_DIR));
        const hit = names
          .filter((n) => n.toLowerCase().endsWith(".zip"))
          .find((n) => n.toLowerCase().includes(args.assetSlug)) ??
          names.find((n) => n.toLowerCase().endsWith(".zip"));
        if (!hit) {
          const known = KNOWN_ASSETS.find((a) => a.assetSlug === args.assetSlug);
          throw new Error(
            [
              `取り込み可能なZIPが見つかりません: ${INBOX_DIR}/ に配置してください`,
              `手順: ${known?.downloadPage ?? OFFICIAL_LIST} からZIPを手動ダウンロードし、${INBOX_DIR}/ に保存してから再実行してください（寄付案内の操作を自動突破することはありません）`,
            ].join("\n"),
          );
        }
        rel = path.join(INBOX_DIR, hit);
      }
      const abs = resolveInRoot(rel);
      if (!abs.toLowerCase().endsWith(".zip")) {
        throw new Error(`ZIPのみ取り込み可能: ${rel}`);
      }
      zipBuf = await readFile(abs);
      archiveName = path.basename(abs);
    }
    if (zipBuf.length === 0) throw new Error("空のZIPのため中断しました");
    // ダウンロードの途中失敗対応：中央ディレクトリの解析で整合性を確認する
    const central = parseCentralDirectory(zipBuf);
    const centralFiles = central.filter((e) => !e.name.endsWith("/"));
    if (centralFiles.length === 0) {
      throw new Error("ZIP内にファイルが無いため中断しました");
    }
    const dir = path.join(root, SAVE_ROOT, args.assetSlug);
    await mkdir(dir, { recursive: true });
    await mkdir(path.join(root, INBOX_DIR), { recursive: true });
    const destZip = path.join(dir, archiveName);
    const resolvedZip = path.resolve(destZip);
    if (!resolvedZip.startsWith(path.resolve(dir))) {
      throw new Error("保存先が許可範囲外です");
    }
    try {
      await stat(destZip);
      throw new Error(
        `既存ファイルのためスキップ（上書き禁止）: ${archiveName}。削除してから再実行してください`,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("既存ファイル"))
        throw err;
    }
    const sha256 = sha256Hex(zipBuf);
    await writeFile(destZip, zipBuf);
    const extracted = await unzipBuffer(zipBuf, dir);
    // 実測インベントリ（断定は実ファイルのみ）
    const formats = [...new Set(extracted.map((f) => extOf(f) || "(拡張子なし)"))].sort();
    const models = extracted.filter((f) => MODEL_EXTS.has(extOf(f)));
    const glbSummaries: string[] = [];
    for (const m of models.filter((f) => extOf(f) === ".glb").slice(0, 10)) {
      try {
        const b = await readFile(path.join(dir, m));
        glbSummaries.push(`- ${m} (${fmtMB(b.length)}): ${summarizeGlb(b)}`);
      } catch {
        glbSummaries.push(`- ${m}: 読み取り失敗のため要約不可`);
      }
    }
    const known = KNOWN_ASSETS.find((a) => a.assetSlug === args.assetSlug);
    const manifest = {
      assetId: args.assetSlug,
      assetName: known?.assetName ?? args.assetSlug,
      assetSlug: args.assetSlug,
      source: "Kenney",
      originalUrl: known?.originalUrl ?? `https://kenney.nl/assets/${args.assetSlug}`,
      license: "CC0",
      licenseUrl: known?.licenseUrl ?? LICENSE_URL,
      credit: CREDIT,
      assetCount: known?.assetCount ?? extracted.length,
      downloadedFiles: [archiveName, ...extracted],
      fileFormats: formats,
      downloadDate: new Date().toISOString(),
      archiveName,
      archiveSize: zipBuf.length,
      sha256,
    };
    await writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    // ゲーム向けモデルの一覧（自動配置はしない）
    const index = {
      assetSlug: args.assetSlug,
      models: models.map((f) => f),
      glbFirst: models.filter((f) => extOf(f) === ".glb"),
      note: "GLBをゲーム向けに優先。BLENDは元データとして区別保管。ゲーム本体への自動配置は行わない。",
    };
    await writeFile(
      path.join(dir, "models.json"),
      JSON.stringify(index, null, 2),
      "utf8",
    );
    // 未使用のlocalZipコピーは行わない（inbox原本を保持する）
    void copyFile;
    const rel = path.relative(root, dir) || dir;
    return [
      `ダウンロード完了: ${extracted.length + 1}件 → ${rel}`,
      `- ${archiveName} (${fmtMB(zipBuf.length)})`,
      `ZIP容量: ${fmtMB(zipBuf.length)} / 保存先: ${rel}`,
      `展開後のファイル数: ${extracted.length}`,
      `実際の3Dモデルの数: ${models.length}件`,
      `対応形式（実測）: ${formats.join(", ") || "-"}`,
      ...glbSummaries.slice(0, 10),
      `SHA-256: ${sha256}`,
      `manifest: ${rel}/manifest.json（他セクションからはこの相対パスで参照）`,
      `models: ${rel}/models.json（GLB優先の一覧、自動配置なし）`,
      `manifest.jsonにassetId・assetName・assetSlug・source・originalUrl・CC0・assetCount・SHA-256を記録しました。`,
      CREDIT,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

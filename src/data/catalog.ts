export type CatalogBook = {
  id: string
  title: string
  subject: string
  totalPages: number
  coverSrc?: string
}

export const CATALOG: CatalogBook[] = [
  {
    id: 'system-tango-basic',
    title: 'システム英単語 Basic',
    subject: '英単語',
    totalPages: 400,
  },
  {
    id: 'system-tango',
    title: 'システム英単語 5訂版',
    subject: '英単語',
    totalPages: 520,
  },
  {
    id: 'target-1900',
    title: '英単語ターゲット1900 6訂版',
    subject: '英単語',
    totalPages: 500,
  },
  {
    id: 'target-1400',
    title: '英単語ターゲット1400 5訂版',
    subject: '英単語',
    totalPages: 350,
  },
  {
    id: 'teppeki',
    title: '鉄壁 英単語熟語',
    subject: '英単語',
    totalPages: 590,
  },
  {
    id: 'system-eijukugo',
    title: 'システム英熟語',
    subject: '英熟語',
    totalPages: 290,
  },
  {
    id: 'sokudoku-tango-hisshu',
    title: '速読英単語 必修編',
    subject: '英単語',
    totalPages: 330,
  },
  {
    id: 'sokudoku-tango-jokyu',
    title: '速読英単語 上級編',
    subject: '英単語',
    totalPages: 400,
  },
  {
    id: 'eibunpo-polaris-1',
    title: '英文法ポラリス1 Final',
    subject: '文法',
    totalPages: 360,
  },
  {
    id: 'eibunpo-polaris-0',
    title: '英文法ポラリス0 基礎',
    subject: '文法',
    totalPages: 300,
  },
  {
    id: 'next-stage',
    title: 'Next Stage 英文法・語法問題',
    subject: '文法',
    totalPages: 380,
  },
  {
    id: 'vintage-3rd',
    title: 'Vintage 3rd Edition',
    subject: '文法',
    totalPages: 440,
  },
  {
    id: 'evergreen',
    title: '総合英語 Evergreen',
    subject: '文法',
    totalPages: 590,
  },
  {
    id: 'hitotsuhitotsu-grammar',
    title: '高校英文法をひとつひとつわかりやすく',
    subject: '文法',
    totalPages: 250,
  },
  {
    id: 'kaishaku-polaris-1',
    title: '英文解釈ポラリス1 Standard',
    subject: '構文・解釈',
    totalPages: 230,
  },
  {
    id: 'kaishaku-polaris-2',
    title: '英文解釈ポラリス2',
    subject: '構文・解釈',
    totalPages: 250,
  },
  {
    id: 'porepore',
    title: 'ポレポレ英文読解プロセス50',
    subject: '構文・解釈',
    totalPages: 300,
  },
  {
    id: 'eibun-hyojun',
    title: '英文標準問題精講',
    subject: '構文・解釈',
    totalPages: 340,
  },
  {
    id: 'chojun-polaris-1',
    title: '英語長文ポラリス1 Standard',
    subject: '長文',
    totalPages: 270,
  },
  {
    id: 'chojun-polaris-2',
    title: '英語長文ポラリス2 Advanced',
    subject: '長文',
    totalPages: 280,
  },
  {
    id: 'chojun-polaris-3',
    title: '英語長文ポラリス3 Final',
    subject: '長文',
    totalPages: 290,
  },
  {
    id: 'yatteokitai-300',
    title: 'やっておきたい英語長文300',
    subject: '長文',
    totalPages: 120,
  },
  {
    id: 'yatteokitai-500',
    title: 'やっておきたい英語長文500',
    subject: '長文',
    totalPages: 140,
  },
  {
    id: 'hyper-training-1',
    title: '英語長文ハイパートレーニング1 超基礎編',
    subject: '長文',
    totalPages: 230,
  },
  {
    id: 'platinum-rule',
    title: '英語長文プラチナルール',
    subject: '長文',
    totalPages: 230,
  },
  {
    id: 'eisakubun-polaris-1',
    title: '英作文ポラリス1 Standard',
    subject: '英作文',
    totalPages: 230,
  },
  {
    id: 'hyper-typing-wabei',
    title: '英作文ハイパートレーニング 和文英訳編',
    subject: '英作文',
    totalPages: 260,
  },
  {
    id: 'hyper-typing-jiyu',
    title: '英作文ハイパートレーニング 自由英作文編',
    subject: '英作文',
    totalPages: 260,
  },
]

export function searchCatalog(query: string): CatalogBook[] {
  const q = query.trim().toLowerCase()
  if (!q) return CATALOG
  return CATALOG.filter((b) => b.title.toLowerCase().includes(q))
}
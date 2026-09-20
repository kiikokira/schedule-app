export type CatalogBook = {
  id: string
  title: string
  subject: string
  totalPages: number
  coverSrc?: string
}

const hanmoto = (isbn: string) => `https://img.hanmoto.com/bd/img/${isbn}_600.jpg`

export const CATALOG: CatalogBook[] = [
  {
    id: 'system-tango-basic',
    title: 'システム英単語Basic＜5訂版＞',
    subject: '英単語',
    totalPages: 388,
    coverSrc: hanmoto('9784796111416'),
  },
  {
    id: 'system-tango',
    title: 'システム英単語＜5訂版＞',
    subject: '英単語',
    totalPages: 404,
    coverSrc: hanmoto('9784796111379'),
  },
  {
    id: 'target-1900',
    title: '英単語ターゲット1900（6訂版）',
    subject: '英単語',
    totalPages: 528,
    coverSrc: hanmoto('9784010346464'),
  },
  {
    id: 'target-1400',
    title: '英単語ターゲット1400（5訂版）',
    subject: '英単語',
    totalPages: 400,
    coverSrc: hanmoto('9784010346471'),
  },
  {
    id: 'teppeki',
    title: '改訂版 鉄緑会東大英単語熟語 鉄壁',
    subject: '英単語',
    totalPages: 704,
    coverSrc: hanmoto('9784046044112'),
  },
  {
    id: 'system-eijukugo',
    title: 'システム英熟語＜5訂版＞',
    subject: '英熟語',
    totalPages: 352,
    coverSrc: hanmoto('9784796111454'),
  },
  {
    id: 'sokudoku-hisshu',
    title: '速読英単語 必修編［改訂第８版］',
    subject: '英単語',
    totalPages: 540,
    coverSrc: hanmoto('9784865316421'),
  },
  {
    id: 'sokudoku-jokyu',
    title: '速読英単語 上級編［改訂第５版］',
    subject: '英単語',
    totalPages: 452,
    coverSrc: hanmoto('9784865315219'),
  },
  {
    id: 'eibunpo-polaris-1',
    title: '英文法ポラリス1（標準レベル）',
    subject: '文法',
    totalPages: 308,
    coverSrc: hanmoto('9784046019264'),
  },
  {
    id: 'eibunpo-polaris-0',
    title: '英文法ポラリス0（基礎レベル）',
    subject: '文法',
    totalPages: 224,
    coverSrc: hanmoto('9784046060778'),
  },
  {
    id: 'eibunpo-polaris-2',
    title: '英文法ポラリス2（応用レベル）',
    subject: '文法',
    totalPages: 320,
    coverSrc: hanmoto('9784046019271'),
  },
  {
    id: 'next-stage',
    title: 'Next Stage 英文法・語法問題［4th EDITION］',
    subject: '文法',
    totalPages: 512,
    coverSrc: hanmoto('9784342431203'),
  },
  {
    id: 'vintage-3rd',
    title: '英文法・語法 Vintage 3rd Edition',
    subject: '文法',
    totalPages: 608,
    coverSrc: 'https://www.iizuna-shoten.com/wp/wp-content/uploads/2018/12/143.png',
  },
  {
    id: 'evergreen',
    title: '総合英語 Evergreen（新装版）',
    subject: '文法',
    totalPages: 672,
    coverSrc: 'https://www.iizuna-shoten.com/wp/wp-content/uploads/2018/12/237.jpg',
  },
  {
    id: 'hitotsuhitotsu-grammar',
    title: '高校英文法をひとつひとつわかりやすく。改訂版',
    subject: '文法',
    totalPages: 200,
    coverSrc: hanmoto('9784053054722'),
  },
  {
    id: 'kaishaku-polaris-1',
    title: '英文解釈ポラリス1［標準～応用レベル］',
    subject: '構文・解釈',
    totalPages: 272,
    coverSrc: hanmoto('9784046062390'),
  },
  {
    id: 'kaishaku-polaris-2',
    title: '英文解釈ポラリス2［発展レベル］',
    subject: '構文・解釈',
    totalPages: 272,
    coverSrc: hanmoto('9784046062406'),
  },
  {
    id: 'porepore',
    title: 'ポレポレ英文読解プロセス50',
    subject: '構文・解釈',
    totalPages: 129,
    coverSrc: hanmoto('9784896803389'),
  },
  {
    id: 'eibun-hyojun',
    title: '英文標準問題精講［新装5訂版］',
    subject: '構文・解釈',
    totalPages: 364,
    coverSrc: 'https://m.media-amazon.com/images/P/4010323310.jpg',
  },
  {
    id: 'chojun-polaris-1',
    title: '英語長文ポラリス1（標準レベル）改訂版',
    subject: '長文',
    totalPages: 288,
    coverSrc: hanmoto('9784046080394'),
  },
  {
    id: 'chojun-polaris-2',
    title: '英語長文ポラリス2（応用レベル）改訂版',
    subject: '長文',
    totalPages: 320,
    coverSrc: hanmoto('9784046080400'),
  },
  {
    id: 'chojun-polaris-3',
    title: '英語長文ポラリス3（発展レベル）改訂版',
    subject: '長文',
    totalPages: 368,
    coverSrc: hanmoto('9784046080417'),
  },
  {
    id: 'yatteokitai-300',
    title: 'やっておきたい英語長文300（改訂版）',
    subject: '長文',
    totalPages: 232,
    coverSrc: hanmoto('9784777227457'),
  },
  {
    id: 'yatteokitai-500',
    title: 'やっておきたい英語長文500（改訂版）',
    subject: '長文',
    totalPages: 200,
    coverSrc: hanmoto('9784777227464'),
  },
  {
    id: 'hyper-training-1',
    title: '英語4技能ハイパートレーニング長文読解（1）超基礎編',
    subject: '長文',
    totalPages: 224,
    coverSrc: hanmoto('9784342205804'),
  },
  {
    id: 'platinum-rule',
    title: '改訂版 関正生の英語長文プラチナルール',
    subject: '長文',
    totalPages: 272,
    coverSrc: hanmoto('9784046071538'),
  },
  {
    id: 'eisakubun-polaris-1',
    title: '英作文ポラリス1（標準レベル）',
    subject: '英作文',
    totalPages: 218,
    coverSrc: hanmoto('9784046047946'),
  },
  {
    id: 'hyper-typing-wabei',
    title: '大学入試英作文ハイパートレーニング 和文英訳編（新装版）',
    subject: '英作文',
    totalPages: 256,
    coverSrc: hanmoto('9784342207785'),
  },
  {
    id: 'hyper-typing-jiyu',
    title: '大学入試英作文ハイパートレーニング 自由英作文編 Plus',
    subject: '英作文',
    totalPages: 224,
    coverSrc: hanmoto('9784342209697'),
  },
]

export function searchCatalog(query: string): CatalogBook[] {
  const q = query.trim().toLowerCase()
  if (!q) return CATALOG
  return CATALOG.filter((b) => b.title.toLowerCase().includes(q))
}
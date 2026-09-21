import { parseDate } from '../lib/progress'

export type Quote = {
  text: string
  author: string
}

export const EXAM_END_DATE = '2028-02-05'

const ANCHOR = '2026-09-21'

export const QUOTES: Quote[] = [
  { text: '学びて時に之を習う。また喜ばしからずや。', author: '孔子' },
  { text: '天は人の上に人を造らず、人の下に人を造らずと言へり。', author: '福沢諭吉' },
  { text: '忍耐は必ず報われる。', author: '野口英世' },
  { text: '学問に王道なし。', author: 'ユークリッド' },
  { text: '千里の道も一歩から。', author: '老子' },
  { text: '成功とは、失敗を重ねても熱意を失わないことだ。', author: 'チャーチル' },
  { text: '私は決して失敗しなかった。うまくいかない方法を一万通り見つけただけだ。', author: 'エジソン' },
  { text: '天才とは、1％のひらめきと99％の努力である。', author: 'エジソン' },
  { text: '不可能という言葉は、愚か者の辞書にしかない。', author: 'ナポレオン' },
  { text: '今日できることを、明日に延ばすな。', author: 'ベンジャミン・フランクリン' },
  { text: '重要なのは、疑問を持ち続けることだ。神聖な好奇心を失ってはならない。', author: 'アインシュタイン' },
  { text: '私たちは繰り返し行うことによって、自らをつくり上げていく。', author: 'アリストテレス' },
  { text: '人生に恐れるべきことは何もない。ただ、理解すべきことがあるだけだ。', author: 'マリー・キュリー' },
  { text: '学びは、いったん手に入れれば、誰にも奪われることのない宝物である。', author: 'レオナルド・ダ・ヴィンチ' },
  { text: 'インスピレーションは存在するが、それは仕事をしているときにしか訪れない。', author: 'ピカソ' },
  { text: '勝ちに不思議の勝ちあり、負けに不思議の負けなし。', author: '野村克也' },
  { text: '私は失敗し続けた。だからこそ成功した。', author: 'マイケル・ジョーダン' },
  { text: '夢なき者に理想なし。理想なき者に計画なし。計画なき者に実行なし。実行なき者に成功なし。', author: '吉田松陰' },
  { text: '大切なのは勝つことではなく、戦い抜くことだ。人生に大切なのは成功することではなく、努力し続けることだ。', author: 'クーベルタン' },
  { text: '失敗とは、もう一度やり直すチャンスである。', author: 'ヘンリー・フォード' },
  { text: '過ちて改めざる、これを過ちという。', author: '孔子' },
  { text: '人間は、これまで積み重ねてきたことの集大成である。', author: 'イチロー' },
  { text: '念ずれば花開く。', author: '坂村真民' },
  { text: '凡事徹底。', author: '森信三' },
  { text: '老いてなお、日々新たに学ぶ。', author: 'ソロン' },
  { text: '心が変われば行動が変わる。行動が変われば習慣が変わる。習慣が変われば運命が変わる。', author: 'ウィリアム・ジェームズ' },
  { text: '何があっても、これと思ったことを最後までやり抜くことが大切です。', author: '安藤忠雄' },
  { text: 'あなたの時間は限られている。他人の人生を生きるために無駄にするな。', author: 'スティーブ・ジョブズ' },
]

export function quoteOf(iso: string): Quote | null {
  const date = parseDate(iso)
  if (date.getTime() > parseDate(EXAM_END_DATE).getTime()) return null
  const anchor = parseDate(ANCHOR)
  const dayNumber = Math.round((date.getTime() - anchor.getTime()) / 86400000)
  const index = ((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[index]
}
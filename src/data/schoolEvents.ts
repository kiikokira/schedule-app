// 2年生対象・後期（10月〜3月）の学習・定期試験行事予定表。
// 学校配布のPDFを行事単位に転記した静的データ。
// 月日だけを持ち年を持たないため、どの年度でも「今月」で絞り込める。

export type SchoolEvent = {
  month: number
  day: number
  text: string
}

const EVENTS: SchoolEvent[] = [
  // 10月
  { month: 10, day: 1, text: '中間試験発表' },
  { month: 10, day: 8, text: '中間試験①' },
  { month: 10, day: 9, text: '中間試験②' },
  { month: 10, day: 13, text: '中間試験③' },
  { month: 10, day: 14, text: '中間試験④' },
  { month: 10, day: 17, text: '土曜補習⑦（全学年）' },
  { month: 10, day: 20, text: '2年理数科SFV' },
  { month: 10, day: 21, text: '科目選択用紙提出〆切（1,2年）' },
  { month: 10, day: 22, text: '2年進路講演（6・7コマ）' },
  { month: 10, day: 24, text: '土曜補習⑧（全学年）' },
  { month: 10, day: 26, text: '45分授業×7コマ' },
  { month: 10, day: 27, text: '午前中:45分授業×4コマ' },
  { month: 10, day: 28, text: '午前中:45分授業×4コマ' },
  { month: 10, day: 31, text: 'ベネッセ総合学テ（1・2年）' },
  // 11月
  { month: 11, day: 2, text: '英化週間' },
  { month: 11, day: 4, text: '英化週間' },
  { month: 11, day: 4, text: '校内選考③［作文・面接］' },
  { month: 11, day: 5, text: '英化週間' },
  { month: 11, day: 5, text: '第2回実力テスト［1・2年］' },
  { month: 11, day: 6, text: '英化週間［火曜授業に変更］' },
  { month: 11, day: 7, text: '土曜補習⑨（全学年）' },
  { month: 11, day: 12, text: '2年進路LH②' },
  { month: 11, day: 14, text: '土曜補習⑩（全学年）' },
  { month: 11, day: 17, text: '2年理数科課題研究中間発表会' },
  { month: 11, day: 18, text: '期末試験発表' },
  { month: 11, day: 25, text: '期末試験①' },
  { month: 11, day: 26, text: '期末試験②' },
  { month: 11, day: 27, text: '期末試験③' },
  { month: 11, day: 30, text: '期末試験④' },
  // 12月
  { month: 12, day: 1, text: '期末試験⑤' },
  { month: 12, day: 5, text: '土曜補習⑪（全学年）' },
  { month: 12, day: 8, text: '校内選考委員会④［作文・面接］' },
  { month: 12, day: 9, text: '校内選考委員会④' },
  { month: 12, day: 12, text: '土曜補習⑫（1・2年）' },
  { month: 12, day: 18, text: '金4〜6コマの授業' },
  { month: 12, day: 21, text: '冬期補習前期①' },
  { month: 12, day: 22, text: '冬期補習前期②' },
  { month: 12, day: 23, text: '三者面談' },
  { month: 12, day: 24, text: '三者面談' },
  { month: 12, day: 25, text: '三者面談' },
  { month: 12, day: 26, text: '三者面談' },
  // 1月
  { month: 1, day: 5, text: '冬期補習後期①' },
  { month: 1, day: 6, text: '冬期補習後期②' },
  { month: 1, day: 8, text: '課題テスト' },
  { month: 1, day: 9, text: '土曜補習⑬（1・2年）' },
  { month: 1, day: 14, text: '1,2年普通科総探発表会①' },
  { month: 1, day: 16, text: 'ベネッセ総合学テ（1・2年）' },
  { month: 1, day: 19, text: '校内指導選考会⑤［作文・面接・選考］' },
  { month: 1, day: 21, text: '1,2年普通科総探発表会②' },
  { month: 1, day: 22, text: '追試申込' },
  { month: 1, day: 23, text: '土曜補習⑭（1・2年）' },
  { month: 1, day: 27, text: '追試' },
  { month: 1, day: 28, text: '追試' },
  { month: 1, day: 29, text: '追試' },
  { month: 1, day: 30, text: '土曜補習⑮（2年）' },
  // 2月
  { month: 2, day: 6, text: '土曜補習⑯（1・2年）' },
  { month: 2, day: 6, text: '2年河合共テ模試［希望者］' },
  { month: 2, day: 7, text: '2年河合共テ模試［希望者］' },
  { month: 2, day: 9, text: '土曜補習⑰（1・2年）' },
  { month: 2, day: 10, text: '学年末試験発表' },
  { month: 2, day: 18, text: '学年末試験①' },
  { month: 2, day: 19, text: '学年末試験②' },
  { month: 2, day: 22, text: '学年末試験③' },
  { month: 2, day: 25, text: '学年末試験④' },
  { month: 2, day: 26, text: '学年末試験⑤' },
  { month: 2, day: 27, text: '特別時間割 50分×4コマ' },
  // 3月
  { month: 3, day: 2, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 3, text: '家庭学習' },
  { month: 3, day: 4, text: '家庭学習' },
  { month: 3, day: 5, text: '家庭学習' },
  { month: 3, day: 8, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 8, text: '2年進路LH（学びみらいPASS/PROG-H）' },
  { month: 3, day: 9, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 10, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 11, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 12, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 15, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 15, text: '1・2年「先輩の話を聞く」' },
  { month: 3, day: 16, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 17, text: '特別時間割 50分×4コマ' },
  { month: 3, day: 18, text: '家庭学習' },
  { month: 3, day: 19, text: '1・2年進路講演（1・2コマ）' },
]

export function schoolEventsForMonth(month: number): SchoolEvent[] {
  return EVENTS.filter((e) => e.month === month).sort((a, b) => a.day - b.day)
}

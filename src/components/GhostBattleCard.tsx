type Props = {
  ghostLabel: string
  ghostTotal: number
  youTotal: number
  ghostNow: number
  diff: number
  status: 'prestart' | 'racing' | 'win' | 'lose' | 'tie'
}

export default function GhostBattleCard({ ghostLabel, ghostTotal, youTotal, ghostNow, diff, status }: Props) {
  const badge = status === 'prestart' ? 'まだスタート前' : status === 'win' ? 'ゴースト撃破！' : status === 'lose' ? '惜敗' : status === 'tie' ? 'タイ' : '対戦中'
  const diffText = diff === 0 ? 'イーブン' : diff > 0 ? `+${diff} リード` : `${diff} ビハインド`
  const pct = (v: number) => Math.min(100, Math.max(0, ghostTotal > 0 ? Math.round((v / ghostTotal) * 100) : 0))
  return (
    <section data-testid="ghost-battle" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 800 }}>vs 過去最高ゴースト {ghostLabel} 合計{ghostTotal}</div>
      <div data-testid="ghost-status" style={{ fontSize: 13, fontWeight: 700 }}>{badge}</div>
      <div style={{ fontSize: 14 }}>あなた {youTotal} vs ゴースト {ghostNow}（{diffText}）</div>
      <div style={{ height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 6 }}>
        <div data-testid="ghost-you-bar" style={{ width: `${pct(youTotal)}%`, height: '100%', background: '#3b82f6' }} />
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 4 }}>
        <div data-testid="ghost-rival-bar" style={{ width: `${pct(ghostNow)}%`, height: '100%', background: '#9ca3af' }} />
      </div>
    </section>
  )
}

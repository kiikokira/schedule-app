import { describe, it, expect } from 'vitest'
import {
  parseListPage,
  parseDetailKickoff,
  renderDataFile,
  buildDataFile,
  toJapanMatch,
  resolveHomeAway,
  decideOutcome,
} from './fetch-japan-matches.mjs'

const LIST_FIXTURE = `
#### SAMURAI BLUE
-   Monday, 5 October 2026
-   ![SAMURAI BLUE KIRIN CUP SOCCER 2026](/international_match/img/kirincupsoccer_2026.png)
-   National Stadium
-   -   SAMURAI BLUE
    -   vs
    -   ![New Zealand National Team](/common/img/flag/flag_NZL.png) New Zealand National Team
-   [![詳細はこちら](/eng/international_match/img/btn_special_site.gif)](/eng/samuraiblue/kirincupsoccer_2026/)
`

describe('fetch-japan-matches', () => {
  it('extracts a SAMURAI BLUE block', () => {
    const rows = parseListPage(LIST_FIXTURE)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2026-10-05',
      opponentEn: 'New Zealand',
      competition: 'SAMURAI BLUE KIRIN CUP SOCCER 2026',
      venue: 'National Stadium',
    })
  })
  it('extracts kickoff from a detail page', () => {
    expect(parseDetailKickoff('<div>Monday, 5 October 2026 Kick Off at 19:30</div>')).toBe('19:30')
  })
  it('renders a data file containing JAPAN_MATCHES', () => {
    const out = renderDataFile(
      [
        {
          id: 'x',
          date: '2026-10-05',
          kickoff: '19:30',
          opponent: 'ニュージーランド',
          competition: 'K',
          homeAway: 'home',
        },
      ],
      '2026-10-05T00:00:00+09:00',
    )
    expect(out).toContain('JAPAN_MATCHES')
    expect(out).toContain('2026-10-05')
  })
  it('converts Singapore local time to JST (+1h)', () => {
    expect(
      parseDetailKickoff('<div>Singapore<br>Saturday, 14 November 2026 Kick Off at 18:15(Local Time)</div>'),
    ).toBe('19:15')
  })
  it('maps Brazil raw match to a JapanMatch with vs slug id', () => {
    const m = toJapanMatch(
      {
        date: '2026-11-14',
        opponentEn: 'Brazil',
        competition: 'MIZUHO BLUE CHALLENGE',
        venue: 'Singapore National Stadium',
        detailPath: '/eng/samuraiblue/20261114/',
      },
      '19:15',
    )
    expect(m).toMatchObject({
      id: '2026-11-14-vs-brazil',
      date: '2026-11-14',
      kickoff: '19:15',
      opponent: 'ブラジル',
      homeAway: 'neutral',
    })
  })
  it('throws on an opponent missing from OPPONENT_MAP', () => {
    expect(() =>
      toJapanMatch(
        {
          date: '2026-11-14',
          opponentEn: 'Atlantis',
          competition: 'X',
          venue: 'Tokyo',
          detailPath: null,
        },
        '19:00',
      ),
    ).toThrow(/OPPONENT_MAP/)
  })
  it('resolves home/away/neutral venues', () => {
    expect(resolveHomeAway('National Stadium', 'New Zealand')).toBe('home')
    expect(resolveHomeAway('Singapore National Stadium', 'Brazil')).toBe('neutral')
    expect(resolveHomeAway('Germany / Berlin Stadium', 'Germany')).toBe('away')
  })
  it('refuses to build an empty data file (protects against page staleness)', () => {
    expect(() => buildDataFile([], '2026-10-05T00:00:00+09:00')).toThrow(/no upcoming/)
  })
  it('returns [] for a page with only commented-out past blocks', () => {
    const html = [
      '<html><body>',
      '<!-- <div class="samuraiblue outer-inner"><ul>',
      '<li>Monday, 10 November 2025</li>',
      '</ul></div></div> -->',
      '<div class="other">nadeshiko</div>',
      '</body></html>',
    ].join('\n')
    expect(parseListPage(html)).toEqual([])
  })
  it('keeps data (exit 0 path) when page parses fine but yields zero upcoming', () => {
    const html = [
      '<html><body><h1>SAMURAI BLUE</h1>',
      '<!-- <div class="samuraiblue outer-inner"><ul><li>past</li></ul></div></div> -->',
      '</body></html>',
    ].join('\n')
    expect(decideOutcome([], html)).toMatchObject({ action: 'keep' })
  })
  it('throws when the SAMURAI BLUE section is entirely absent (structure break)', () => {
    expect(() => decideOutcome([], '<html><body><h1>other</h1></body></html>')).toThrow(
      /SAMURAI BLUE/i,
    )
  })
})

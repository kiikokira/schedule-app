import { describe, it, expect } from 'vitest'
import {
  parseListPage,
  parseDetailKickoff,
  renderDataFile,
  buildDataFile,
  toJapanMatch,
  resolveHomeAway,
  decideOutcome,
  isCancelledDetail,
  classifyFixture,
  decideWriteOutcome,
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
  it('detects the explicit cancellation sentence on a detail page', () => {
    expect(isCancelledDetail('*This match has been cancelled. Cancelled More Infomation')).toBe(true)
  })
  it('does not treat navigation text containing Cancelled as a cancellation', () => {
    expect(isCancelledDetail('Menu Cancelled More Infomation Kick Off at 19:30')).toBe(false)
  })
  it('skips a cancelled fixture', () => {
    expect(
      classifyFixture(
        { date: '2026-12-30', opponentEn: null, detailPath: '/eng/samuraiblue/20261230/' },
        '<div>Wednesday, 30 December 2026 This match has been cancelled.</div>',
      ),
    ).toEqual({ action: 'skip', reason: 'cancelled' })
  })
  it('skips a fixture whose kickoff is not published', () => {
    expect(
      classifyFixture(
        { date: '2027-03-25', opponentEn: null, detailPath: '/eng/samuraiblue/20270325/' },
        '<div>Thursday, 25 March 2027 vs TBC Hiroshima</div>',
      ),
    ).toEqual({ action: 'skip', reason: 'kickoff not published' })
  })
  it('skips a fixture whose opponent is still TBC', () => {
    expect(
      classifyFixture(
        { date: '2027-03-25', opponentEn: null, detailPath: '/x/' },
        '<div>Thursday, 25 March 2027 Kick Off at 19:00 vs TBC<br></div>',
      ),
    ).toEqual({ action: 'skip', reason: 'opponent TBC' })
  })
  it('writes a fixture with a published kickoff and known opponent', () => {
    expect(
      classifyFixture(
        { date: '2026-11-14', opponentEn: 'Brazil', detailPath: '/x/' },
        '<div>Saturday, 14 November 2026 Kick Off at 19:15</div>',
      ),
    ).toEqual({ action: 'write', kickoff: '19:15', opponentEn: 'Brazil' })
  })
  it('keeps existing data when every upcoming fixture was skipped', () => {
    expect(decideWriteOutcome([], 3)).toMatchObject({ action: 'keep' })
  })
  it('writes data when at least one fixture is available', () => {
    expect(decideWriteOutcome([{ id: 'x' }], 2)).toEqual({ action: 'write' })
  })
  it('ignores a kickoff that appears only inside an HTML comment', () => {
    expect(
      classifyFixture(
        { date: '2027-03-25', opponentEn: null, detailPath: '/x/' },
        '<div>Thursday, 25 March 2027 <!--Kick Off at 19:25(estimated time)--> vs TBC<br></div>',
      ),
    ).toEqual({ action: 'skip', reason: 'kickoff not published' })
  })
  it('ignores an opponent named only inside a commented-out navigation link', () => {
    expect(
      classifyFixture(
        { date: '2027-03-25', opponentEn: null, detailPath: '/x/' },
        '<div>Thursday, 25 March 2027 Kick Off at 19:25 <!-- Japan vs Korea university regular football match --> vs TBC<br></div>',
      ),
    ).toEqual({ action: 'skip', reason: 'opponent TBC' })
  })
})

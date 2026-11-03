import type { MoveState } from '../lib/rpgMovement'

type Props = {
  anim: MoveState
  facing: 1 | -1
}

// オリジナルキャラクター「ソラ」：ミント色フードの旅人。絵文字・既存作品の模倣は使わない。
// 頭・顔・目・胴体・腕・手・脚・足・マフラー・リュックで構成する。
export default function RpgCharacter({ anim, facing }: Props) {
  const cls =
    anim === 'RUN' ? 'rpgc-run'
    : anim === 'WALK' || anim === 'SLOPE_UP' || anim === 'SLOPE_DOWN' || anim === 'STAIRS_UP' || anim === 'STAIRS_DOWN'
      ? 'rpgc-walk'
    : anim === 'LADDER_UP' || anim === 'LADDER_DOWN'
      ? 'rpgc-ladder'
    : anim === 'JUMP_ASCEND' || anim === 'JUMP_AIR' || anim === 'JUMP_DESCEND' || anim === 'FALL'
      ? 'rpgc-jump'
    : anim === 'SWIM' || anim === 'SWIM_ENTER' || anim === 'SWIM_EXIT'
      ? 'rpgc-swim'
    : anim === 'LAND'
      ? 'rpgc-land'
    : 'rpgc-idle'
  return (
    <svg
      data-testid="rpg-char"
      data-anim={anim}
      viewBox="0 0 64 76"
      width="56"
      height="66"
      role="img"
      aria-label="旅人ソラ"
      style={{ transform: `scaleX(${facing})`, overflow: 'visible' }}
    >
      <g className={cls}>
        {/* 脚 */}
        <g className="rpgc-leg-l">
          <rect x="24" y="52" width="8" height="16" rx="4" fill="#4a3b5c" />
          <ellipse cx="28" cy="69" rx="7" ry="3.4" fill="#3a2f4a" />
        </g>
        <g className="rpgc-leg-r">
          <rect x="34" y="52" width="8" height="16" rx="4" fill="#5a4a6e" />
          <ellipse cx="38" cy="69" rx="7" ry="3.4" fill="#3a2f4a" />
        </g>
        {/* 胴体 */}
        <rect x="21" y="34" width="24" height="22" rx="9" fill="#3ec6a8" />
        <rect x="21" y="34" width="24" height="22" rx="9" fill="none" stroke="#1e7a66" strokeWidth="2.4" />
        {/* リュック */}
        <rect x="41" y="37" width="10" height="14" rx="4" fill="#b07a3f" stroke="#7a4e22" strokeWidth="2" />
        {/* 腕 */}
        <g className="rpgc-arm-l">
          <rect x="14" y="37" width="8" height="14" rx="4" fill="#35a78d" stroke="#1e7a66" strokeWidth="2" />
          <circle cx="18" cy="52" r="4" fill="#ffd9b3" />
        </g>
        <g className="rpgc-arm-r">
          <rect x="44" y="37" width="8" height="14" rx="4" fill="#35a78d" stroke="#1e7a66" strokeWidth="2" />
          <circle cx="48" cy="52" r="4" fill="#ffd9b3" />
        </g>
        {/* 頭・フード */}
        <circle cx="33" cy="22" r="13" fill="#3ec6a8" stroke="#1e7a66" strokeWidth="2.4" />
        <circle cx="33" cy="24" r="8.6" fill="#ffd9b3" />
        {/* 目 */}
        <circle cx="29.6" cy="23.4" r="1.7" fill="#22303c" />
        <circle cx="36.4" cy="23.4" r="1.7" fill="#22303c" />
        <circle cx="30.1" cy="22.9" r="0.55" fill="#fff" />
        <circle cx="36.9" cy="22.9" r="0.55" fill="#fff" />
        {/* ほほ */}
        <circle cx="27.4" cy="27" r="1.9" fill="#ffb3a0" opacity="0.8" />
        <circle cx="38.6" cy="27" r="1.9" fill="#ffb3a0" opacity="0.8" />
        {/* マフラー */}
        <g className="rpgc-scarf">
          <rect x="22" y="32" width="22" height="6" rx="3" fill="#f2b134" stroke="#b97f14" strokeWidth="1.6" />
          <rect x="40" y="35" width="6" height="12" rx="3" fill="#f2b134" stroke="#b97f14" strokeWidth="1.6" />
        </g>
        {/* 髪の毛束（フードから） */}
        <circle cx="42" cy="26" r="3.4" fill="#6b4a2f" />
      </g>
    </svg>
  )
}

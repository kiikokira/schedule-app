# Carousel (Home NOW/NEXT下・今日の続きキュー) Short Design — 2026-11-23

## intent / why
ホーム画面のNOW・NEXTの下に、今日の続き（3番目以降の予定）を自動再生カルーセルで見せる。見落としの防止と、縦長のホームを伸ばさずに複数冊へ導く。

## goals
- NOW・NEXTの下・ランキングの上に配置する
- 一定時間ごとに自動切替する（既定5秒・ループ）
- 左右矢印で手動切替できる
- 下部ドットで位置を示し、ドット操作でも移動できる
- スマホのスワイプ（touch）に対応する
- カード内容：表紙＋タイトル＋期限＋進捗%（既存予定データを流用）

## non-goals
- 外部カルーセルライブラリの導入はしない
- 既存ブロック（カウントダウン／名言／ランキング等）の整理・移動はしない
- 汎用バナー／お知らせ管理機能は作らない

## anti-goals
- ランキングやスケジュールを大きく押し下げて見づらくしない
- 360px幅ではみ出し・折返し崩れを起こさない
- 自動再生で操作性を損なわない（hover/focus/touch中は一時停止、reduced-motion配慮）

## constraints
- React 18 + Vite + TS、既存 `CoverImage` 再利用、`styles.css` 追記、vitest追加
- 新規依存なし、PWA/オフラインを壊さない
- a11y：矢印・ドットはbutton、aria-label、キーボード操作可

## approaches
- 方式1（採用）：自作の軽量カルーセル `src/components/Carousel.tsx`。依存増なし・調整しやすい。スワイプはtouchイベントで判定。
- 方式2：Embla/Swiper導入。滑らかだが依存・バンドル増で過剰のため不採用。
- 方式3：CSS scroll-snapのみ。自動再生・ドット同期が煩雑のため不採用。

## decided (partner決定済み)
- 置き場所：NOW・NEXTの下
- 内容：案A「今日の続きキュー」
- 作り方：方式1 自作

## builderに残すこと（提案・要承認）
- `Carousel` は汎用（items＋render＋autoPlayInterval）＋ `HomeQueueCarousel` 的な薄い結合を想定
- 空・1件時はカルーセル非表示またはドット／矢印なしの1枚表示
- test-id案：`home-queue-carousel`, `carousel-prev/next`, `carousel-dot-N`
- 自動再生の既定・停止条件・スワイプ閾値は実装時に定数化

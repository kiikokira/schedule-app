export type TodayProgressItem = {
  bookId: string;
  title: string;
  done: number;
  target: number;
  unit: string;
};

export function calcPct(done: number, target: number): number {
  if (target <= 0) return 0;
  const pct = Math.round((done / target) * 100);
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

const SIZE = 64;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TodayProgressDonuts({
  items,
}: {
  items: TodayProgressItem[];
}): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <section data-testid="today-progress-donuts">
      {items.map((item) => {
        const pct = calcPct(item.done, item.target);
        const remaining = Math.max(item.target - item.done, 0);
        const doneLength = (pct / 100) * CIRCUMFERENCE;
        const frontColor = pct >= 100 ? '#22c55e' : '#3b82f6';
        return (
          <div key={item.bookId} data-testid={`today-progress-${item.bookId}`}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={STROKE}
              />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={frontColor}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${doneLength} ${CIRCUMFERENCE}`}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
              <text
                data-testid={`today-progress-pct-${item.bookId}`}
                x={SIZE / 2}
                y={SIZE / 2}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {`${pct}%`}
              </text>
            </svg>
            <div>{item.title}</div>
            <div>{`あと${remaining}${item.unit}`}</div>
          </div>
        );
      })}
    </section>
  );
}

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  type TooltipItem,
} from 'chart.js'
import type { MockRecord } from '../lib/mockHistory'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

export default function MockHistoryChart({ history }: { history: MockRecord[] }) {
  const data = {
    labels: history.map((h) => h.ym),
    datasets: [
      {
        label: '仮想模試 偏差値',
        data: history.map((h) => h.deviation),
        borderColor: '#3f56a8',
        backgroundColor: '#3f56a8',
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHitRadius: 20,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false },
    plugins: {
      tooltip: {
        padding: 12,
        displayColors: false,
        callbacks: { label: (context: TooltipItem<'line'>) => ` 偏差値${context.parsed.y ?? 0}` },
      },
    },
  }
  return (
    <div data-testid="mock-history-chart" style={{ height: 200 }}>
      <Line data={data} options={options} />
    </div>
  )
}

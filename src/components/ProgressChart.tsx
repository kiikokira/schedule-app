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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

type Props = {
  dates: string[]
  values: number[]
}

export function buildProgressChartConfig(dates: string[], values: number[]) {
  const dataset = {
    label: '1日当たりのページ数',
    data: values,
    borderColor: '#3f56a8',
    backgroundColor: '#3f56a8',
    borderWidth: 3,
    pointRadius: 5,
    pointHoverRadius: 8,
    pointHitRadius: 20,
  }
  const data = {
    labels: dates,
    datasets: [dataset],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
    plugins: {
      tooltip: {
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'line'>) => ` ${context.parsed.y ?? 0}ページ`,
        },
      },
    },
  }
  return { data, dataset, options }
}

export default function ProgressChart({ dates, values }: Props) {
  const { data, options } = buildProgressChartConfig(dates, values)
  return (
    <div data-testid="progress-chart" style={{ height: 220 }}>
      <Line data={data} options={options} />
    </div>
  )
}
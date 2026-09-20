import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

type Props = {
  dates: string[]
  values: number[]
}

export default function ProgressChart({ dates, values }: Props) {
  return (
    <div data-testid="progress-chart" style={{ height: 200 }}>
      <Line
        data={{
          labels: dates,
          datasets: [
            {
              label: '1日当たりのページ数',
              data: values,
              borderColor: '#5a74c9',
              backgroundColor: '#5a74c9',
            },
          ],
        }}
        options={{ responsive: true, maintainAspectRatio: false }}
      />
    </div>
  )
}
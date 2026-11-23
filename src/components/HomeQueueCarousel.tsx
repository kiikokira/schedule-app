import Carousel from './Carousel'
import CoverImage from './CoverImage'

export type QueueItem = {
  key: string
  title: string
  cover: string | null
  meta: string
  progressPct: number
}

type Props = {
  items: QueueItem[]
}

export default function HomeQueueCarousel({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-testid="home-queue-carousel" className="home-queue-carousel">
      <Carousel
        itemCount={items.length}
        renderItem={(index) => {
          const item = items[index]
          const titleId = `queue-card-title-${item.key}`
          const progressValue = Math.round(item.progressPct)
          return (
            <div className="queue-card">
              <CoverImage src={item.cover} width={64} height={90} />
              <div className="queue-card-body">
                <p id={titleId} className="queue-card-title">{item.title}</p>
                <p className="queue-card-meta">{item.meta}</p>
                <div
                  className="queue-card-progress"
                  role="progressbar"
                  aria-labelledby={titleId}
                  aria-valuenow={progressValue}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${progressValue}% 完了`}
                >
                  <div style={{ width: `${item.progressPct}%` }} />
                </div>
                <p className="queue-card-progress-label">{Math.round(item.progressPct)}%</p>
              </div>
            </div>
          )
        }}
        ariaLabel="今日の続き"
      />
    </section>
  )
}

import { render, screen } from '@testing-library/react';
import TodayProgressDonuts, { calcPct } from './TodayProgressDonuts';

it('caps pct and handles zero target', () => {
  expect(calcPct(30, 100)).toBe(30);
  expect(calcPct(150, 100)).toBe(100);
  expect(calcPct(10, 0)).toBe(0);
});

it('renders donuts with remaining', () => {
  render(<TodayProgressDonuts items={[
    { bookId: 'b1', title: 'LEAP', done: 30, target: 100, unit: '語' },
  ]} />);
  expect(screen.getByTestId('today-progress-donuts')).toBeInTheDocument();
  expect(screen.getByTestId('today-progress-b1')).toHaveTextContent('あと70語');
  expect(screen.getByTestId('today-progress-pct-b1')).toHaveTextContent('30%');
});

it('lays out donuts side by side without title overlap', () => {
  render(<TodayProgressDonuts items={[
    { bookId: 'b1', title: '改訂版 必携 英単語 LEAP', done: 0, target: 5190, unit: '語' },
    { bookId: 'b2', title: '英文法ポラリス2（応用レベル）', done: 0, target: 1, unit: 'ページ' },
  ]} />);
  const section = screen.getByTestId('today-progress-donuts');
  expect(section.style.display).toBe('flex');
  expect(section.style.flexWrap).toBe('wrap');
  for (const id of ['b1', 'b2']) {
    const item = screen.getByTestId(`today-progress-${id}`);
    expect(item.style.minWidth).toBe('0');
  }
  const title = screen.getByTestId('today-progress-title-b1');
  expect(title.style.overflowWrap).toBe('anywhere');
});

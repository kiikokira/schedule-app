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

// src/components/CampusQuestBoard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CampusQuestBoard from './CampusQuestBoard'

describe('CampusQuestBoard', () => {
  it('shows up to 4 slots', () => {
    render(<CampusQuestBoard slots={[{title:'A',bookId:'b1'},{title:'B',bookId:null},{title:'C',bookId:'b3'},{title:'D',bookId:null},{title:'E',bookId:null}]} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" />)
    expect(screen.getByTestId('campus-slots').children.length).toBe(4)
  })
  it('empty shows library self-study', () => {
    render(<CampusQuestBoard slots={[]} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" />)
    expect(screen.getByTestId('campus-empty')).toBeTruthy()
  })
  it('done shows observatory celebration and fixed bulletin', () => {
    render(<CampusQuestBoard slots={[{title:'A',bookId:'b1'}]} slotsDone={true} onOpenToday={()=>{}} onOpenBook={()=>{}} todayLabel="今日" bulletin="入試まで439日・模試締切11/30・連続12日" />)
    expect(screen.getByTestId('campus-done')).toBeTruthy()
    expect(screen.getByTestId('campus-bulletin')).toBeTruthy()
  })
})

// 参考書DBに存在しない「テスト勉強」枠の識別子。
// PlanSlot.bookId や AvailabilitySlot.bookId に保存してよい。
export const TEST_STUDY_ID = '__test_study__'
export const TEST_STUDY_LABEL = 'テスト勉強'

export function isTestStudyId(id: string | null | undefined): boolean {
  return id === TEST_STUDY_ID
}

export function planBookTitle(
  bookId: string,
  book: { title: string } | undefined,
): string {
  if (isTestStudyId(bookId)) return TEST_STUDY_LABEL
  return book?.title ?? bookId
}

import { useState } from 'react'

const LIMIT = 120

export default function LongText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (text.length <= LIMIT) return <>{text}</>
  return (
    <>
      {open ? text : `${text.slice(0, LIMIT)}…`}
      <button
        data-testid="msg-expand"
        type="button"
        style={{ marginLeft: 8, fontSize: 13 }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '閉じる' : '開く'}
      </button>
    </>
  )
}

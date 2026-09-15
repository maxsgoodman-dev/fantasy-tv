'use client'

export function DeleteButton({
  confirmText,
  label = 'Delete',
}: {
  confirmText: string
  label?: string
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault()
        }
      }}
      className="rounded border border-red-600 px-2 py-1 text-sm font-medium text-red-600"
    >
      {label}
    </button>
  )
}

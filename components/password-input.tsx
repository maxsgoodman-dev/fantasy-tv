'use client'

import { useState } from 'react'

export function PasswordInput({
  name,
  placeholder,
  required,
  minLength,
}: {
  name: string
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full rounded border p-2 pr-16"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-600"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

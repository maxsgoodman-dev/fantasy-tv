export function Avatar({
  url,
  name,
  size = 32,
}: {
  url: string | null | undefined
  name: string | null | undefined
  size?: number
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?'
  const style = { width: size, height: size }

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name ?? 'Avatar'} style={style} className="rounded-full object-cover" />
    )
  }

  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full bg-fuchsia-200 font-bold text-fuchsia-700"
    >
      {initial}
    </div>
  )
}

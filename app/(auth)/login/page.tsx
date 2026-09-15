import { login } from './actions'

export default function LoginPage() {
  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        await login(formData)
      }}
      className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4"
    >
      <h1 className="text-2xl font-bold">Log in</h1>
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <input name="password" type="password" placeholder="Password" required className="rounded border p-2" />
      <button type="submit" className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        Log in
      </button>
    </form>
  )
}

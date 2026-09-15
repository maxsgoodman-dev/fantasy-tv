import { signup } from './actions'

export default function SignupPage() {
  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        await signup(formData)
      }}
      className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4"
    >
      <h1 className="text-2xl font-bold">Sign up for Fantasy TV</h1>
      <input name="displayName" placeholder="Display name" required className="rounded border p-2" />
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <input name="password" type="password" placeholder="Password" required minLength={8} className="rounded border p-2" />
      <button type="submit" className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        Sign up
      </button>
    </form>
  )
}

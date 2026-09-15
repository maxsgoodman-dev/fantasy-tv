import { createClient } from '@/lib/supabase/server'
import { uploadAvatar } from './actions'
import { Avatar } from '@/components/avatar'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user!.id)
    .single()

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Your profile</h1>
      <div className="flex items-center gap-4">
        <Avatar url={profile?.avatar_url} name={profile?.display_name} size={64} />
        <span className="font-semibold">{profile?.display_name}</span>
      </div>
      <form
        action={async (formData: FormData) => {
          'use server'
          await uploadAvatar(formData)
        }}
        className="flex flex-col gap-2"
      >
        <input type="file" name="avatar" accept="image/*" required className="text-sm" />
        <button
          type="submit"
          className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Upload avatar
        </button>
      </form>
    </div>
  )
}

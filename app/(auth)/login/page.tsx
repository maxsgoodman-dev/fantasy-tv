import { LoginForm } from './login-form'

const NOTICES: Record<string, { tone: 'green' | 'amber'; text: string }> = {
  confirmed: { tone: 'green', text: 'Your email is confirmed. Log in to get started.' },
  'link-expired': {
    tone: 'amber',
    text: 'That link has expired or was already used. If you already confirmed your email, just log in. Can’t remember your password? Use “Forgot password?” below.',
  },
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const { notice, error } = await searchParams
  const key = notice ?? (error === 'confirmation_failed' ? 'link-expired' : undefined)
  return <LoginForm notice={key ? NOTICES[key] : undefined} />
}

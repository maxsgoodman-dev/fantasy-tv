import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder')

// Must match a sender verified in Resend (and configured as Supabase's
// custom SMTP sender) or sends will fail/bounce.
export const EMAIL_FROM = 'Fantasy TV <FantasyTV@bedextrous.com>'

# Fantasy TV v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working v1 of Fantasy TV — a multi-tenant webapp for reality-TV fantasy leagues supporting both weekly-vote and bracket-style tournaments, with admin-driven results (manual or transcript-assisted) and per-league standings.

**Architecture:** Next.js 15 App Router (TypeScript) as a single deployable app on Vercel, Supabase for Postgres + Auth with Row Level Security, a pure-function scoring engine (`lib/scoring/*`) unit-tested independent of the database, and server actions for all writes so lock-time and role checks are enforced server-side.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest, Zod, Resend, Vercel AI SDK + AI Gateway (Claude) for transcript parsing.

**Scope note:** Per the spec, bracket matchup winners are recorded by the admin directly (a "post this round's result" action in the bracket admin UI), the same way weekly episode results are admin-entered. This is the concrete implementation of "results come from real-world outcomes the admin posts, not member votes" for both formats — brackets don't derive winners from `episode_events` automatically in v1, since that would require generically correlating free-text event types to specific matchups, which is unnecessary complexity for a first version. Both formats still ultimately trace back to the admin attesting to a real-world result.

---

## File Structure

```
fantasy-tv/
  app/
    (auth)/login/page.tsx
    (auth)/signup/page.tsx
    (app)/layout.tsx                       # authenticated shell, fetches profile
    (app)/dashboard/page.tsx               # member's leagues + join form
    (app)/leagues/[leagueId]/page.tsx      # league home: standings + picks/bracket
    (app)/leagues/[leagueId]/actions.ts    # server actions: join, submit picks, submit bracket
    (admin)/admin/layout.tsx               # admin-only guard
    (admin)/admin/shows/page.tsx
    (admin)/admin/shows/actions.ts
    (admin)/admin/seasons/[seasonId]/page.tsx
    (admin)/admin/seasons/actions.ts
    (admin)/admin/episodes/[episodeId]/page.tsx   # results entry (manual + transcript)
    (admin)/admin/episodes/actions.ts
    (admin)/admin/leagues/new/page.tsx
    (admin)/admin/leagues/actions.ts
    (admin)/admin/leagues/[leagueId]/bracket/page.tsx
    (admin)/admin/leagues/[leagueId]/bracket/actions.ts
    api/cron/lock-reminders/route.ts       # Vercel Cron endpoint
  lib/
    supabase/server.ts
    supabase/client.ts
    supabase/middleware.ts
    scoring/types.ts
    scoring/weekly.ts
    scoring/weekly.test.ts
    scoring/bracket.ts
    scoring/bracket.test.ts
    email/resend.ts
    email/templates.ts
    ai/parse-transcript.ts
    auth/require-admin.ts
  supabase/migrations/0001_init.sql
  middleware.ts
  vitest.config.ts
  .env.local.example
```

---

## Task 0: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `vitest.config.ts`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm --yes
```

- [ ] **Step 2: Install project dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod resend ai @ai-sdk/anthropic
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Add Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add npm test script**

Edit `package.json` scripts block to add:
```json
"test": "vitest run"
```

- [ ] **Step 5: Add env template**

`.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
AI_GATEWAY_API_KEY=
CRON_SECRET=
```

- [ ] **Step 6: Verify dev server boots**

Run: `npm run build`
Expected: build completes with no errors (default starter page).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Supabase, Vitest deps"
```

---

## Task 1: Database Schema & RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the full schema migration**

`supabase/migrations/0001_init.sql`:
```sql
-- Profiles ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- Shows / Seasons / Contestants / Episodes --------------------------------
create table shows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references shows(id) on delete cascade,
  name text not null,
  year int,
  created_at timestamptz not null default now()
);

create table contestants (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  episode_number int not null,
  air_date timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'aired', 'results_posted')),
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create table episode_events (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  event_type text not null,
  contestant_id uuid references contestants(id),
  description text,
  created_at timestamptz not null default now()
);

create table transcript_uploads (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  raw_text text not null,
  suggested_events jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  uploaded_by uuid references profiles(id),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Leagues ------------------------------------------------------------------
create table leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  name text not null,
  format text not null check (format in ('bracket', 'weekly_vote')),
  scoring_config jsonb not null default '{}'::jsonb,
  join_code text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create function is_league_member(p_league_id uuid) returns boolean as $$
  select exists (
    select 1 from league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$ language sql stable security definer;

create function join_league_by_code(p_code text) returns uuid as $$
declare
  v_league_id uuid;
begin
  select id into v_league_id from leagues where join_code = p_code;
  if v_league_id is null then
    raise exception 'invalid join code';
  end if;
  insert into league_members (league_id, user_id)
  values (v_league_id, auth.uid())
  on conflict do nothing;
  return v_league_id;
end;
$$ language plpgsql security definer;

-- Weekly vote format ---------------------------------------------------------
create table weekly_questions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  episode_id uuid not null references episodes(id),
  question_text text not null,
  event_type_target text not null,
  point_value int not null default 1,
  lock_at timestamptz not null,
  resolved_at timestamptz,
  resolved_correct_contestant_id uuid references contestants(id),
  created_at timestamptz not null default now()
);

create table member_picks (
  id uuid primary key default gen_random_uuid(),
  weekly_question_id uuid not null references weekly_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  picked_contestant_id uuid not null references contestants(id),
  is_correct boolean,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (weekly_question_id, user_id)
);

-- Bracket format -------------------------------------------------------------
create table bracket_matchups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  round int not null,
  matchup_index int not null,
  contestant_a_id uuid references contestants(id),
  contestant_b_id uuid references contestants(id),
  winner_id uuid references contestants(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, round, matchup_index)
);

create table member_bracket_picks (
  id uuid primary key default gen_random_uuid(),
  matchup_id uuid not null references bracket_matchups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  predicted_winner_id uuid not null references contestants(id),
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (matchup_id, user_id)
);

-- RLS --------------------------------------------------------------------
alter table profiles enable row level security;
alter table shows enable row level security;
alter table seasons enable row level security;
alter table contestants enable row level security;
alter table episodes enable row level security;
alter table episode_events enable row level security;
alter table transcript_uploads enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table weekly_questions enable row level security;
alter table member_picks enable row level security;
alter table bracket_matchups enable row level security;
alter table member_bracket_picks enable row level security;

create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

create policy "content_select_all_authenticated" on shows for select using (auth.uid() is not null);
create policy "content_admin_write" on shows for all using (is_admin()) with check (is_admin());

create policy "seasons_select_all_authenticated" on seasons for select using (auth.uid() is not null);
create policy "seasons_admin_write" on seasons for all using (is_admin()) with check (is_admin());

create policy "contestants_select_all_authenticated" on contestants for select using (auth.uid() is not null);
create policy "contestants_admin_write" on contestants for all using (is_admin()) with check (is_admin());

create policy "episodes_select_all_authenticated" on episodes for select using (auth.uid() is not null);
create policy "episodes_admin_write" on episodes for all using (is_admin()) with check (is_admin());

create policy "episode_events_select_all_authenticated" on episode_events for select using (auth.uid() is not null);
create policy "episode_events_admin_write" on episode_events for all using (is_admin()) with check (is_admin());

create policy "transcript_uploads_admin_only" on transcript_uploads for all using (is_admin()) with check (is_admin());

create policy "leagues_select_member_or_admin" on leagues for select
  using (is_league_member(id) or is_admin());
create policy "leagues_admin_write" on leagues for all using (is_admin()) with check (is_admin());

create policy "league_members_select_own_or_admin" on league_members for select
  using (user_id = auth.uid() or is_admin());
create policy "league_members_admin_write" on league_members for all using (is_admin()) with check (is_admin());

create policy "weekly_questions_select_member_or_admin" on weekly_questions for select
  using (is_league_member(league_id) or is_admin());
create policy "weekly_questions_admin_write" on weekly_questions for all using (is_admin()) with check (is_admin());

create policy "member_picks_select_own_league_or_admin" on member_picks for select
  using (
    user_id = auth.uid() or is_admin() or
    exists (select 1 from weekly_questions wq where wq.id = weekly_question_id and is_league_member(wq.league_id))
  );
create policy "member_picks_insert_own_before_lock" on member_picks for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from weekly_questions wq
      where wq.id = weekly_question_id
        and is_league_member(wq.league_id)
        and wq.lock_at > now()
    )
  );
create policy "member_picks_update_own_before_lock" on member_picks for update
  using (
    user_id = auth.uid()
    and exists (select 1 from weekly_questions wq where wq.id = weekly_question_id and wq.lock_at > now())
  );
create policy "member_picks_admin_all" on member_picks for all using (is_admin()) with check (is_admin());

create policy "bracket_matchups_select_member_or_admin" on bracket_matchups for select
  using (is_league_member(league_id) or is_admin());
create policy "bracket_matchups_admin_write" on bracket_matchups for all using (is_admin()) with check (is_admin());

create policy "member_bracket_picks_select_own_league_or_admin" on member_bracket_picks for select
  using (
    user_id = auth.uid() or is_admin() or
    exists (select 1 from bracket_matchups bm where bm.id = matchup_id and is_league_member(bm.league_id))
  );
create policy "member_bracket_picks_insert_own" on member_bracket_picks for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bracket_matchups bm
      where bm.id = matchup_id and is_league_member(bm.league_id) and bm.winner_id is null
    )
  );
create policy "member_bracket_picks_update_own" on member_bracket_picks for update
  using (
    user_id = auth.uid()
    and exists (select 1 from bracket_matchups bm where bm.id = matchup_id and bm.winner_id is null)
  );
create policy "member_bracket_picks_admin_all" on member_bracket_picks for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use the Supabase MCP `apply_migration` tool (name: `init`, the SQL above), or if working purely from the CLI:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

- [ ] **Step 3: Verify tables exist**

Use the Supabase MCP `list_tables` tool, or:
```bash
supabase db remote list
```
Expected: all 13 tables listed (`profiles`, `shows`, `seasons`, `contestants`, `episodes`, `episode_events`, `transcript_uploads`, `leagues`, `league_members`, `weekly_questions`, `member_picks`, `bracket_matchups`, `member_bracket_picks`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial database schema and RLS policies"
```

---

## Task 2: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

- [ ] **Step 1: Browser client**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Server client**

`lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // called from a Server Component; ignore, middleware refreshes sessions
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Auth-refresh middleware**

`middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase middleware.ts
git commit -m "feat: add Supabase browser/server clients and auth middleware"
```

---

## Task 3: Auth Pages (Signup / Login / Logout)

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`, `app/(auth)/signup/page.tsx`, `app/(auth)/signup/actions.ts`, `app/(app)/layout.tsx`, `app/(app)/actions.ts`

- [ ] **Step 1: Signup server action**

`app/(auth)/signup/actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50),
})

export async function signup(formData: FormData) {
  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  })
  if (error) {
    return { error: error.message }
  }
  redirect('/dashboard')
}
```

- [ ] **Step 2: Signup page**

`app/(auth)/signup/page.tsx`:
```tsx
import { signup } from './actions'

export default function SignupPage() {
  return (
    <form action={signup} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
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
```

- [ ] **Step 3: Login server action**

`app/(auth)/login/actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }
  redirect('/dashboard')
}
```

- [ ] **Step 4: Login page**

`app/(auth)/login/page.tsx`:
```tsx
import { login } from './actions'

export default function LoginPage() {
  return (
    <form action={login} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Log in</h1>
      <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
      <input name="password" type="password" placeholder="Password" required className="rounded border p-2" />
      <button type="submit" className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        Log in
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Authenticated layout + logout action**

`app/(app)/actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

`app/(app)/layout.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from './actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <header className="flex items-center justify-between bg-fuchsia-700 p-4 text-white">
        <span className="font-bold">Fantasy TV</span>
        <div className="flex items-center gap-4">
          <span>{profile?.display_name}</span>
          {profile?.role === 'admin' && <a href="/admin/shows">Admin</a>}
          <form action={logout}>
            <button type="submit">Log out</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add app/\(auth\) app/\(app\)
git commit -m "feat: add signup, login, and authenticated app shell"
```

---

## Task 4: Promote First Admin (manual step, documented)

**Files:**
- Create: `docs/superpowers/plans/README-first-admin.md`

- [ ] **Step 1: Document the manual promotion step**

`docs/superpowers/plans/README-first-admin.md`:
```markdown
# Promoting the first admin

v1 has no UI for role management. After you sign up for the first time, promote
your own account to admin by running this SQL against the Supabase project
(via the SQL editor or the `execute_sql` MCP tool):

    update profiles set role = 'admin' where id = (
      select id from auth.users where email = 'YOUR_EMAIL_HERE'
    );
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/README-first-admin.md
git commit -m "docs: document manual first-admin promotion step"
```

---

## Task 5: Admin Guard

**Files:**
- Create: `lib/auth/require-admin.ts`, `app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Shared admin-check helper**

`lib/auth/require-admin.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')
  return { supabase, userId: user.id }
}
```

- [ ] **Step 2: Admin layout using the guard**

`app/(admin)/admin/layout.tsx`:
```tsx
import { requireAdmin } from '@/lib/auth/require-admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div>
      <nav className="flex gap-4 border-b p-4">
        <a href="/admin/shows">Shows</a>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/auth app/\(admin\)/admin/layout.tsx
git commit -m "feat: add admin route guard"
```

---

## Task 6: Admin — Shows, Seasons, Contestants, Episodes CRUD

**Files:**
- Create: `app/(admin)/admin/shows/page.tsx`, `app/(admin)/admin/shows/actions.ts`
- Create: `app/(admin)/admin/seasons/[seasonId]/page.tsx`, `app/(admin)/admin/seasons/actions.ts`
- Create: `app/(admin)/admin/episodes/actions.ts`

- [ ] **Step 1: Shows list + create action**

`app/(admin)/admin/shows/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function createShow(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const description = String(formData.get('description') ?? '')
  await supabase.from('shows').insert({ name, description })
  revalidatePath('/admin/shows')
}

export async function createSeason(showId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const year = Number(formData.get('year')) || null
  await supabase.from('seasons').insert({ show_id: showId, name, year })
  revalidatePath('/admin/shows')
}
```

`app/(admin)/admin/shows/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { createShow, createSeason } from './actions'

export default async function ShowsPage() {
  const supabase = await createClient()
  const { data: shows } = await supabase
    .from('shows')
    .select('id, name, seasons(id, name, year)')
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <form action={createShow} className="flex gap-2">
        <input name="name" placeholder="Show name" required className="rounded border p-2" />
        <input name="description" placeholder="Description" className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add show</button>
      </form>

      {shows?.map((show) => (
        <div key={show.id} className="rounded border p-4">
          <h2 className="text-xl font-bold">{show.name}</h2>
          <ul className="my-2 list-disc pl-6">
            {show.seasons?.map((season) => (
              <li key={season.id}>
                <a className="underline" href={`/admin/seasons/${season.id}`}>
                  {season.name} {season.year}
                </a>
              </li>
            ))}
          </ul>
          <form action={createSeason.bind(null, show.id)} className="flex gap-2">
            <input name="name" placeholder="Season name" required className="rounded border p-2" />
            <input name="year" type="number" placeholder="Year" className="rounded border p-2" />
            <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add season</button>
          </form>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Season detail page (contestants + episodes)**

`app/(admin)/admin/seasons/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function addContestant(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name'))
  const bio = String(formData.get('bio') ?? '')
  await supabase.from('contestants').insert({ season_id: seasonId, name, bio })
  revalidatePath(`/admin/seasons/${seasonId}`)
}

export async function addEpisode(seasonId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const episodeNumber = Number(formData.get('episodeNumber'))
  const airDate = String(formData.get('airDate'))
  await supabase.from('episodes').insert({
    season_id: seasonId,
    episode_number: episodeNumber,
    air_date: airDate,
  })
  revalidatePath(`/admin/seasons/${seasonId}`)
}
```

`app/(admin)/admin/seasons/[seasonId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { addContestant, addEpisode } from '../actions'

export default async function SeasonPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const supabase = await createClient()
  const [{ data: contestants }, { data: episodes }] = await Promise.all([
    supabase.from('contestants').select('id, name').eq('season_id', seasonId).order('name'),
    supabase.from('episodes').select('id, episode_number, air_date, status').eq('season_id', seasonId).order('episode_number'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-xl font-bold">Cast</h2>
        <ul className="list-disc pl-6">
          {contestants?.map((c) => <li key={c.id}>{c.name}</li>)}
        </ul>
        <form action={addContestant.bind(null, seasonId)} className="mt-2 flex gap-2">
          <input name="name" placeholder="Contestant name" required className="rounded border p-2" />
          <input name="bio" placeholder="Bio" className="rounded border p-2" />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold">Episodes</h2>
        <ul className="list-disc pl-6">
          {episodes?.map((e) => (
            <li key={e.id}>
              <a className="underline" href={`/admin/episodes/${e.id}`}>
                Ep. {e.episode_number} — {new Date(e.air_date).toLocaleDateString()} ({e.status})
              </a>
            </li>
          ))}
        </ul>
        <form action={addEpisode.bind(null, seasonId)} className="mt-2 flex gap-2">
          <input name="episodeNumber" type="number" placeholder="#" required className="w-16 rounded border p-2" />
          <input name="airDate" type="datetime-local" required className="rounded border p-2" />
          <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Add episode</button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/shows app/\(admin\)/admin/seasons
git commit -m "feat: add admin CRUD for shows, seasons, contestants, episodes"
```

---

## Task 7: Scoring Engine — Weekly Vote (TDD)

**Files:**
- Create: `lib/scoring/types.ts`, `lib/scoring/weekly.ts`, `lib/scoring/weekly.test.ts`

- [ ] **Step 1: Shared scoring types**

`lib/scoring/types.ts`:
```ts
export interface WeeklyScoringConfig {
  format: 'weekly_vote'
  defaultPointsPerCorrect: number
  questionOverrides?: Record<string, number>
}

export interface BracketScoringConfig {
  format: 'bracket'
  roundPoints: number[]
}

export type ScoringConfig = WeeklyScoringConfig | BracketScoringConfig
```

- [ ] **Step 2: Write the failing tests**

`lib/scoring/weekly.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { scoreWeeklyPick } from './weekly'
import type { WeeklyScoringConfig } from './types'

const config: WeeklyScoringConfig = { format: 'weekly_vote', defaultPointsPerCorrect: 5 }

describe('scoreWeeklyPick', () => {
  it('awards default points when the pick matches the resolved answer', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: true, pointsAwarded: 5 })
  })

  it('awards zero points when the pick does not match', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'sam' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it('awards zero points when the question is not yet resolved', () => {
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: null, pointValue: 1 },
      config
    )
    expect(result).toEqual({ isCorrect: false, pointsAwarded: 0 })
  })

  it('uses a per-question point override when present', () => {
    const overrideConfig: WeeklyScoringConfig = {
      format: 'weekly_vote',
      defaultPointsPerCorrect: 5,
      questionOverrides: { q1: 20 },
    }
    const result = scoreWeeklyPick(
      { pickedContestantId: 'jordan' },
      { id: 'q1', resolvedCorrectContestantId: 'jordan', pointValue: 1 },
      overrideConfig
    )
    expect(result).toEqual({ isCorrect: true, pointsAwarded: 20 })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- weekly`
Expected: FAIL with "Cannot find module './weekly'"

- [ ] **Step 4: Implement the scoring function**

`lib/scoring/weekly.ts`:
```ts
import type { WeeklyScoringConfig } from './types'

export interface WeeklyPick {
  pickedContestantId: string
}

export interface WeeklyQuestionResult {
  id: string
  resolvedCorrectContestantId: string | null
  pointValue: number
}

export function scoreWeeklyPick(
  pick: WeeklyPick,
  question: WeeklyQuestionResult,
  config: WeeklyScoringConfig
): { isCorrect: boolean; pointsAwarded: number } {
  if (!question.resolvedCorrectContestantId) {
    return { isCorrect: false, pointsAwarded: 0 }
  }

  const isCorrect = pick.pickedContestantId === question.resolvedCorrectContestantId
  if (!isCorrect) {
    return { isCorrect: false, pointsAwarded: 0 }
  }

  const points = config.questionOverrides?.[question.id] ?? config.defaultPointsPerCorrect
  return { isCorrect: true, pointsAwarded: points }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- weekly`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/scoring/types.ts lib/scoring/weekly.ts lib/scoring/weekly.test.ts
git commit -m "feat: add weekly-vote scoring engine with tests"
```

---

## Task 8: Scoring Engine — Bracket (TDD)

**Files:**
- Create: `lib/scoring/bracket.ts`, `lib/scoring/bracket.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/scoring/bracket.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { scoreBracketPick } from './bracket'
import type { BracketScoringConfig } from './types'

const config: BracketScoringConfig = { format: 'bracket', roundPoints: [1, 2, 4, 8] }

describe('scoreBracketPick', () => {
  it('awards round-1 points for a correct round-1 pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 1, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(1)
  })

  it('awards round-3 points for a correct round-3 pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 3, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(4)
  })

  it('awards zero points for an incorrect pick', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'sam' },
      { round: 1, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(0)
  })

  it('awards zero points when the matchup has no winner yet', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 1, winnerId: null },
      config
    )
    expect(points).toBe(0)
  })

  it('falls back to zero for a round beyond the configured point list', () => {
    const points = scoreBracketPick(
      { predictedWinnerId: 'jordan' },
      { round: 9, winnerId: 'jordan' },
      config
    )
    expect(points).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- bracket`
Expected: FAIL with "Cannot find module './bracket'"

- [ ] **Step 3: Implement the scoring function**

`lib/scoring/bracket.ts`:
```ts
import type { BracketScoringConfig } from './types'

export interface BracketPick {
  predictedWinnerId: string
}

export interface BracketMatchupResult {
  round: number
  winnerId: string | null
}

export function scoreBracketPick(
  pick: BracketPick,
  matchup: BracketMatchupResult,
  config: BracketScoringConfig
): number {
  if (!matchup.winnerId) return 0
  if (pick.predictedWinnerId !== matchup.winnerId) return 0

  const roundIndex = matchup.round - 1
  return config.roundPoints[roundIndex] ?? 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- bracket`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/bracket.ts lib/scoring/bracket.test.ts
git commit -m "feat: add bracket scoring engine with tests"
```

---

## Task 9: Admin — League Creation

**Files:**
- Create: `app/(admin)/admin/leagues/new/page.tsx`, `app/(admin)/admin/leagues/actions.ts`

- [ ] **Step 1: Join-code generator + create action**

`app/(admin)/admin/leagues/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { redirect } from 'next/navigation'
import type { ScoringConfig } from '@/lib/scoring/types'

function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export async function createLeague(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const seasonId = String(formData.get('seasonId'))
  const name = String(formData.get('name'))
  const format = String(formData.get('format')) as 'bracket' | 'weekly_vote'

  const scoringConfig: ScoringConfig =
    format === 'weekly_vote'
      ? { format: 'weekly_vote', defaultPointsPerCorrect: 5 }
      : { format: 'bracket', roundPoints: [1, 2, 4, 8] }

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      season_id: seasonId,
      name,
      format,
      scoring_config: scoringConfig,
      join_code: generateJoinCode(),
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  redirect(`/admin/leagues/${data.id}/bracket`)
}
```

- [ ] **Step 2: New league form**

`app/(admin)/admin/leagues/new/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { createLeague } from '../actions'

export default async function NewLeaguePage() {
  const supabase = await createClient()
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, shows(name)')
    .order('name')

  return (
    <form action={createLeague} className="flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold">Create a league</h1>
      <select name="seasonId" required className="rounded border p-2">
        {seasons?.map((s) => (
          <option key={s.id} value={s.id}>
            {(s.shows as unknown as { name: string })?.name} — {s.name}
          </option>
        ))}
      </select>
      <input name="name" placeholder="League name" required className="rounded border p-2" />
      <select name="format" required className="rounded border p-2">
        <option value="weekly_vote">Weekly vote</option>
        <option value="bracket">Bracket</option>
      </select>
      <button type="submit" className="rounded bg-fuchsia-600 p-2 font-semibold text-white">
        Create league
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/leagues/new app/\(admin\)/admin/leagues/actions.ts
git commit -m "feat: add admin league creation"
```

---

## Task 10: Member — Join League & Dashboard

**Files:**
- Create: `app/(app)/dashboard/page.tsx`, `app/(app)/dashboard/actions.ts`

- [ ] **Step 1: Join action**

`app/(app)/dashboard/actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinLeague(formData: FormData) {
  const supabase = await createClient()
  const code = String(formData.get('code')).trim().toUpperCase()
  const { error } = await supabase.rpc('join_league_by_code', { p_code: code })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Dashboard page**

`app/(app)/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { joinLeague } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('league_members')
    .select('leagues(id, name, format)')
    .eq('user_id', user!.id)

  return (
    <div className="flex flex-col gap-6">
      <form action={joinLeague} className="flex gap-2">
        <input name="code" placeholder="Join code" required className="rounded border p-2 uppercase" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Join</button>
      </form>

      <ul className="flex flex-col gap-2">
        {memberships?.map((m) => {
          const league = m.leagues as unknown as { id: string; name: string; format: string }
          return (
            <li key={league.id}>
              <a className="underline" href={`/leagues/${league.id}`}>
                {league.name} ({league.format === 'bracket' ? 'Bracket' : 'Weekly vote'})
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/dashboard
git commit -m "feat: add member dashboard with league join flow"
```

---

## Task 11: Admin — Post Episode Results (Manual) & Resolve Weekly Questions

**Files:**
- Create: `app/(admin)/admin/episodes/[episodeId]/page.tsx`, `app/(admin)/admin/episodes/actions.ts`

- [ ] **Step 1: Results-posting action, including weekly-question resolution**

`app/(admin)/admin/episodes/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { scoreWeeklyPick } from '@/lib/scoring/weekly'
import type { WeeklyScoringConfig } from '@/lib/scoring/types'
import { revalidatePath } from 'next/cache'

export async function addEpisodeEvent(episodeId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const eventType = String(formData.get('eventType'))
  const contestantId = String(formData.get('contestantId'))
  const description = String(formData.get('description') ?? '')

  await supabase.from('episode_events').insert({
    episode_id: episodeId,
    event_type: eventType,
    contestant_id: contestantId,
    description,
  })

  await resolveWeeklyQuestionsForEpisode(episodeId)
  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)
  revalidatePath(`/admin/episodes/${episodeId}`)
}

async function resolveWeeklyQuestionsForEpisode(episodeId: string) {
  const { supabase } = await requireAdmin()

  const { data: events } = await supabase
    .from('episode_events')
    .select('event_type, contestant_id')
    .eq('episode_id', episodeId)

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, event_type_target, point_value, leagues(scoring_config)')
    .eq('episode_id', episodeId)
    .is('resolved_at', null)

  for (const question of questions ?? []) {
    const matchingEvent = events?.find((e) => e.event_type === question.event_type_target)
    if (!matchingEvent) continue

    await supabase
      .from('weekly_questions')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_correct_contestant_id: matchingEvent.contestant_id,
      })
      .eq('id', question.id)

    const scoringConfig = (question.leagues as unknown as { scoring_config: WeeklyScoringConfig })
      .scoring_config

    const { data: picks } = await supabase
      .from('member_picks')
      .select('id, picked_contestant_id')
      .eq('weekly_question_id', question.id)

    for (const pick of picks ?? []) {
      const { isCorrect, pointsAwarded } = scoreWeeklyPick(
        { pickedContestantId: pick.picked_contestant_id },
        {
          id: question.id,
          resolvedCorrectContestantId: matchingEvent.contestant_id,
          pointValue: question.point_value,
        },
        scoringConfig
      )
      await supabase
        .from('member_picks')
        .update({ is_correct: isCorrect, points_awarded: pointsAwarded })
        .eq('id', pick.id)
    }
  }
}
```

- [ ] **Step 2: Episode results page**

`app/(admin)/admin/episodes/[episodeId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { addEpisodeEvent } from '../actions'

export default async function EpisodeResultsPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  const supabase = await createClient()

  const { data: episode } = await supabase
    .from('episodes')
    .select('id, episode_number, season_id, status')
    .eq('id', episodeId)
    .single()

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', episode!.season_id)
    .order('name')

  const { data: events } = await supabase
    .from('episode_events')
    .select('id, event_type, description, contestants(name)')
    .eq('episode_id', episodeId)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Episode {episode?.episode_number} results ({episode?.status})</h1>

      <ul className="list-disc pl-6">
        {events?.map((e) => (
          <li key={e.id}>
            {e.event_type}: {(e.contestants as unknown as { name: string })?.name} — {e.description}
          </li>
        ))}
      </ul>

      <form action={addEpisodeEvent.bind(null, episodeId)} className="flex gap-2">
        <input name="eventType" placeholder="Event type (e.g. eliminated)" required className="rounded border p-2" />
        <select name="contestantId" required className="rounded border p-2">
          {contestants?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="description" placeholder="Description" className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Post result</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/episodes
git commit -m "feat: add manual episode results entry with weekly-question resolution"
```

---

## Task 12: Member — Weekly Picks & Standings

**Files:**
- Create: `app/(admin)/admin/leagues/[leagueId]/questions/actions.ts`, `app/(admin)/admin/leagues/[leagueId]/questions/page.tsx`
- Create: `app/(app)/leagues/[leagueId]/page.tsx`, `app/(app)/leagues/[leagueId]/actions.ts`

- [ ] **Step 1: Admin — create a weekly question**

`app/(admin)/admin/leagues/[leagueId]/questions/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { revalidatePath } from 'next/cache'

export async function createWeeklyQuestion(leagueId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const episodeId = String(formData.get('episodeId'))
  const questionText = String(formData.get('questionText'))
  const eventTypeTarget = String(formData.get('eventTypeTarget'))
  const lockAt = String(formData.get('lockAt'))

  await supabase.from('weekly_questions').insert({
    league_id: leagueId,
    episode_id: episodeId,
    question_text: questionText,
    event_type_target: eventTypeTarget,
    lock_at: lockAt,
  })
  revalidatePath(`/admin/leagues/${leagueId}/questions`)
}
```

`app/(admin)/admin/leagues/[leagueId]/questions/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { createWeeklyQuestion } from './actions'

export default async function LeagueQuestionsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase.from('leagues').select('season_id').eq('id', leagueId).single()
  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', league!.season_id)
    .order('episode_number')

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, event_type_target, lock_at, resolved_at')
    .eq('league_id', leagueId)

  return (
    <div className="flex flex-col gap-6">
      <ul className="list-disc pl-6">
        {questions?.map((q) => (
          <li key={q.id}>
            {q.question_text} (target: {q.event_type_target}) — locks {new Date(q.lock_at).toLocaleString()}
            {q.resolved_at ? ' — resolved' : ''}
          </li>
        ))}
      </ul>

      <form action={createWeeklyQuestion.bind(null, leagueId)} className="flex flex-col gap-2 max-w-md">
        <select name="episodeId" required className="rounded border p-2">
          {episodes?.map((e) => <option key={e.id} value={e.id}>Episode {e.episode_number}</option>)}
        </select>
        <input name="questionText" placeholder="Question (e.g. Who gets eliminated?)" required className="rounded border p-2" />
        <input name="eventTypeTarget" placeholder="Event type target (e.g. eliminated)" required className="rounded border p-2" />
        <input name="lockAt" type="datetime-local" required className="rounded border p-2" />
        <button type="submit" className="rounded bg-fuchsia-600 p-2 text-white">Add question</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Member — submit picks action**

`app/(app)/leagues/[leagueId]/actions.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitPick(leagueId: string, questionId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const contestantId = String(formData.get('contestantId'))

  await supabase
    .from('member_picks')
    .upsert(
      { weekly_question_id: questionId, user_id: user!.id, picked_contestant_id: contestantId },
      { onConflict: 'weekly_question_id,user_id' }
    )

  revalidatePath(`/leagues/${leagueId}`)
}
```

- [ ] **Step 3: League home page — picks form + standings**

`app/(app)/leagues/[leagueId]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { submitPick } from './actions'

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase.from('leagues').select('name, format, season_id').eq('id', leagueId).single()

  const { data: openQuestions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, lock_at, episodes(season_id)')
    .eq('league_id', leagueId)
    .is('resolved_at', null)
    .gt('lock_at', new Date().toISOString())

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', league!.season_id)
    .order('name')

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name)')
    .eq('league_id', leagueId)

  const { data: allPicks } = await supabase
    .from('member_picks')
    .select('user_id, points_awarded, weekly_questions!inner(league_id)')
    .eq('weekly_questions.league_id', leagueId)

  const standings = (members ?? [])
    .map((m) => {
      const total = (allPicks ?? [])
        .filter((p) => p.user_id === m.user_id)
        .reduce((sum, p) => sum + p.points_awarded, 0)
      return {
        userId: m.user_id,
        name: (m.profiles as unknown as { display_name: string })?.display_name,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{league?.name}</h1>

      <section>
        <h2 className="text-xl font-bold">This week's picks</h2>
        {openQuestions?.map((q) => (
          <form key={q.id} action={submitPick.bind(null, leagueId, q.id)} className="flex items-center gap-2">
            <span>{q.question_text}</span>
            <select name="contestantId" required className="rounded border p-2">
              {contestants?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Lock in</button>
          </form>
        ))}
      </section>

      <section>
        <h2 className="text-xl font-bold">Standings</h2>
        <ol className="list-decimal pl-6">
          {standings.map((s) => (
            <li key={s.userId} className={s.userId === user!.id ? 'font-bold' : ''}>
              {s.name}: {s.total} pts
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/leagues/\[leagueId\]/questions app/\(app\)/leagues
git commit -m "feat: add weekly question management, member picks, and standings"
```

---

## Task 13: Admin — Bracket Setup & Member Bracket Picks

**Files:**
- Create: `app/(admin)/admin/leagues/[leagueId]/bracket/page.tsx`, `app/(admin)/admin/leagues/[leagueId]/bracket/actions.ts`
- Modify: `app/(app)/leagues/[leagueId]/page.tsx`, `app/(app)/leagues/[leagueId]/actions.ts`

- [ ] **Step 1: Admin bracket actions — seed round 1, set a winner**

`app/(admin)/admin/leagues/[leagueId]/bracket/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { scoreBracketPick } from '@/lib/scoring/bracket'
import type { BracketScoringConfig } from '@/lib/scoring/types'
import { revalidatePath } from 'next/cache'

export async function seedRoundOne(leagueId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const contestantIds = formData.getAll('contestantId') as string[]

  const matchups = []
  for (let i = 0; i < contestantIds.length; i += 2) {
    matchups.push({
      league_id: leagueId,
      round: 1,
      matchup_index: i / 2,
      contestant_a_id: contestantIds[i],
      contestant_b_id: contestantIds[i + 1] ?? null,
    })
  }
  await supabase.from('bracket_matchups').insert(matchups)
  revalidatePath(`/admin/leagues/${leagueId}/bracket`)
}

export async function setMatchupWinner(leagueId: string, matchupId: string, formData: FormData) {
  const { supabase } = await requireAdmin()
  const winnerId = String(formData.get('winnerId'))

  const { data: matchup } = await supabase
    .from('bracket_matchups')
    .select('round, matchup_index, leagues(scoring_config)')
    .eq('id', matchupId)
    .single()

  await supabase
    .from('bracket_matchups')
    .update({ winner_id: winnerId, resolved_at: new Date().toISOString() })
    .eq('id', matchupId)

  const scoringConfig = (matchup!.leagues as unknown as { scoring_config: BracketScoringConfig })
    .scoring_config

  const { data: picks } = await supabase
    .from('member_bracket_picks')
    .select('id, predicted_winner_id')
    .eq('matchup_id', matchupId)

  for (const pick of picks ?? []) {
    const points = scoreBracketPick(
      { predictedWinnerId: pick.predicted_winner_id },
      { round: matchup!.round, winnerId },
      scoringConfig
    )
    await supabase.from('member_bracket_picks').update({ points_awarded: points }).eq('id', pick.id)
  }

  // Advance the winner into the next round's matchup, creating it if needed.
  const nextRound = matchup!.round + 1
  const nextMatchupIndex = Math.floor(matchup!.matchup_index / 2)
  const slot = matchup!.matchup_index % 2 === 0 ? 'contestant_a_id' : 'contestant_b_id'

  const { data: existingNext } = await supabase
    .from('bracket_matchups')
    .select('id')
    .eq('league_id', leagueId)
    .eq('round', nextRound)
    .eq('matchup_index', nextMatchupIndex)
    .maybeSingle()

  if (existingNext) {
    await supabase.from('bracket_matchups').update({ [slot]: winnerId }).eq('id', existingNext.id)
  } else {
    await supabase.from('bracket_matchups').insert({
      league_id: leagueId,
      round: nextRound,
      matchup_index: nextMatchupIndex,
      [slot]: winnerId,
    })
  }

  revalidatePath(`/admin/leagues/${leagueId}/bracket`)
}
```

- [ ] **Step 2: Admin bracket page**

`app/(admin)/admin/leagues/[leagueId]/bracket/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { seedRoundOne, setMatchupWinner } from './actions'

export default async function BracketAdminPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase.from('leagues').select('season_id, join_code').eq('id', leagueId).single()

  const { data: matchups } = await supabase
    .from('bracket_matchups')
    .select('id, round, matchup_index, winner_id, contestant_a:contestants!contestant_a_id(id, name), contestant_b:contestants!contestant_b_id(id, name)')
    .eq('league_id', leagueId)
    .order('round')
    .order('matchup_index')

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq('season_id', league!.season_id)
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <p>Join code: <span className="font-mono">{league?.join_code}</span></p>

      {(!matchups || matchups.length === 0) && (
        <form action={seedRoundOne.bind(null, leagueId)} className="flex flex-col gap-2">
          <p>Select contestants in matchup order (pairs of two):</p>
          {contestants?.map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input type="checkbox" name="contestantId" value={c.id} /> {c.name}
            </label>
          ))}
          <button type="submit" className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-white">Seed round 1</button>
        </form>
      )}

      {matchups?.map((m) => {
        const a = m.contestant_a as unknown as { id: string; name: string } | null
        const b = m.contestant_b as unknown as { id: string; name: string } | null
        return (
          <div key={m.id} className="flex items-center gap-4 border p-2">
            <span>Round {m.round}, Match {m.matchup_index + 1}: {a?.name ?? 'TBD'} vs {b?.name ?? 'TBD'}</span>
            {!m.winner_id && a && b && (
              <form action={setMatchupWinner.bind(null, leagueId, m.id)} className="flex gap-2">
                <select name="winnerId" required className="rounded border p-1">
                  <option value={a.id}>{a.name}</option>
                  <option value={b.id}>{b.name}</option>
                </select>
                <button type="submit" className="rounded bg-fuchsia-600 px-2 text-white">Post winner</button>
              </form>
            )}
            {m.winner_id && <span className="font-bold">Winner set</span>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Member bracket picks — extend league actions and page**

Modify `app/(app)/leagues/[leagueId]/actions.ts` — append:
```ts
export async function submitBracketPick(leagueId: string, matchupId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const predictedWinnerId = String(formData.get('predictedWinnerId'))

  await supabase
    .from('member_bracket_picks')
    .upsert(
      { matchup_id: matchupId, user_id: user!.id, predicted_winner_id: predictedWinnerId },
      { onConflict: 'matchup_id,user_id' }
    )

  revalidatePath(`/leagues/${leagueId}`)
}
```

Modify `app/(app)/leagues/[leagueId]/page.tsx` — replace the standings-computation block and add a bracket section. Full updated file:
```tsx
import { createClient } from '@/lib/supabase/server'
import { submitPick, submitBracketPick } from './actions'

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: league } = await supabase.from('leagues').select('name, format, season_id').eq('id', leagueId).single()

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(display_name)')
    .eq('league_id', leagueId)

  let standingsSource: { user_id: string; points_awarded: number }[] = []

  if (league?.format === 'weekly_vote') {
    const { data: openQuestions } = await supabase
      .from('weekly_questions')
      .select('id, question_text, lock_at')
      .eq('league_id', leagueId)
      .is('resolved_at', null)
      .gt('lock_at', new Date().toISOString())

    const { data: contestants } = await supabase
      .from('contestants')
      .select('id, name')
      .eq('season_id', league!.season_id)
      .order('name')

    const { data: allPicks } = await supabase
      .from('member_picks')
      .select('user_id, points_awarded, weekly_questions!inner(league_id)')
      .eq('weekly_questions.league_id', leagueId)

    standingsSource = allPicks ?? []

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">{league?.name}</h1>

        <section>
          <h2 className="text-xl font-bold">This week's picks</h2>
          {openQuestions?.map((q) => (
            <form key={q.id} action={submitPick.bind(null, leagueId, q.id)} className="flex items-center gap-2">
              <span>{q.question_text}</span>
              <select name="contestantId" required className="rounded border p-2">
                {contestants?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="submit" className="rounded bg-fuchsia-600 px-4 text-white">Lock in</button>
            </form>
          ))}
        </section>

        <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
      </div>
    )
  }

  // Bracket format
  const { data: matchups } = await supabase
    .from('bracket_matchups')
    .select('id, round, matchup_index, winner_id, contestant_a:contestants!contestant_a_id(id, name), contestant_b:contestants!contestant_b_id(id, name)')
    .eq('league_id', leagueId)
    .order('round')
    .order('matchup_index')

  const { data: allBracketPicks } = await supabase
    .from('member_bracket_picks')
    .select('user_id, points_awarded, bracket_matchups!inner(league_id)')
    .eq('bracket_matchups.league_id', leagueId)

  standingsSource = allBracketPicks ?? []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{league?.name}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Bracket</h2>
        {matchups?.map((m) => {
          const a = m.contestant_a as unknown as { id: string; name: string } | null
          const b = m.contestant_b as unknown as { id: string; name: string } | null
          return (
            <div key={m.id} className="flex items-center gap-2 border p-2">
              <span>R{m.round} M{m.matchup_index + 1}: {a?.name ?? 'TBD'} vs {b?.name ?? 'TBD'}</span>
              {!m.winner_id && a && b && (
                <form action={submitBracketPick.bind(null, leagueId, m.id)} className="flex gap-2">
                  <select name="predictedWinnerId" required className="rounded border p-1">
                    <option value={a.id}>{a.name}</option>
                    <option value={b.id}>{b.name}</option>
                  </select>
                  <button type="submit" className="rounded bg-fuchsia-600 px-2 text-white">Predict</button>
                </form>
              )}
            </div>
          )
        })}
      </section>

      <StandingsSection members={members} standingsSource={standingsSource} currentUserId={user!.id} />
    </div>
  )
}

function StandingsSection({
  members,
  standingsSource,
  currentUserId,
}: {
  members: { user_id: string; profiles: unknown }[] | null
  standingsSource: { user_id: string; points_awarded: number }[]
  currentUserId: string
}) {
  const standings = (members ?? [])
    .map((m) => {
      const total = standingsSource
        .filter((p) => p.user_id === m.user_id)
        .reduce((sum, p) => sum + p.points_awarded, 0)
      return {
        userId: m.user_id,
        name: (m.profiles as unknown as { display_name: string })?.display_name,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <section>
      <h2 className="text-xl font-bold">Standings</h2>
      <ol className="list-decimal pl-6">
        {standings.map((s) => (
          <li key={s.userId} className={s.userId === currentUserId ? 'font-bold' : ''}>
            {s.name}: {s.total} pts
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/leagues/\[leagueId\]/bracket app/\(app\)/leagues
git commit -m "feat: add bracket setup, member bracket picks, and unified standings"
```

---

## Task 14: Transcript-Assisted Results Ingestion

**Files:**
- Create: `lib/ai/parse-transcript.ts`, `lib/ai/parse-transcript.test.ts`
- Create: `app/(admin)/admin/episodes/[episodeId]/transcript/page.tsx`, `app/(admin)/admin/episodes/[episodeId]/transcript/actions.ts`

- [ ] **Step 1: Write the failing test for the transcript parser's output shape**

`lib/ai/parse-transcript.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { parseSuggestedEvents } from './parse-transcript'

describe('parseSuggestedEvents', () => {
  it('parses a well-formed JSON array response into typed events', () => {
    const raw = JSON.stringify([
      { eventType: 'eliminated', contestantName: 'Jordan', description: 'Jordan was voted out' },
    ])
    const result = parseSuggestedEvents(raw)
    expect(result).toEqual([
      { eventType: 'eliminated', contestantName: 'Jordan', description: 'Jordan was voted out' },
    ])
  })

  it('returns an empty array for malformed JSON', () => {
    const result = parseSuggestedEvents('not json')
    expect(result).toEqual([])
  })

  it('filters out entries missing required fields', () => {
    const raw = JSON.stringify([
      { eventType: 'eliminated' }, // missing contestantName
      { eventType: 'won', contestantName: 'Sam', description: 'Sam won the challenge' },
    ])
    const result = parseSuggestedEvents(raw)
    expect(result).toEqual([{ eventType: 'won', contestantName: 'Sam', description: 'Sam won the challenge' }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- parse-transcript`
Expected: FAIL with "Cannot find module './parse-transcript'"

- [ ] **Step 3: Implement the parser and the Claude call**

`lib/ai/parse-transcript.ts`:
```ts
import { generateText } from 'ai'

export interface SuggestedEvent {
  eventType: string
  contestantName: string
  description: string
}

export function parseSuggestedEvents(raw: string): SuggestedEvent[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed.filter((item): item is SuggestedEvent =>
    typeof item === 'object' &&
    item !== null &&
    typeof (item as SuggestedEvent).eventType === 'string' &&
    typeof (item as SuggestedEvent).contestantName === 'string' &&
    typeof (item as SuggestedEvent).description === 'string'
  )
}

export async function suggestEventsFromTranscript(transcript: string): Promise<SuggestedEvent[]> {
  const { text } = await generateText({
    model: 'anthropic/claude-sonnet-5',
    prompt: `You are extracting factual results from a reality TV episode transcript.
Read the transcript and output a JSON array of events. Each event has:
- "eventType": a short lowercase snake_case label (e.g. "eliminated", "won_challenge", "won_immunity")
- "contestantName": the contestant's name as it appears in the transcript
- "description": one sentence describing what happened

Only include events that are clearly stated as having happened. Output ONLY the JSON array, no other text.

Transcript:
${transcript}`,
  })
  return parseSuggestedEvents(text)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- parse-transcript`
Expected: PASS, 3 tests.

- [ ] **Step 5: Admin actions — upload transcript, approve suggestions**

`app/(admin)/admin/episodes/[episodeId]/transcript/actions.ts`:
```ts
'use server'

import { requireAdmin } from '@/lib/auth/require-admin'
import { suggestEventsFromTranscript } from '@/lib/ai/parse-transcript'
import { revalidatePath } from 'next/cache'

export async function uploadTranscript(episodeId: string, formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const rawText = String(formData.get('rawText'))

  const suggestedEvents = await suggestEventsFromTranscript(rawText)

  await supabase.from('transcript_uploads').insert({
    episode_id: episodeId,
    raw_text: rawText,
    suggested_events: suggestedEvents,
    uploaded_by: userId,
  })

  revalidatePath(`/admin/episodes/${episodeId}/transcript`)
}

export async function approveTranscriptUpload(episodeId: string, uploadId: string) {
  const { supabase, userId } = await requireAdmin()

  const { data: upload } = await supabase
    .from('transcript_uploads')
    .select('suggested_events')
    .eq('id', uploadId)
    .single()

  const { data: contestants } = await supabase
    .from('contestants')
    .select('id, name')
    .eq(
      'season_id',
      (await supabase.from('episodes').select('season_id').eq('id', episodeId).single()).data!.season_id
    )

  type Suggested = { eventType: string; contestantName: string; description: string }
  const suggestedEvents = (upload!.suggested_events ?? []) as Suggested[]

  for (const suggestion of suggestedEvents) {
    const contestant = contestants?.find(
      (c) => c.name.toLowerCase() === suggestion.contestantName.toLowerCase()
    )
    if (!contestant) continue

    await supabase.from('episode_events').insert({
      episode_id: episodeId,
      event_type: suggestion.eventType,
      contestant_id: contestant.id,
      description: suggestion.description,
    })
  }

  await supabase
    .from('transcript_uploads')
    .update({ status: 'approved', reviewed_by: userId })
    .eq('id', uploadId)

  await supabase.from('episodes').update({ status: 'results_posted' }).eq('id', episodeId)

  revalidatePath(`/admin/episodes/${episodeId}`)
  revalidatePath(`/admin/episodes/${episodeId}/transcript`)
}
```

- [ ] **Step 6: Admin transcript review page**

`app/(admin)/admin/episodes/[episodeId]/transcript/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { uploadTranscript, approveTranscriptUpload } from './actions'

export default async function TranscriptPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  const supabase = await createClient()

  const { data: uploads } = await supabase
    .from('transcript_uploads')
    .select('id, status, suggested_events, created_at')
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false })

  type Suggested = { eventType: string; contestantName: string; description: string }

  return (
    <div className="flex flex-col gap-6">
      <form action={uploadTranscript.bind(null, episodeId)} className="flex flex-col gap-2">
        <textarea
          name="rawText"
          rows={10}
          placeholder="Paste the licensed episode transcript here"
          required
          className="rounded border p-2"
        />
        <button type="submit" className="w-fit rounded bg-fuchsia-600 px-4 py-2 text-white">
          Parse transcript
        </button>
      </form>

      {uploads?.map((u) => (
        <div key={u.id} className="rounded border p-4">
          <p className="mb-2">Status: {u.status}</p>
          <ul className="list-disc pl-6">
            {((u.suggested_events ?? []) as Suggested[]).map((s, i) => (
              <li key={i}>{s.eventType} — {s.contestantName}: {s.description}</li>
            ))}
          </ul>
          {u.status === 'pending' && (
            <form action={approveTranscriptUpload.bind(null, episodeId, u.id)}>
              <button type="submit" className="mt-2 rounded bg-emerald-600 px-4 py-2 text-white">
                Approve & post results
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/ai app/\(admin\)/admin/episodes/\[episodeId\]/transcript
git commit -m "feat: add transcript-assisted results ingestion with admin approval"
```

---

## Task 15: Email Notifications (Resend)

**Files:**
- Create: `lib/email/resend.ts`, `lib/email/templates.ts`
- Modify: `app/(admin)/admin/episodes/actions.ts`, `app/(admin)/admin/episodes/[episodeId]/transcript/actions.ts`
- Create: `app/api/cron/lock-reminders/route.ts`

- [ ] **Step 1: Resend client + templates**

`lib/email/resend.ts`:
```ts
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

`lib/email/templates.ts`:
```ts
export function resultsPostedEmail(leagueName: string, episodeNumber: number) {
  return {
    subject: `${leagueName}: Episode ${episodeNumber} results are in!`,
    text: `This week's results for ${leagueName} have been posted. Check your score and the standings now.`,
  }
}

export function lockReminderEmail(leagueName: string, questionText: string) {
  return {
    subject: `${leagueName}: picks lock in 2 hours`,
    text: `Don't forget to lock in your pick for "${questionText}" in ${leagueName} — picks lock in about 2 hours.`,
  }
}
```

- [ ] **Step 2: Send results-posted email after results are approved**

Modify `app/(admin)/admin/episodes/actions.ts` — add at the end of `addEpisodeEvent`, after `revalidatePath`:
```ts
  await sendResultsPostedEmails(episodeId)
}

async function sendResultsPostedEmails(episodeId: string) {
  const { supabase } = await requireAdmin()
  const { data: episode } = await supabase
    .from('episodes')
    .select('episode_number')
    .eq('id', episodeId)
    .single()

  const { data: leagueMembers } = await supabase
    .from('weekly_questions')
    .select('leagues(id, name, league_members(profiles(display_name), user_id))')
    .eq('episode_id', episodeId)

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  const seen = new Set<string>()
  for (const row of leagueMembers ?? []) {
    const league = row.leagues as unknown as {
      id: string
      name: string
      league_members: { user_id: string }[]
    }
    for (const member of league.league_members) {
      const key = `${league.id}:${member.user_id}`
      if (seen.has(key)) continue
      seen.add(key)
      const authUser = userEmails.data.users.find((u) => u.id === member.user_id)
      if (!authUser?.email) continue
      const { subject, text } = resultsPostedEmail(league.name, episode!.episode_number)
      await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
    }
  }
}
```

Add imports at the top of the same file:
```ts
import { resend } from '@/lib/email/resend'
import { resultsPostedEmail } from '@/lib/email/templates'
```

- [ ] **Step 3: Cron endpoint for lock reminders**

`app/api/cron/lock-reminders/route.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'
import { lockReminderEmail } from '@/lib/email/templates'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const ninetyMinutesFromNow = new Date(Date.now() + 90 * 60 * 1000)

  const { data: questions } = await supabase
    .from('weekly_questions')
    .select('id, question_text, lock_at, leagues(name, league_members(user_id))')
    .gt('lock_at', ninetyMinutesFromNow.toISOString())
    .lt('lock_at', twoHoursFromNow.toISOString())

  const { data: userEmails } = await supabase.auth.admin.listUsers()

  for (const q of questions ?? []) {
    const league = q.leagues as unknown as { name: string; league_members: { user_id: string }[] }
    for (const member of league.league_members) {
      const authUser = userEmails.data.users.find((u) => u.id === member.user_id)
      if (!authUser?.email) continue
      const { subject, text } = lockReminderEmail(league.name, q.question_text)
      await resend.emails.send({ from: 'Fantasy TV <notify@fantasytv.app>', to: authUser.email, subject, text })
    }
  }

  return NextResponse.json({ sent: questions?.length ?? 0 })
}
```

- [ ] **Step 4: Register the cron schedule**

Create `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/lock-reminders", "schedule": "*/30 * * * *" }
  ]
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/email app/\(admin\)/admin/episodes/actions.ts app/api/cron vercel.json
git commit -m "feat: add results-posted and pick-lock-reminder emails"
```

---

## Task 16: Deploy

**Files:** none (infra step)

- [ ] **Step 1: Push to a GitHub repo**

```bash
gh repo create fantasy-tv --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Step 2: Connect the project to Vercel and set environment variables**

Use the `vercel:deploy` skill, or:
```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RESEND_API_KEY
vercel env add AI_GATEWAY_API_KEY
vercel env add CRON_SECRET
```

- [ ] **Step 3: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 4: Manual smoke test**

Sign up, promote yourself to admin (Task 4), create a show/season/cast/episode, create a weekly-vote league, join it, submit a pick, post results, confirm standings update. Repeat the bracket-creation → predict → post-winner flow for a bracket league.

---

## Self-Review Notes

- **Spec coverage:** auth/roles (Tasks 3–5), show/season/cast/episode admin CRUD (Task 6), weekly-vote scoring engine (Task 7), bracket scoring engine (Task 8), league creation with per-league scoring config (Task 9), join flow (Task 10), manual results entry + question resolution (Task 11), member picks + standings (Task 12), bracket setup + member bracket predictions + winner-posting + advancement (Task 13), transcript-assisted ingestion with mandatory admin approval (Task 14), email notifications (Task 15). All spec sections are covered.
- **Non-goal reaffirmed:** Task 14 only ever accepts pasted/uploaded text — no stream, audio, or video access is implemented anywhere in this plan.
- **Type consistency checked:** `WeeklyScoringConfig`/`BracketScoringConfig` (Task 7/8) are reused verbatim in league creation (Task 9), results resolution (Task 11), and bracket winner-posting (Task 13). `scoreWeeklyPick`/`scoreBracketPick` signatures match between their test files and implementations.
- **Known v1 simplification:** bracket winners are posted directly by the admin via the bracket UI rather than being derived automatically from `episode_events` rows, since generic event-to-matchup correlation is unnecessary complexity for v1 (see Scope note at top of plan).

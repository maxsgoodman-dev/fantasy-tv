# Fantasy TV — Design Spec

Date: 2026-09-15

## Purpose

Fantasy TV is a webapp (installable as a mobile home-screen app) for running fantasy-sport-style
tournaments around reality TV shows. Each show/season gets its own league(s); users sign up, join a
league, and compete against other members by predicting outcomes — either via bracket-style
tournament predictions or weekly locked votes on what will happen before each episode airs.

## Roles

- **Admin** (platform operator): creates shows, seasons, contestants, and episode schedules; creates
  leagues for a season; enters or approves each episode's real-world results. Admin also acts as
  "commissioner" for any league they create — able to override that league's scoring configuration.
- **Member**: any signed-up user. Joins leagues via an invite code/link, submits picks/predictions,
  views standings. Members cannot create leagues or shows in v1.

## Architecture

- **Frontend/Backend**: Next.js 15 (App Router, TypeScript, Tailwind CSS, shadcn/ui components).
  Single deployable app — UI and API routes/server actions in one codebase.
- **Database & Auth**: Supabase (Postgres + Supabase Auth: email/password and Google OAuth). Row
  Level Security (RLS) policies enforce that members can only read/write data for leagues they
  belong to, and that admin-only tables are gated by role.
- **Hosting**: Vercel.
- **Email**: Resend, for transactional notifications.
- **AI**: Claude, called via Vercel AI Gateway, used only for the transcript-parsing feature
  described below (not live, not automated stream access).
- **Visual style**: bold, fun reality-TV energy — punchy accent colors, card-based layouts,
  playful typography — while staying clean and usable on mobile (this is a save-to-homescreen app).

## Data Model (core entities)

- `profiles` — extends Supabase `auth.users` with display name, avatar, role (admin/member).
- `shows` — name, description, image.
- `seasons` — belongs to a show; name/year.
- `contestants` — belongs to a season; name, photo, bio.
- `episodes` — belongs to a season; number, air date, status (`upcoming` / `aired` /
  `results_posted`).
- `episode_events` — the canonical, structured facts about what happened in an episode
  (e.g. `{type: "elimination", contestant_id, description}`). This is the single source of truth
  that all scoring reads from, regardless of whether it was entered manually or via transcript
  parsing.
- `transcript_uploads` — raw transcript text (from a licensed source, provided by admin),
  Claude's suggested `episode_events`, status (`pending` / `approved` / `rejected`), reviewed_by.
- `leagues` — belongs to a season; name, format (`bracket` | `weekly_vote`), `scoring_config`
  (JSON), join code, created_by (admin).
- `league_members` — user_id, league_id, joined_at.
- `weekly_questions` — belongs to a league + episode; question text, type (e.g. pick-a-contestant,
  yes/no), point value, lock time.
- `member_picks` — user_id, weekly_question_id, selected answer, locked_at, is_correct,
  points_awarded.
- `bracket_matchups` — belongs to a league; round, matchup index, contestant_a, contestant_b,
  winner_id (filled in as real results come in via `episode_events`).
- `member_bracket_picks` — user_id, matchup_id, predicted_winner_id, points_awarded.
- Standings are derived (materialized view or on-read aggregation) as total points per member per
  league.

## Core Flows

1. **Auth & onboarding**: sign up / log in via Supabase Auth (email/password or Google); set
   display name and avatar.
2. **Admin: content setup**: admin dashboard to create/edit shows, seasons, contestants, and the
   episode air-date schedule.
3. **Admin: league creation**: pick a season, choose format (bracket or weekly-vote), configure
   scoring (see below), get a shareable join code/link.
4. **Joining a league**: member enters or clicks a join code/link and is added to
   `league_members`.
5. **Weekly-vote flow**: before each episode airs, members answer that week's questions
   (predictions) on a picks screen. Picks lock **server-side** at the configured lock time (not
   just hidden in the UI) — no writes accepted after lock. After the admin posts/approves that
   episode's results, points are calculated automatically and standings update.
6. **Bracket flow**: before the bracket/season starts, members submit a full bracket of
   predictions (like a standard single-elimination bracket). As the admin posts real round
   winners, member bracket picks are scored automatically — later rounds are worth more points,
   per that league's `scoring_config`.
7. **Results ingestion** (admin only) — two entry paths writing to the same `episode_events`
   table:
   - **Manual**: a quick-entry form where the admin records what happened directly.
   - **Transcript-assisted**: admin pastes/uploads an episode transcript obtained from their
     licensed caption/transcript source. Claude parses the text and suggests structured
     `episode_events`. The admin reviews, edits, and explicitly approves before anything is
     written to the canonical `episode_events` table. Nothing scores automatically from a
     transcript without this approval step. This app does not capture, access, or process any
     audio/video stream itself — it only accepts text the admin already has the rights to use.
8. **Standings**: per-league leaderboard recalculates whenever `episode_events` (and therefore
   picks' correctness/points) change.
9. **Notifications** (email via Resend): "picks lock in 2 hours" reminder before a weekly
   question's lock time; "results are in" after the admin approves an episode's results.

## Scoring

Each league format has a **preset default scoring methodology**:
- Weekly-vote: fixed points per correct pick (e.g. flat points per correct answer).
- Bracket: standard escalating bracket scoring (points increase for correct picks in later
  rounds).

The admin/commissioner who creates a league can override the default `scoring_config` for that
specific league (e.g. custom point values per question, custom per-round bracket weights). The
scoring engine is a pure function: given a member's picks, the canonical `episode_events` /
`bracket_matchups` results, and a league's `scoring_config`, compute points. This keeps scoring
logic testable independent of the UI or database.

## Error Handling

- Pick submissions are rejected server-side once a question/episode's lock time has passed,
  regardless of client-side state.
- RLS policies prevent members from reading or writing leagues they haven't joined, and prevent
  non-admins from writing to admin-only tables (shows, seasons, contestants, episodes,
  episode_events, transcript_uploads).
- Transcript-derived event suggestions are never auto-applied; they sit in `pending` status until
  an admin approves them.
- Join codes are validated server-side; joining twice is a no-op rather than a duplicate row.

## Testing

- **Unit tests** on the scoring engine (pure functions: picks + results + scoring_config →
  points). This is the highest-value test surface since scoring bugs directly corrupt
  leaderboards.
- **Integration tests** for lock-time enforcement (writes rejected after lock) and RLS policies
  (a member cannot read/write another league's data).
- **Manual browser QA** on the full join → pick → results-approval → standings-update flow before
  calling v1 complete.

## Explicit Non-Goals (v1)

- No automated capture, recording, or monitoring of any live or on-demand video/audio stream.
  Transcript input is always text the admin already has rights to and enters/uploads themselves.
- No member-created leagues or shows (admin-curated only, per this spec).
- No push notifications (email only for v1).
- No fan-vote-driven bracket advancement (bracket winners come from real-world results the admin
  posts, not from member votes).

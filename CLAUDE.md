# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Break & Rank" — a PWA (React + Vite) for tracking a billiards club's matches and ranking. German-language app and codebase (comments, UI strings, commit messages).

## Commands

```bash
npm run dev       # start Vite dev server (also runs the service worker in dev, see vite.config.js)
npm run build     # production build
npm run preview   # preview a production build locally
```

No lint or test tooling is configured in this repo.

Local dev needs a `.env` (copy `env.example`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project.

## Architecture

**Single-page app, no router.** `src/App.jsx` (~550 lines) is the hub: it owns almost all state (session, player, players, matches, ratings, badges, pings, challenges, snapshots) and passes data/callbacks down to screen components in `src/components/`. There is no per-screen data fetching — `loadData()` in App.jsx re-fetches everything in one `Promise.all` after every mutation.

**Navigation is manual browser-history sync, not a router.** The active screen is a `tab` string in React state (`"rang"`, `"live"`, `"match"`, `"stats"`, `"profil"`, `"admin"`, `"invite"`, `"protokoll"`, `"fremdprofil"`). `navPush`/`navReplace` in App.jsx mirror every tab change into `window.history` via `pushState`/`replaceState` so the browser/device back-and-forward buttons work inside the app instead of leaving it. A `popstate` handler intercepts back/forward while `tab === "match"` and re-pushes the match state instead of letting it navigate away, so an in-progress match entry (score, run log) can't be lost to a stray back/forward click — see the long comment block above `applyNavState` in [src/App.jsx](src/App.jsx) before changing this logic.

**Business logic lives in Postgres, not in the client.** Ranking/rating calculation, badges/achievements, challenges, and pings are implemented as Postgres RPC functions (`confirm_match`, `select_badge`, `set_theme`, `update_profile`, `create_ping`, `create_challenge`, `submit_feedback`, `self_delete_account`, etc., all `SECURITY DEFINER`). The client calls `supabase.rpc(...)` and then calls `loadData()` again to pick up the recalculated state — it does not compute ranking client-side. `src/lib/achievements.js` and `src/lib/stats.js` compute *derived/display* stats client-side from already-loaded matches (streaks, high runs, etc.), not authoritative ranking.

**Database migrations are plain dated SQL files** in `supabase/`, named `YYYY-MM-DD_description.sql`. There is no `supabase/config.toml` or CLI migration history — files are applied manually (e.g. via the Supabase SQL editor), so migration order/idempotency is the author's responsibility, not the tool's.

**Supabase MCP access is read-only.** `.mcp.json` connects to the project's Supabase MCP server with `read_only=true`, and `supabase/2026-09-03_claude_readonly_role.sql` created a dedicated `supabase_read_only_user` Postgres role for it. Claude can query data for debugging but cannot write — use SQL migration files (applied by the user) for schema/data changes.

**Rating engine (`rebuild_elo()`, current version in [supabase/2026-09-03_per_discipline_snapshots.sql](supabase/2026-09-03_per_discipline_snapshots.sql)).** Elo-like, full recompute from match history (not incremental): `K=4`, start rating 500, per discipline (including a synthetic `Doppel` and `Gesamt`). Inactivity decay: no decay for the first `GRACE=30` days after a player's last match in that discipline, then exponential decay toward 500 with a `HALF=200`-day half-life. Score margin is capped at 16 points (`nf = least(n,16)`) for the delta calc; for 14/1 Endlos, negative scores are shifted up to 0 first (`sh = greatest(0, -least(score1,score2))`). Doubles matches are scored as team Elo (both partners share the same delta, based on team-average rating). `elo_anchors` stores each player/discipline's rating as of their last match — the base `snapshot_ratings()` decays from to produce daily rating history.

**Badge/achievement catalog is data-driven.** `src/lib/constants.js` exports a module-level `BADGE_INFO` map that starts empty and is populated at runtime from the `badge_catalog` table inside `loadData()`, so stateless components (e.g. `Ball.jsx`) can look up badge emoji/name/description without prop-drilling the catalog. `APP_VERSION` in the same file must be bumped on each release.

**PWA/service worker update handling** is in App.jsx via `useRegisterSW`. Update checks run on an interval or on visibility change (configurable by the user, persisted to `localStorage`), and a found update is applied immediately *unless* the user is mid-match (`tab === "match"`), mid-game in Winner-Stays mode (`tab === "winnerstays"`), or looking at the achievement-celebration popup, in which case it's deferred until they leave that screen. **Never apply an update while the user is in any screen holding unconfirmed live match/game entry** — an update triggers a full reload, which would silently discard that entry. When adding a new live-scoring screen, add its tab to this guard.

**Two stray root-level files, `main.jsx` and `supabase.js`, are unused legacy leftovers** — the real entry point is `src/main.jsx` (referenced by `index.html`), and the real Supabase client is `src/supabase.js` (which additionally derives `DB_REF` from the project URL). Don't edit the root copies; they aren't wired into the build.

## Known gotchas

- **CSS Grid cross-column height coupling.** When a column is built from two separate grid items stacked in two grid *rows* (as opposed to one flex column), Grid sizes each row by the tallest item across *all* columns in that row — a short/empty module next to a tall one in the neighboring column produces large, seemingly-unrelated gaps. Fix is to make each visually-stacked column its own flex container instead of relying on grid-row alignment.
- **`elo_anchors` has its own surrogate primary key** — it is not the `(player_id, discipline, anchor_at)` tuple that code elsewhere treats as its natural key. Adding a second `PRIMARY KEY` on that tuple fails with `42P16: multiple primary keys`; use a plain `UNIQUE` constraint instead (sufficient for `ON CONFLICT` upserts).
- **MCP servers (including the Supabase one) load only at session start.** Running `claude mcp add` or authenticating a server mid-session does not make it available in that session — a brand-new chat is required.
- The 3-column desktop layout (narrow/wide/narrow) used across Übersicht/Live/Statistik/Profil is referred to internally as **"dünn-breit-dünn"**; `IdentityCard.jsx` is the shared component behind it, deliberately used instead of separate per-screen hero/profile variants.
- **Admin-created logins (`admin_create_user`/`admin_create_login`, see `supabase/2026-09-05_*.sql`) insert directly into `auth.users`/`auth.identities`** to skip Supabase's email-confirmation flow entirely (avoids the low default email-sending rate limit when onboarding many testers with disposable addresses on the test project). When inserting such a row, `confirmation_token`, `recovery_token`, `email_change_token_new`, and `email_change` **must** be set to `''`, never left `NULL` — GoTrue scans them into non-nullable Go strings and a `NULL` there produces a generic `"Database error querying schema"` (HTTP 500) on `signInWithPassword`, which looks nothing like an email/confirmation problem. Confirmed by live-testing against the actual Auth REST endpoint, not just by reading GoTrue's source.
- **Re-numbering rows under a `UNIQUE(parent_id, position)` constraint in Postgres must never let two rows share a position "in transit" — and a NOT DEFERRABLE constraint checks this per row as it's written, not even at end-of-statement.** A first symptom hit in `winner_stays_report_game()` (`supabase/2026-09-09b_fix_winner_stays_rotation.sql`, 3 participants): a single bulk `UPDATE ... SET position = position - 1 WHERE position > N` failed with `duplicate key value` because the row that used to hold position `N` hadn't been moved out of the way first — patched by moving the vacating row to a sentinel value (`-1`) before shifting everyone else down. That patch turned out to be incomplete: with 4+ participants, the SAME bulk `UPDATE` can move *two or more* rows in one statement where row A's target position is row B's not-yet-processed source position — a "shift chain" — and Postgres may write them in an order that transiently collides, since a non-deferrable constraint is enforced as each row is written, not deferred to end-of-statement as originally assumed. The robust fix (`supabase/2026-09-10c_fix_winner_stays_constraint_deferrable.sql`) is `ALTER TABLE ... ALTER CONSTRAINT ... DEFERRABLE INITIALLY DEFERRED` — this checks the constraint once at transaction end, after every row already has its final, distinct value, making any reordering logic robust regardless of how many rows move in one call. Prefer a deferrable constraint over sentinel-value workarounds from the start for any future "reorder a ranked/queued list" table.

## Workflow

Work happens on the `test` branch; changes only go to `main` after the user explicitly asks for a merge. SQL migration files are applied manually by the user (test project first, then prod) — Claude's Supabase access is read-only by design, so schema/data changes always go through a migration file for the user to run, never through direct execution.

## Deployment

No CI in this repo. Deploy is GitHub → Vercel: any push triggers a Vercel build/deploy (Vite auto-detected). Vercel needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, and the Supabase project's Auth → URL Configuration must list the Vercel URL as Site URL / Redirect URL for magic-link login to work. See [ANLEITUNG.md](ANLEITUNG.md) for the full (German) walkthrough.

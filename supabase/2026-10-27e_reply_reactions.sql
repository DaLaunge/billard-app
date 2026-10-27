-- Auf Zusagen reagieren: kleine Reaktionen (👍 🎱 ❤️) auf eine Antwort bei "Live" (ping_replies) oder "Planung" (planning_replies).
-- Test, dann Produktion. Idempotent. Ohne diese Datei bleibt die App voll nutzbar, die Reaktionsknoepfe fehlen dann einfach.
--
-- * Jede Person kann je Antwort jede Reaktion einmal setzen; ein zweiter Tipp nimmt sie zurueck (toggle_reply_reaction).
-- * Gaeste duerfen nicht reagieren. Alle Mitglieder koennen die Reaktionen lesen.

create table if not exists public.reply_reactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ping', 'planning')),
  reply_id uuid not null,
  player_id uuid not null references public.players(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '🎱', '❤️')),
  created_at timestamptz not null default now(),
  unique (kind, reply_id, player_id, emoji)
);
create index if not exists reply_reactions_reply_idx on public.reply_reactions (kind, reply_id);

alter table public.reply_reactions enable row level security;
drop policy if exists reply_reactions_lesen on public.reply_reactions;
create policy reply_reactions_lesen on public.reply_reactions for select to authenticated using (true);
grant select on public.reply_reactions to authenticated;
grant select, insert, update, delete on public.reply_reactions to service_role;

create or replace function public.toggle_reply_reaction(p_kind text, p_reply_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = public as $function$
declare
  me uuid := current_player_id();
begin
  if me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if exists (select 1 from players where id = me and is_guest) then raise exception 'Gäste können nicht reagieren.'; end if;
  if p_kind not in ('ping', 'planning') then raise exception 'Unbekannte Art.'; end if;
  if p_kind = 'ping' and not exists (select 1 from ping_replies where id = p_reply_id) then raise exception 'Antwort nicht gefunden.'; end if;
  if p_kind = 'planning' and not exists (select 1 from planning_replies where id = p_reply_id) then raise exception 'Antwort nicht gefunden.'; end if;
  if exists (select 1 from reply_reactions where kind = p_kind and reply_id = p_reply_id and player_id = me and emoji = p_emoji) then
    delete from reply_reactions where kind = p_kind and reply_id = p_reply_id and player_id = me and emoji = p_emoji;
    return false;
  end if;
  insert into reply_reactions (kind, reply_id, player_id, emoji) values (p_kind, p_reply_id, me, p_emoji);
  return true;
end;
$function$;

revoke all on function public.toggle_reply_reaction(text, uuid, text) from public, anon;
grant execute on function public.toggle_reply_reaction(text, uuid, text) to authenticated;

-- Kleiner Chat pro Feedback-Ticket, damit Admin und meldende Person
-- nachfragen/antworten koennen (statt nur einer einzelnen Nachricht).
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sender_id uuid not null references public.players(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_feedback_idx on public.feedback_messages(feedback_id);

alter table public.feedback_messages enable row level security;

-- Admin sieht alle Threads, die meldende Person nur den zu ihrem eigenen Ticket.
drop policy if exists "feedback_messages_select" on public.feedback_messages;
create policy "feedback_messages_select" on public.feedback_messages
  for select using (
    is_admin()
    or feedback_id in (
      select id from feedback where player_id in (select id from players where auth_user_id = auth.uid())
    )
  );

-- feedback selbst war bisher nur fuer Admins lesbar (siehe
-- 2026-08-26_account_deletion_and_feedback.sql) - die meldende Person muss
-- ihr eigenes Ticket jetzt auch sehen koennen, um den Chat zu fuehren.
drop policy if exists "feedback_select_admin" on public.feedback;
drop policy if exists "feedback_select_own_or_admin" on public.feedback;
create policy "feedback_select_own_or_admin" on public.feedback
  for select using (
    is_admin() or player_id in (select id from players where auth_user_id = auth.uid())
  );

-- Kein Insert/Update fuer normale Nutzer per RLS - laeuft ausschliesslich
-- ueber diese SECURITY DEFINER-Funktion (gleiches Muster wie ueberall sonst).
create or replace function public.send_feedback_message(p_feedback_id uuid, p_message text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_owner uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;
  select player_id into v_owner from feedback where id = p_feedback_id;
  if v_owner is null then
    raise exception 'Feedback nicht gefunden.';
  end if;
  if v_me <> v_owner and not is_admin() then
    raise exception 'Keine Berechtigung.';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'Nachricht darf nicht leer sein.';
  end if;
  insert into feedback_messages (feedback_id, sender_id, message) values (p_feedback_id, v_me, trim(p_message));
end;
$$;

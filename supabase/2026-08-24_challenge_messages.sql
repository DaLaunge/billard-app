-- Nachrichten bei Herausforderungen: Herausforderer kann beim Erstellen
-- (und danach) eine Nachricht hinterlassen, Herausgeforderter kann genau
-- einmal antworten - beide Seiten koennen ihre eigene Nachricht/Antwort
-- jederzeit bearbeiten, solange die Herausforderung offen ist.
-- In Supabase SQL-Editor ausfuehren (erst Test, dann Produktion).

alter table public.challenges add column if not exists message text;
alter table public.challenges add column if not exists message_updated_at timestamptz;
alter table public.challenges add column if not exists reply text;
alter table public.challenges add column if not exists reply_updated_at timestamptz;

-- create_challenge um optionale Nachricht erweitern (Signatur-Erweiterung,
-- alte Aufrufe ohne p_message funktionieren weiter dank Default null).
create or replace function public.create_challenge(p_challenged_id uuid, p_message text default null)
returns public.challenges
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_row public.challenges;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
begin
  select id into v_me from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;
  if v_me = p_challenged_id then
    raise exception 'Du kannst dich nicht selbst herausfordern.';
  end if;

  select * into v_row from challenges
    where challenger_id = v_me and challenged_id = p_challenged_id
      and status = 'open' and expires_at > now();
  if found then
    return v_row;
  end if;

  insert into challenges (challenger_id, challenged_id, message, message_updated_at)
    values (v_me, p_challenged_id, v_msg, case when v_msg is not null then now() end)
    returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.edit_challenge_message(p_challenge_id uuid, p_message text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  update challenges
    set message = nullif(trim(coalesce(p_message, '')), ''), message_updated_at = now()
    where id = p_challenge_id and challenger_id = v_me and status = 'open';
  if not found then
    raise exception 'Herausforderung nicht gefunden oder nicht deine.';
  end if;
end;
$$;

create or replace function public.reply_to_challenge(p_challenge_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  update challenges
    set reply = nullif(trim(coalesce(p_reply, '')), ''), reply_updated_at = now()
    where id = p_challenge_id and challenged_id = v_me and status = 'open';
  if not found then
    raise exception 'Herausforderung nicht gefunden oder nicht deine.';
  end if;
end;
$$;

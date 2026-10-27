-- Eigene Planung nachtraeglich aendern (Datum und/oder Hinweis). Zusagen anderer bleiben erhalten.
-- Test, dann Produktion. Idempotent.
create or replace function public.update_planning(p_planning_id uuid, p_planned_date date, p_message text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_planned_date < current_date then
    raise exception 'Das Datum darf nicht in der Vergangenheit liegen.';
  end if;
  if p_planned_date > current_date + 120 then
    raise exception 'Das Datum darf hoechstens 120 Tage in der Zukunft liegen.';
  end if;
  if char_length(coalesce(p_message, '')) > 120 then
    raise exception 'Nachricht darf hoechstens 120 Zeichen haben.';
  end if;
  update plannings
     set planned_date = p_planned_date,
         message = nullif(trim(coalesce(p_message, '')), ''),
         expires_at = (p_planned_date + 1)::timestamptz
   where id = p_planning_id and player_id = v_me;
  if not found then
    raise exception 'Planung nicht gefunden.';
  end if;
end;
$$;

revoke all on function public.update_planning(uuid, date, text) from public, anon;
grant execute on function public.update_planning(uuid, date, text) to authenticated;

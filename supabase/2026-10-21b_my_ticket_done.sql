-- Eigene Tickets selbst als erledigt markieren (Nutzer-Wunsch 2026-10-21): bisher konnte nur ein Admin den Status von feedback setzen
-- (admin_set_feedback_status). Neu: der Ersteller eines Tickets darf es auf 'done' setzen und wieder auf 'open' stellen - nur das eigene.
--
-- Test, dann Produktion. Idempotent.

create or replace function public.set_my_feedback_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if p_status not in ('open', 'done') then raise exception 'Unbekannter Status.'; end if;
  update feedback set status = p_status where id = p_id and player_id = v_me;
  if not found then raise exception 'Ticket nicht gefunden.'; end if;
end;
$$;

grant execute on function public.set_my_feedback_status(uuid, text) to authenticated;

-- Abgelaufene Live-Eintraege und vergangene Planungen samt Zusagen und Reaktionen aus der Datenbank loeschen (Platz sparen).
-- Test, dann Produktion. Idempotent.
--
-- * Live (pings): geloescht, sobald expires_at vorbei ist (die App blendet sie ohnehin schon aus).
-- * Planung (plannings): geloescht ab dem Tag NACH dem geplanten Datum (Wiener Kalendertag).
-- * Mitgeloescht werden die Zusagen (ping_replies / planning_replies) und die Reaktionen darauf (reply_reactions);
--   uebrig gebliebene Reaktionen ohne Zusage (z. B. nach "Zusage zurueckziehen" oder "Live beenden") ebenfalls.
-- * Laeuft taeglich um 03:45 per pg_cron und einmal sofort beim Einspielen. Es gibt keinen Fremdschluessel auf die
--   Tabellen, deshalb wird hier ausdruecklich in der richtigen Reihenfolge geloescht.

create or replace function public.cleanup_expired_live_planning()
returns jsonb
language plpgsql security definer set search_path = public as $function$
declare
  v_pings integer;
  v_plans integer;
  v_reacts integer := 0;
  v_n integer;
  v_today date := (now() at time zone 'Europe/Vienna')::date;
begin
  -- Reaktionen und Zusagen der abgelaufenen Eintraege
  delete from reply_reactions rr
   where (rr.kind = 'ping' and rr.reply_id in (select r.id from ping_replies r join pings p on p.id = r.ping_id where p.expires_at < now()))
      or (rr.kind = 'planning' and rr.reply_id in (select r.id from planning_replies r join plannings p on p.id = r.planning_id where p.planned_date < v_today));
  get diagnostics v_n = row_count; v_reacts := v_reacts + v_n;

  delete from ping_replies where ping_id in (select id from pings where expires_at < now());
  delete from planning_replies where planning_id in (select id from plannings where planned_date < v_today);

  delete from pings where expires_at < now();
  get diagnostics v_pings = row_count;
  delete from plannings where planned_date < v_today;
  get diagnostics v_plans = row_count;

  -- Reaktionen ohne Zusage (Zusage zurueckgezogen, Eintrag vorzeitig beendet)
  delete from reply_reactions rr
   where (rr.kind = 'ping' and not exists (select 1 from ping_replies r where r.id = rr.reply_id))
      or (rr.kind = 'planning' and not exists (select 1 from planning_replies r where r.id = rr.reply_id));
  get diagnostics v_n = row_count; v_reacts := v_reacts + v_n;

  return jsonb_build_object('pings', v_pings, 'plannings', v_plans, 'reactions', v_reacts);
end;
$function$;

revoke all on function public.cleanup_expired_live_planning() from public, anon, authenticated;

select cron.schedule('cleanup-live-planning', '45 3 * * *', 'select public.cleanup_expired_live_planning();');

-- einmal sofort (zeigt, was geloescht wurde)
select public.cleanup_expired_live_planning();

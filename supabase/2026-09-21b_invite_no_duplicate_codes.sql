-- Kleiner Nachtrag zu 2026-09-21_persistent_invites.sql (kein Fehler daraus,
-- sondern beim Testen aufgefallen): get_or_create_my_invite() ist "erst
-- suchen, dann anlegen" ohne Sperre. Laufen zwei Aufrufe gleichzeitig, findet
-- keiner von beiden einen Code und BEIDE legen einen an - der Spieler hat dann
-- zwei gueltige Codes, sieht aber nur den neueren. Der aeltere bleibt
-- unsichtbar gueltig (harmlos, weil ihn nie jemand zu Gesicht bekommt, aber
-- unsauber). Direkt beobachtet im Dev-Server: Reacts StrictMode ruft den
-- Effekt im InviteScreen zweimal auf, und prompt lagen zwei Codes in der
-- Tabelle. Seit die Codes dauerhaft gelten, faellt so etwas nicht mehr von
-- selbst raus.
--
-- Advisory-Lock pro Spieler: der zweite Aufruf wartet und findet dann den
-- Code, den der erste angelegt hat. Kein Schema-Umbau noetig.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.get_or_create_my_invite()
returns text
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me   uuid := current_player_id();
  v_code text;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;

  -- Gilt bis Transaktionsende; parallele Aufrufe desselben Spielers reihen
  -- sich dahinter ein, statt beide einen eigenen Code anzulegen.
  perform pg_advisory_xact_lock(hashtextextended(v_me::text, 0));

  select code into v_code from invites
    where inviter_id = v_me and revoked_at is null
    order by created_at desc limit 1;

  if v_code is null then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into invites (code, inviter_id) values (v_code, v_me);
  end if;

  return v_code;
end;
$function$;

-- Bestandsaufnahme aufraeumen: pro Spieler bleibt der neueste gueltige Code
-- stehen, aeltere Doppel werden gesperrt (sie waren nie sichtbar).
update public.invites i
   set revoked_at = now()
 where i.revoked_at is null
   and exists (
     select 1 from public.invites j
      where j.inviter_id = i.inviter_id
        and j.revoked_at is null
        and (j.created_at, j.id) > (i.created_at, i.id)
   );

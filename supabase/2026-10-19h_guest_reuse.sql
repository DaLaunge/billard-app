-- Gaeste werden im Match IMMER per Hand eingetippt (Nutzer-Wunsch 2026-10-19: das erhoeht die Motivation, sich gleich anzumelden) - sie stehen nie
-- mehr in der Spielerliste und nicht mehr in der Suche. Damit ein Gast, der schon einmal gespielt hat, beim naechsten Eintippen nicht an
-- "Name ist schon vergeben" scheitert (und dann "Peter2" tippen muss), liefert add_guest_player() jetzt den vorhandenen GAST gleichen Namens
-- zurueck (Gross-/Kleinschreibung egal, der Spitzname ist citext). Gehoert der Name einem echten Mitglied, bleibt es beim Fehler.
-- Sonst unveraendert (Name 1-30 Zeichen, Bremse: hoechstens 40 neue Gaeste in 10 Minuten).
--
-- Test, dann Produktion. Idempotent.

create or replace function public.add_guest_player(p_nickname text)
 returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me   uuid := current_player_id();
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if v_nick = '' then raise exception 'Name fehlt.'; end if;
  if char_length(v_nick) > 30 then raise exception 'Name ist zu lang (max. 30 Zeichen).'; end if;

  -- schon ein Gast mit diesem Namen: wiederverwenden (zaehlt nicht gegen die Bremse)
  select * into v_guest from players where nickname = v_nick and is_guest;
  if found then return v_guest; end if;

  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;

  begin
    insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  return v_guest;
end;
$function$;

-- Kontrolle: Gaeste im System
select count(*) filter (where is_guest) as gaeste, count(*) filter (where not coalesce(is_guest, false)) as andere from players;

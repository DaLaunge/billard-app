import { useSyncExternalStore } from "react";

/* Club-Daten (Clubs, Mitglieder, Hauptclub je Spieler), modulweit wie BADGE_INFO: viele Stellen (Identitaetskarte, Profil
   bearbeiten, Verwaltung, spaeter Gegnerliste und Filter) brauchen sie, ohne dass App.jsx sie durch jede Komponente reicht.
   App.jsx laedt sie in loadClubs() und meldet sie mit setClubData(); wer etwas aendert (gruenden, beitreten, ...) ruft
   reloadClubs(). Fehlt die Tabelle (Migration 2026-10-19b noch nicht eingespielt), bleibt alles leer - die App laeuft normal. */

let data = { clubs: [], members: [], home: {}, requests: [], idByNick: {}, nickById: {}, loaded: false };
const subs = new Set();
let loader = null;

export const setClubData = (clubs, members, home, requests, people) => {
  const idByNick = {}, nickById = {};
  (people || []).forEach((p) => { idByNick[p.nickname] = p.id; nickById[p.id] = p.nickname; });
  data = { clubs, members, home: home || {}, requests: requests || [], idByNick, nickById, loaded: true };
  subs.forEach((f) => f());
};
export const setClubLoader = (fn) => { loader = fn; };
export const reloadClubs = () => (loader ? loader() : Promise.resolve());

export const useClubData = () => useSyncExternalStore(
  (cb) => { subs.add(cb); return () => subs.delete(cb); },
  () => data,
);

/* Clubs eines Spielers, Hauptclub zuerst. */
export const clubsOfPlayer = (d, playerId) => {
  if (!playerId) return [];
  const ids = d.members.filter((m) => m.player_id === playerId).map((m) => m.club_id);
  const list = d.clubs.filter((c) => ids.includes(c.id));
  const home = d.home[playerId];
  return list.sort((a, b) => (b.id === home) - (a.id === home) || a.name.localeCompare(b.name));
};

export const roleIn = (d, clubId, playerId) => d.members.find((m) => m.club_id === clubId && m.player_id === playerId)?.role || null;

/* Der Club, dessen Tag in einer Liste neben einem Spielernamen steht (Hauptclub, sonst der erste): Listen kennen Spieler nur
   beim Namen, deshalb die Zuordnung Name -> ID aus loadClubs(). null = kein Club (der Normalfall) - dann steht dort nichts. */
export const primaryClubOfNick = (d, nick) => {
  const id = d.idByNick?.[nick];
  return id ? clubsOfPlayer(d, id)[0] || null : null;
};

/* Mitgliederliste eines Clubs oeffnen (Klick auf einen Tag in einer Liste): nur die ID, gezeigt wird sie von ClubMembersHost. */
let viewing = null;
const viewSubs = new Set();
export const openClub = (id) => { viewing = id; viewSubs.forEach((f) => f()); };
export const closeClub = () => openClub(null);
export const useViewingClub = () => useSyncExternalStore(
  (cb) => { viewSubs.add(cb); return () => viewSubs.delete(cb); },
  () => viewing,
);

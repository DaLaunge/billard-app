import { MapPin } from "lucide-react";
import { useLocations } from "../../lib/locationStore";
import RouteButton from "./RouteButton";

/* Ort eines Turniers (oder einer Winner-Stays-Runde), anklickbar: ein Lokal aus dem Katalog oeffnet die Route in der gewaehlten Karten-App
   (RouteButton), ein getippter Ort sucht ihn in Google Maps. Immer mit dem ueblichen Kartenstift. Nichts, wenn kein Ort gesetzt ist. */
export default function PlaceLink({ locationId, text, className = "place-link" }) {
  const { list } = useLocations();
  const place = locationId ? list.find((l) => l.id === locationId) : null;
  if (place) {
    return (
      <span className={className} onClick={(e) => e.stopPropagation()}>
        <RouteButton place={place} className="route-link" size={14}> {place.name}</RouteButton>
      </span>
    );
  }
  if (!text) return null;
  return (
    <span className={className} onClick={(e) => e.stopPropagation()}>
      <a className="route-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
        title={text}><MapPin size={14} /> {text}</a>
    </span>
  );
}

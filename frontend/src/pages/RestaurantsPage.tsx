import { useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { geolocationError, unsupportedLocation } from "@/lib/location";
import type { PlaceMatch, Restaurant } from "@/lib/types";
import { RestaurantCard } from "@/components/RestaurantCard";
import { Alert, Button, EmptyState, Field, PageHeader, TextInput } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type SelectedPlace = PlaceMatch & { source: "search" | "device" };

function placeQuery(city: string, neighbourhood: string): string {
  const cityName = city.trim();
  const areaName = neighbourhood.trim();
  if (!areaName) return cityName;
  if (!cityName || areaName.toLowerCase().includes(cityName.toLowerCase())) return areaName;
  return `${areaName}, ${cityName}`;
}

export function RestaurantsPage() {
  useDocumentTitle("Restaurants");
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("query") ?? "burger");
  const [city, setCity] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [category, setCategory] = useState<"food" | "cafe" | "pharmacy" | "grocery" | "shop">("food");
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [useSaved, setUseSaved] = useState(false);
  const [savePrecise, setSavePrecise] = useState(false);
  const [minRating, setMinRating] = useState("");
  const [price, setPrice] = useState("");
  const [openNow, setOpenNow] = useState(false);
  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [meta, setMeta] = useState<{ disclaimer: string; distanceNote: string | null; source: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationPending, setLocationPending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState("Location is used for this search. It is not stored unless you tick save.");

  const typedPlace = placeQuery(city, neighbourhood);

  const editPlace = (nextCity: string, nextArea: string) => {
    setCity(nextCity);
    setNeighbourhood(nextArea);
    if (selected) {
      setSelected(null);
      setResults(null);
      setMeta(null);
      setLocationNote("The previous place was cleared. Find this place again.");
    }
    setMatches([]);
    setLocationError("");
  };

  const onPlaceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void findPlace();
    }
  };

  const lookup = async (text: string): Promise<PlaceMatch[]> => {
    setLocationPending(true);
    setLocationError("");
    setMatches([]);
    try {
      const found = await api.geocodePlaces(text);
      setMatches(found.results);
      if (found.results.length === 0) {
        setLocationError("No matching place came back. Try a clearer city or area name.");
      }
      return found.results;
    } catch (lookupError) {
      console.error("Place lookup failed", lookupError);
      setLocationError(lookupError instanceof ApiError ? lookupError.message : "The city search failed.");
      return [];
    } finally {
      setLocationPending(false);
    }
  };

  const findPlace = async () => {
    if (locationPending) return;
    if (!typedPlace) {
      setLocationError("Type a city or area first.");
      setMatches([]);
      setSelected(null);
      return;
    }
    setLocationNote("Looking up that place.");
    const found = await lookup(typedPlace);
    if (found.length > 0) setLocationNote("Choose the matching place. The restaurant search will use that choice.");
  };

  const choosePlace = (match: PlaceMatch) => {
    setSelected({ ...match, source: "search" });
    setUseSaved(false);
    setMatches([]);
    setLocationError("");
    setLocationNote("This search will use the place you selected.");
  };

  const locate = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      setLocationError(unsupportedLocation);
      return;
    }
    setLocating(true);
    setLocationError("");
    setLocationNote("Asking the browser for this device's location. SAHARA does not keep watching it.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        void (async () => {
          let label: string | null = null;
          try {
            const found = await api.reversePlace({ latitude, longitude });
            label = found.label;
          } catch (reverseError) {
            console.error("Reverse geocoding failed", reverseError);
          }
          setLocationError("");
          setSelected({ label: label ?? "Coordinates from this device", latitude, longitude, source: "device" });
          setUseSaved(false);
          setMatches([]);
          setLocationNote(
            label
              ? "This search will use the address returned for this device. SAHARA is not tracking you."
              : "Coordinates are ready. A street address did not come back. SAHARA is not tracking you.",
          );
          setLocating(false);
        })();
      },
      (positionError) => {
        setLocating(false);
        setLocationNote("Location was not found. The city search below still works.");
        setLocationError(geolocationError(positionError.code, "Type a city or area instead."));
        if (selected?.source === "device") setSelected(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const search = async () => {
    const food = query.trim();
    if (pending || locationPending) return;
    if (!food) {
      setError("Say what you want to look for.");
      return;
    }
    let origin = selected;
    if (!origin && !useSaved) {
      if (!typedPlace) {
        setError("Type a city, or choose Find restaurants near me.");
        setResults(null);
        return;
      }
      const found = await lookup(typedPlace);
      if (found.length === 1) {
        origin = { ...found[0], source: "search" };
        setSelected(origin);
        setMatches([]);
      } else if (found.length > 1) {
        setError("Choose one of the matching places, then search again.");
        setResults(null);
        return;
      } else {
        setResults(null);
        return;
      }
    }
    setPending(true);
    setError("");
    try {
      if (savePrecise && origin) {
        const saved = await api.saveLocation({
          label: origin.label.slice(0, 80),
          latitude: origin.latitude,
          longitude: origin.longitude,
          savePrecise: true,
        });
        refresh(saved.user);
      }
      const found = await api.searchRestaurants({
        query: food,
        category,
        latitude: origin?.latitude,
        longitude: origin?.longitude,
        useSaved: origin ? false : useSaved,
        minRating: minRating ? Number(minRating) : undefined,
        price: price ? (price as "inexpensive" | "moderate" | "expensive" | "very_expensive") : undefined,
        openNow,
      });
      setResults(found.results);
      setMeta({ disclaimer: found.disclaimer, distanceNote: found.distanceNote, source: found.source });
    } catch (searchError) {
      console.error("Restaurant search failed", searchError);
      setResults(null);
      setError(searchError instanceof ApiError ? searchError.message : "Restaurant search failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <PageHeader eyebrow="Places" title="Nearby places" body="Search a city, then an area inside that city. Cards show only what comes back. Missing hours, menus, ratings, and photos stay blank." />
      <div className="flex flex-wrap gap-2">
        {[
          ["burger", "food", "Burgers"],
          ["pizza", "food", "Pizza"],
          ["biryani", "food", "Biryani"],
          ["pakistani", "food", "Pakistani"],
          ["bbq", "food", "BBQ"],
          ["chinese", "food", "Chinese"],
          ["fast food", "food", "Fast food"],
          ["dessert", "food", "Desserts"],
          ["healthy", "food", "Healthy"],
          ["cafe", "cafe", "Cafes"],
          ["coffee", "cafe", "Coffee"],
          ["pharmacy", "pharmacy", "Pharmacies"],
          ["grocery", "grocery", "Grocery"],
        ].map(([nextQuery, nextCategory, label]) => (
          <button
            key={label}
            type="button"
            className="chip text-xs"
            onClick={() => {
              setQuery(nextQuery);
              setCategory(nextCategory as "food" | "cafe" | "pharmacy" | "grocery");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="panel mt-4 grid max-w-3xl gap-4 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void findPlace();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City" hint="Lahore, Karachi, Islamabad, Peshawar, Swabi, or another city.">
            <TextInput value={city} placeholder="Lahore" onChange={(event) => editPlace(event.target.value, neighbourhood)} onKeyDown={onPlaceKeyDown} />
          </Field>
          <Field label="Area in that city" hint="Optional. Example: DHA, Gulberg, Johar Town, F-10, University Road.">
            <TextInput value={neighbourhood} onChange={(event) => editPlace(city, event.target.value)} onKeyDown={onPlaceKeyDown} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Button type="submit" variant="ghost" disabled={locationPending || locating}>
            {locationPending ? "Looking up…" : "Find this place"}
          </Button>
          <Button variant="ghost" type="button" disabled={locating || locationPending} onClick={locate}>
            {locating ? "Finding location…" : "Find restaurants near me"}
          </Button>
          {selected ? (
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setSelected(null);
                setLocationNote("Location cleared. Type a city or area.");
              }}
            >
              Clear location
            </Button>
          ) : null}
        </div>
        <p role="status" className="text-xs leading-5 text-soft">{locationNote}</p>
        {locationError ? <Alert>{locationError}</Alert> : null}
        {selected ? (
          <p className="rounded-2xl border border-line bg-muted px-3 py-2 text-sm">
            Using {selected.label}
          </p>
        ) : null}
        {matches.length > 0 ? (
          <ul className="grid gap-2">
            {matches.map((match) => (
              <li key={`${match.latitude},${match.longitude},${match.label}`}>
                <button type="button" className="w-full rounded-2xl border border-line px-3 py-2 text-left text-sm" onClick={() => choosePlace(match)}>
                  {match.label}
                  {match.kind ? <span className="text-soft"> · {match.kind}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      <form
        className="panel mt-4 grid max-w-3xl gap-4 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Field label="What to look for">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-soft"><input type="checkbox" checked={useSaved} onChange={(event) => { setUseSaved(event.target.checked); if (event.target.checked) setSelected(null); }} />Use saved place</label>
          <label className="inline-flex items-center gap-2 text-soft"><input type="checkbox" checked={savePrecise} onChange={(event) => setSavePrecise(event.target.checked)} />Save precise location</label>
          <label className="inline-flex items-center gap-2 text-soft"><input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)} />Open now</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum rating">
            <select className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm" value={minRating} onChange={(event) => setMinRating(event.target.value)}>
              <option value="">Any</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </Field>
          <Field label="Price" hint="Price, rating, and open-now are used only when Google Places is connected.">
            <select className="w-full rounded-2xl border border-line bg-muted px-3 py-2.5 text-sm" value={price} onChange={(event) => setPrice(event.target.value)}>
              <option value="">Any</option>
              <option value="inexpensive">Inexpensive</option>
              <option value="moderate">Moderate</option>
              <option value="expensive">Expensive</option>
            </select>
          </Field>
        </div>
        <Button type="submit" disabled={pending || locationPending || locating}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      {error ? (
        <div className="mt-6 max-w-3xl">
          <Alert>
            <p>{error}</p>
            <button type="button" className="mt-2 text-sm font-semibold" onClick={() => void search()}>Retry</button>
          </Alert>
        </div>
      ) : null}
      {results && results.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No places came back" body="Try a wider area or a simpler food word. Nothing was invented to fill this list." />
        </div>
      ) : null}
      {results && results.length > 0 && meta ? (
        <div className="mt-8">
          <p className="max-w-3xl text-xs leading-5 text-soft">Source: {meta.source}. {meta.disclaimer} {meta.distanceNote ?? ""}</p>
          <div className="mt-3 flex gap-2">
            <Button variant={view === "list" ? "primary" : "ghost"} type="button" onClick={() => setView("list")}>List</Button>
            <Button variant={view === "map" ? "primary" : "ghost"} type="button" onClick={() => setView("map")}>Map</Button>
          </div>
          {view === "map" ? (
            <PlaceMap place={results.find((place) => place.id === selectedId) ?? results.find((place) => typeof place.latitude === "number")} />
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((place) => (
              <div key={place.id}>
                <RestaurantCard place={place} />
                {typeof place.latitude === "number" ? (
                  <button type="button" className="mt-2 text-xs font-semibold" onClick={() => { setSelectedId(place.id); setView("map"); }}>
                    Show on map
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlaceMap({ place }: { place: Restaurant | undefined }) {
  if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return <p className="mt-4 text-sm text-soft">This result did not include coordinates, so the map stays empty.</p>;
  }
  const lat = place.latitude;
  const lng = place.longitude;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm">{place.name}</p>
      <iframe title={`Map of ${place.name}`} src={src} className="h-72 w-full rounded-3xl border border-line" />
    </div>
  );
}

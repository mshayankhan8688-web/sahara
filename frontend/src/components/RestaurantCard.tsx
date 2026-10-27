import { ExternalLink, MapPin, Star } from "lucide-react";
import { photoUrl } from "@/lib/api";
import type { Restaurant } from "@/lib/types";

export function RestaurantCard({ place }: { place: Restaurant }) {
  const photo = photoUrl(place.photoToken);
  return (
    <article className="panel overflow-hidden">
      {photo ? (
        <img src={photo} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="grid h-28 place-items-center bg-muted text-xs uppercase tracking-[0.14em] text-soft">No photo returned</div>
      )}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-serif text-2xl leading-none">{place.name}</h3>
          {place.primaryType ? <p className="mt-1 text-xs uppercase tracking-[0.12em] text-soft">{place.primaryType}</p> : null}
        </div>
        {place.address ? <p className="text-sm leading-6 text-soft">{place.address}</p> : <p className="text-sm text-soft">Address was not provided.</p>}
        {place.phone ? <p className="text-sm">{place.phone}</p> : null}
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {typeof place.rating === "number" ? (
            <div className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">Rating</dt>
              <dd>
                {place.rating}
                {typeof place.ratingCount === "number" ? ` (${place.ratingCount})` : ""}
              </dd>
            </div>
          ) : null}
          {place.priceLabel ? (
            <div>
              <dt className="sr-only">Price</dt>
              <dd>{place.priceLabel}</dd>
            </div>
          ) : null}
          {typeof place.distanceKm === "number" ? (
            <div>
              <dt className="sr-only">Distance</dt>
              <dd>{place.distanceKm} km</dd>
            </div>
          ) : null}
          {typeof place.openNow === "boolean" ? (
            <div>
              <dt className="sr-only">Open now</dt>
              <dd>{place.openNow ? "Open now" : "Closed now"}</dd>
            </div>
          ) : null}
        </dl>
        {place.summary ? <p className="text-sm leading-6 text-soft">{place.summary}</p> : null}
        {place.weekdayHours ? (
          <ul className="space-y-0.5 text-xs leading-5 text-soft">
            {place.weekdayHours.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {typeof place.servesVegetarianFood === "boolean" ? (
          <p className="text-xs text-soft">{place.servesVegetarianFood ? "Listed as serving vegetarian food." : "Not listed as serving vegetarian food."}</p>
        ) : null}
        {place.photoCredit ? <p className="text-xs text-soft">Photo: {place.photoCredit}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          {place.mapsUrl ? (
            <a className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm" href={place.mapsUrl} target="_blank" rel="noreferrer">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Directions
            </a>
          ) : (
            <span className="text-xs text-soft">Directions were not provided.</span>
          )}
          {place.website ? (
            <a className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm" href={place.website} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Website
            </a>
          ) : (
            <span className="text-xs text-soft">No website returned. Menu details were not included.</span>
          )}
        </div>
      </div>
    </article>
  );
}

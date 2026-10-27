import { Router } from "express";
import { asyncHandler, HttpError } from "../http.js";
import { routeParam } from "../lib/objectId.js";
import { geocodeSchema, reverseSchema, searchSchema } from "../lib/schemas.js";
import { readPhoto as readPhotoToken, signPhoto } from "../lib/tokens.js";
import { User } from "../models/User.js";
import { requireUser } from "../middleware/auth.js";
import { searchLimiter } from "../middleware/limits.js";
import { validateBody } from "../middleware/validate.js";
import { reversePlace, searchPlaces } from "../services/geocode.js";
import { getRestaurant, readPhoto, searchRestaurants } from "../services/places.js";

export const restaurantRouter = Router();

restaurantRouter.post(
  "/geocode",
  requireUser,
  searchLimiter,
  validateBody(geocodeSchema),
  asyncHandler(async (req, res) => {
    const results = await searchPlaces(req.body.query);
    res.json({ results });
  }),
);

restaurantRouter.post(
  "/reverse",
  requireUser,
  searchLimiter,
  validateBody(reverseSchema),
  asyncHandler(async (req, res) => {
    const label = await reversePlace(req.body.latitude, req.body.longitude);
    res.json({ label });
  }),
);

restaurantRouter.post(
  "/search",
  requireUser,
  searchLimiter,
  validateBody(searchSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new HttpError(401, "Sign in again.", "UNAUTHENTICATED");
    const saved = user.savedLocation;
    const latitude = req.body.latitude ?? (req.body.useSaved ? saved?.latitude : undefined);
    const longitude = req.body.longitude ?? (req.body.useSaved ? saved?.longitude : undefined);
    const area = req.body.area || (req.body.useSaved && !latitude ? saved?.label : undefined);
    if (typeof latitude !== "number" && !area) {
      throw new HttpError(400, "Share a location or type a city or area.", "LOCATION_REQUIRED");
    }
    const found = await searchRestaurants({
      query: req.body.query,
      latitude,
      longitude,
      area,
      minRating: req.body.minRating,
      price: req.body.price,
      openNow: req.body.openNow,
      category: req.body.category,
    });
    res.json({
      source: found.source,
      disclaimer: "Halal status, allergens, hours, and medical suitability are not verified by SAHARA. Confirm with the place.",
      distanceNote: found.distanceNote ?? null,
      results: found.results.map((place) => ({
        ...place,
        photoToken: place.photoName ? signPhoto(place.photoName) : undefined,
      })),
    });
  }),
);

restaurantRouter.get(
  "/:placeId",
  requireUser,
  asyncHandler(async (req, res) => {
    const restaurant = await getRestaurant(routeParam(req.params.placeId));
    res.json({
      source: restaurant.id.startsWith("osm-") ? "OpenStreetMap" : "Google Places",
      restaurant: { ...restaurant, photoToken: restaurant.photoName ? signPhoto(restaurant.photoName) : undefined },
    });
  }),
);

export const photoRouter = Router();

photoRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const photoName = readPhotoToken(token);
    const photo = await readPhoto(photoName);
    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.send(Buffer.from(photo.bytes));
  }),
);

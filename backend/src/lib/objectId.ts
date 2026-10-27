import mongoose from "mongoose";
import { HttpError } from "../http.js";

export function routeParam(value: string | undefined, message = "That record was not found."): string {
  if (!value) throw new HttpError(404, message, "NOT_FOUND");
  return value;
}

export function asObjectId(value: string, message = "That record was not found."): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new HttpError(404, message, "NOT_FOUND");
  return new mongoose.Types.ObjectId(value);
}

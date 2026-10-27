import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(config.mongodbUri);
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw new Error("Unable to connect to MongoDB");
  }
}

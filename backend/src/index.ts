import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";

await connectDb();
createApp().listen(config.port, () => {
  console.log(`HeartSpace API listening on port ${config.port}`);
});

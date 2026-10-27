import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const envPath = new URL("../.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const key = env.GEMINI_API_KEY ?? "";
const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
if (key.length < 20) {
  console.log("NO_KEY");
  process.exit(2);
}

const probe = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word ok" }] }] }),
  },
);
const probeBody = await probe.json();
const probeText = probeBody?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() ?? "";
if (!probe.ok || !probeText) {
  const detail = JSON.stringify(probeBody.error ?? probeBody).replaceAll(key, "[redacted]");
  console.log(`GEMINI_WARN ${detail.slice(0, 400)}`);
} else {
  console.log(`GEMINI_OK model=${model}`);
}

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data/mongo");
mkdirSync(dataDir, { recursive: true });

const listeners = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout
  .split(/\r?\n/)
  .filter((line) => line.includes(":4000") && line.includes("LISTENING"));
for (const line of listeners) {
  const pid = line.trim().split(/\s+/).at(-1);
  if (pid && pid !== "0") {
    try {
      process.kill(Number(pid));
    } catch {
      // The previous listener may already be gone.
    }
  }
}
const mongod = spawnSync(
  "powershell",
  ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name = 'mongod.exe'\" | Where-Object { $_.CommandLine -like '*data*mongo*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
  { encoding: "utf8" },
);
if (mongod.status !== 0 && mongod.stderr) console.error(mongod.stderr.slice(0, 300));
await new Promise((resolve) => setTimeout(resolve, 1000));

const memory = await MongoMemoryServer.create({
  instance: {
    dbName: "heartspace",
    dbPath: dataDir,
    storageEngine: "wiredTiger",
  },
});
const uri = memory.getUri("heartspace");
const lines = readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .map((line) => (line.startsWith("MONGODB_URI=") ? `MONGODB_URI=${uri}` : line));
writeFileSync(envPath, `${lines.join("\n").replace(/\n*$/, "\n")}`, "utf8");

for (const [name, value] of Object.entries({ ...env, MONGODB_URI: uri, GEMINI_MODEL: model, GEMINI_API_KEY: key })) {
  process.env[name] = value;
}

await import("../src/index.ts");

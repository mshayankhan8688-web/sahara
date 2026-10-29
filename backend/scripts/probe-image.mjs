import { readFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const key = env.GEMINI_API_KEY || "";
if (key.length < 10) {
  console.log("NO_KEY");
  process.exit(2);
}

const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 60_000 } });
const models = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.5-flash-image-preview",
  "gemini-nano-banana-2.1",
  "imagen-4.0-generate-001",
];

for (const model of models) {
  try {
    if (model.startsWith("imagen")) {
      const response = await ai.models.generateImages({
        model,
        prompt: "A simple flat icon of an orange sun on a dark background, no text",
        config: { numberOfImages: 1 },
      });
      const bytes = response?.generatedImages?.[0]?.image?.imageBytes;
      const size = bytes ? Buffer.from(bytes, "base64").length : 0;
      console.log(`OK_IMAGEN ${model} bytes=${size}`);
      if (size > 100) break;
      continue;
    }
    const response = await ai.models.generateContent({
      model,
      contents: "Generate a simple flat icon of an orange sun on a dark background. No text in the image.",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        abortSignal: AbortSignal.timeout(55_000),
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((part) => part.inlineData?.data);
    const mime = img?.inlineData?.mimeType || "";
    const size = img?.inlineData?.data ? Buffer.from(img.inlineData.data, "base64").length : 0;
    const text = parts.find((part) => part.text)?.text?.slice(0, 80) || "";
    console.log(`OK_CONTENT ${model} mime=${mime} bytes=${size} text=${JSON.stringify(text)}`);
    if (size > 100) break;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${model} ${msg.slice(0, 220).replaceAll(key, "[redacted]")}`);
  }
}

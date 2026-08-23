import OpenAI from "openai";

const MODEL = process.env.SCANNER_MODEL || "gpt-5.6-luna";

const PROMPT = `
You are a specialist Pokémon Trading Card Game card scanner.

Analyze the COMPLETE card image carefully. Do not guess from one OCR fragment.
Use the artwork, card layout, printed name, HP, language, set code/symbol,
collector number, set total, and visible foil/stamp pattern together.

The app supports English, Japanese, Simplified/Traditional Chinese, Korean,
Dutch, German, French, Italian and Spanish cards, including very old cards,
new releases, promos, gallery/special subsets and regional releases.

Important rules:
1. Identify the BASE CARD independently from its foil/finish.
2. Read the collector number at the bottom exactly when possible:
   examples: 012/086, 130/094, TG14/TG30, GG21/GG70, SWSH075.
3. Read the printed set code when present, e.g. BLK, PFL, BRS, SVP.
4. For older cards with a graphical set symbol, identify the likely set name.
5. For Chinese/Japanese/Korean cards, identify the language and set/card number
   even if the printed card name is not Latin script.
6. "card_name" should be the canonical English card/Pokémon name when known.
   "printed_name" should be the visible printed name if readable.
7. Finish is SECONDARY. Choose one of:
   Basic / Normaal, Holo, Reverse Holo, Poké Ball, Great Ball, Master Ball,
   Cracked Ice Holo, Cosmos Holo, Galaxy Holo, Pokémon Together stamp,
   Snowflake stamp, Play! Pokémon stamp, Other, Unknown.
8. A Poké Ball / Great Ball / Master Ball / stamp pattern must never change
   the base card identity.
9. If a field is genuinely unreadable, return an empty string instead of inventing it.
10. found=false only when you cannot identify a useful base-card identity.

Return ONLY valid JSON with this exact shape:
{
  "found": true,
  "card_name": "",
  "printed_name": "",
  "language": "",
  "set_name": "",
  "set_code": "",
  "card_number": "",
  "set_total": "",
  "collector_number": "",
  "finish": "Unknown",
  "identity_confidence": 0.0,
  "finish_confidence": 0.0,
  "notes": ""
}

confidence values are between 0 and 1.
`;

function parseJson(text) {
  const raw = String(text || "").trim();
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error("AI returned no valid JSON");
  }
}

function cleanResult(x) {
  const allowedFinish = new Set([
    "Basic / Normaal","Holo","Reverse Holo","Poké Ball","Great Ball",
    "Master Ball","Cracked Ice Holo","Cosmos Holo","Galaxy Holo",
    "Pokémon Together stamp","Snowflake stamp","Play! Pokémon stamp",
    "Other","Unknown"
  ]);

  const out = {
    found: Boolean(x?.found),
    card_name: String(x?.card_name || "").trim(),
    printed_name: String(x?.printed_name || "").trim(),
    language: String(x?.language || "").trim(),
    set_name: String(x?.set_name || "").trim(),
    set_code: String(x?.set_code || "").trim(),
    card_number: String(x?.card_number || "").trim(),
    set_total: String(x?.set_total || "").trim(),
    collector_number: String(x?.collector_number || "").trim(),
    finish: allowedFinish.has(x?.finish) ? x.finish : "Unknown",
    identity_confidence: Math.max(0, Math.min(1, Number(x?.identity_confidence || 0))),
    finish_confidence: Math.max(0, Math.min(1, Number(x?.finish_confidence || 0))),
    notes: String(x?.notes || "").trim().slice(0, 500)
  };

  // Derive collector number when model split it into number/total.
  if (!out.collector_number && out.card_number && out.set_total) {
    out.collector_number = `${out.card_number}/${out.set_total}`;
  }

  return out;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Gebruik POST." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "AI scanner is nog niet geconfigureerd: OPENAI_API_KEY ontbreekt in Vercel."
    });
  }

  const image = req.body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return res.status(400).json({ error: "Geen geldige kaartafbeelding ontvangen." });
  }

  // Rough safety limit for a base64 data URL.
  if (image.length > 12_000_000) {
    return res.status(413).json({ error: "Afbeelding is te groot. Probeer een kleinere foto." });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: PROMPT },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }
      ],
      max_output_tokens: 900
    });

    const parsed = cleanResult(parseJson(response.output_text));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("OpenAI scan error:", error);

    const status = Number(error?.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    return res.status(safeStatus).json({
      error: safeStatus === 401
        ? "OpenAI API-sleutel is ongeldig."
        : safeStatus === 429
        ? "OpenAI API-limiet of tegoed bereikt. Controleer Billing/Limits."
        : "AI kaartscan mislukt. Probeer opnieuw."
    });
  }
}

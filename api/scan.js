import OpenAI from "openai";

export const config = {
  maxDuration: 30
};

const MODEL = process.env.SCANNER_MODEL || "gpt-5.6-luna";

const LANGUAGES = [
  "English",
  "Japanese",
  "Chinese",
  "Simplified Chinese",
  "Traditional Chinese",
  "Korean",
  "Dutch",
  "German",
  "French",
  "Italian",
  "Spanish",
  "Portuguese",
  "Other",
  "Unknown"
];

const FINISHES = [
  "Basic / Normaal",
  "Holo",
  "Reverse Holo",
  "Poké Ball",
  "Great Ball",
  "Master Ball",
  "Cracked Ice Holo",
  "Cosmos Holo",
  "Galaxy Holo",
  "Pokémon Together stamp",
  "Snowflake stamp",
  "Play! Pokémon stamp",
  "Other",
  "Unknown"
];

const CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    card_name: { type: "string" },
    printed_name: { type: "string" },
    language: { type: "string", enum: LANGUAGES },
    set_name: { type: "string" },
    set_code: { type: "string" },
    card_number: { type: "string" },
    set_total: { type: "string" },
    collector_number: { type: "string" },
    finish: { type: "string", enum: FINISHES },
    identity_confidence: { type: "number", minimum: 0, maximum: 1 },
    finish_confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" }
  },
  required: [
    "found",
    "card_name",
    "printed_name",
    "language",
    "set_name",
    "set_code",
    "card_number",
    "set_total",
    "collector_number",
    "finish",
    "identity_confidence",
    "finish_confidence",
    "notes"
  ]
};

const MAIN_PROMPT = [
  "You are a specialist Pokémon Trading Card Game scanner.",
  "Analyze one Pokémon TCG card image and identify the exact base card.",
  "",
  "Use all visible evidence together:",
  "- artwork",
  "- printed card name",
  "- original writing system",
  "- HP",
  "- type",
  "- evolution stage",
  "- collector number",
  "- set total",
  "- set code",
  "- graphical set symbol",
  "- promo or subset numbering",
  "- copyright year",
  "- regional card layout",
  "- foil or stamp pattern",
  "",
  "Supported languages:",
  "English, Japanese, Simplified Chinese, Traditional Chinese, Korean, Dutch, German, French, Italian, Spanish, Portuguese.",
  "",
  "Rules:",
  "1. Identify the base card first.",
  "2. Finish or foil pattern must never change the base-card identity.",
  "3. For Japanese, Chinese and Korean cards, do not depend on Latin OCR.",
  "4. Use original-script text, artwork, HP, numbering, set marks and layout together.",
  "5. card_name must be the canonical English card or Pokémon name when confidently known.",
  "6. printed_name should preserve the original printed name when readable.",
  "7. Never invent unreadable digits.",
  "8. Never invent a set code.",
  "9. If the exact set cannot be determined reliably, leave set_name or set_code empty rather than guessing.",
  "10. found must be false only when useful base-card identity cannot be established.",
  "",
  "Number formatting:",
  "- card_number is the numerator only, for example 074, 224, 230, TG14.",
  "- set_total is the denominator only, for example 187, 207, TG30.",
  "- collector_number is the full value, for example 074/187 or 230/207.",
  "- Do not return card_number as 224/187.",
  "- Do not confuse rarity labels RR, SR, SAR, AR or UR with set codes.",
  "",
  "Finish values:",
  "Basic / Normaal, Holo, Reverse Holo, Poké Ball, Great Ball, Master Ball, Cracked Ice Holo, Cosmos Holo, Galaxy Holo, Pokémon Together stamp, Snowflake stamp, Play! Pokémon stamp, Other, Unknown.",
  "",
  "If finish is uncertain, use Unknown.",
  "Return only the structured result."
].join("\n");

const FALLBACK_PROMPT = [
  "Perform a simplified recovery scan of this Pokémon TCG card.",
  "Focus only on the most reliable visible features:",
  "1. language",
  "2. card or Pokémon identity from artwork and printed name",
  "3. collector number",
  "4. set code or set symbol if clearly visible",
  "5. basic finish type",
  "",
  "For Chinese cards:",
  "- read Simplified or Traditional Chinese directly",
  "- use artwork, HP, collector number and regional markings",
  "- do not require English text",
  "- if set name is uncertain, leave it empty",
  "- still return the card when the base identity and number are useful",
  "",
  "For Japanese and Korean cards, use the same principle.",
  "Do not invent values.",
  "Return only the structured result."
].join("\n");

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp01(value) {
  const n = Number(value || 0);
  return Math.max(0, Math.min(1, n));
}

function splitCollector(value) {
  const match = cleanText(value).match(/^([^/]+)\/([^/]+)$/);
  return match ? [match[1].trim(), match[2].trim()] : null;
}

function normalizeResult(raw) {
  let cardNumber = cleanText(raw?.card_number);
  let setTotal = cleanText(raw?.set_total);
  let collectorNumber = cleanText(raw?.collector_number);

  const parts = splitCollector(collectorNumber) || splitCollector(cardNumber);

  if (parts) {
    cardNumber = parts[0];

    if (!setTotal) {
      setTotal = parts[1];
    }

    collectorNumber = `${parts[0]}/${parts[1]}`;
  } else if (!collectorNumber && cardNumber && setTotal) {
    collectorNumber = `${cardNumber}/${setTotal}`;
  }

  return {
    found: Boolean(raw?.found),
    card_name: cleanText(raw?.card_name),
    printed_name: cleanText(raw?.printed_name),
    language: LANGUAGES.includes(raw?.language) ? raw.language : "Unknown",
    set_name: cleanText(raw?.set_name),
    set_code: cleanText(raw?.set_code),
    card_number: cardNumber,
    set_total: setTotal,
    collector_number: collectorNumber,
    finish: FINISHES.includes(raw?.finish) ? raw.finish : "Unknown",
    identity_confidence: clamp01(raw?.identity_confidence),
    finish_confidence: clamp01(raw?.finish_confidence),
    notes: cleanText(raw?.notes).slice(0, 900)
  };
}

function extractOutputText(response) {
  const direct = cleanText(response?.output_text);

  if (direct) {
    return direct;
  }

  const pieces = [];

  for (const item of response?.output || []) {
    if (typeof item?.text === "string") {
      pieces.push(item.text);
    }

    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        pieces.push(content.text);
      }

      if (typeof content?.output_text === "string") {
        pieces.push(content.output_text);
      }

      if (typeof content?.json === "string") {
        pieces.push(content.json);
      }

      if (content?.json && typeof content.json === "object") {
        pieces.push(JSON.stringify(content.json));
      }
    }
  }

  return cleanText(pieces.join("\n"));
}

function parseStructuredResult(response) {
  const output = extractOutputText(response);

  if (!output) {
    throw new Error("AI returned no usable output");
  }

  const cleaned = output
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new Error("AI returned invalid JSON");
    }

    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  return normalizeResult(parsed);
}

async function callVision(client, image, prompt, detail, maxOutputTokens) {
  const response = await client.responses.create({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt
          },
          {
            type: "input_image",
            image_url: image,
            detail: detail
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "pokemon_card_scan",
        strict: true,
        schema: CARD_SCHEMA
      }
    },
    max_output_tokens: maxOutputTokens
  });

  return parseStructuredResult(response);
}

function jsonError(res, status, message, diagnostic) {
  return res.status(status).json({
    ok: false,
    error: message,
    diagnostic: cleanText(diagnostic).slice(0, 500)
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return jsonError(res, 405, "Gebruik POST.", "");
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(
      res,
      503,
      "OPENAI_API_KEY ontbreekt in Vercel.",
      ""
    );
  }

  const image = req.body?.image;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return jsonError(
      res,
      400,
      "Geen geldige kaartafbeelding ontvangen.",
      ""
    );
  }

  if (image.length > 12000000) {
    return jsonError(
      res,
      413,
      "Afbeelding is te groot. Probeer een kleinere foto.",
      ""
    );
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  let primaryError = null;

  try {
    const result = await callVision(
      client,
      image,
      MAIN_PROMPT,
      "high",
      1000
    );

    return res.status(200).json(result);
  } catch (error) {
    primaryError = error;

    console.warn(
      "Primary scan failed:",
      error?.message || String(error)
    );
  }

  try {
    const fallback = await callVision(
      client,
      image,
      FALLBACK_PROMPT,
      "auto",
      650
    );

    fallback.notes = cleanText(
      `${fallback.notes} | Recovery scan used`
    ).slice(0, 900);

    return res.status(200).json(fallback);
  } catch (fallbackError) {
    console.error("Fallback scan failed:", {
      primary: primaryError?.message,
      fallback: fallbackError?.message,
      status: fallbackError?.status,
      code: fallbackError?.code,
      type: fallbackError?.type
    });

    const status = Number(
      fallbackError?.status ||
      primaryError?.status ||
      0
    );

    if (status === 401) {
      return jsonError(
        res,
        401,
        "OpenAI API-sleutel is ongeldig.",
        fallbackError?.message || primaryError?.message || ""
      );
    }

    if (status === 429) {
      return jsonError(
        res,
        429,
        "OpenAI API-limiet of tegoed bereikt.",
        fallbackError?.message || primaryError?.message || ""
      );
    }

    return jsonError(
      res,
      500,
      "AI kaartscan mislukt. Probeer opnieuw.",
      `Primary: ${primaryError?.message || "unknown"} | Fallback: ${fallbackError?.message || "unknown"}`
    );
  }
}

import OpenAI from "openai";

export const config = {
  maxDuration: 30
};

const MODEL = process.env.SCANNER_MODEL || "gpt-5.6-luna";

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

const PROMPT = `
You are a specialist Pokémon Trading Card Game scanner.

Analyze ONE Pokémon TCG card image and return the best possible identification.

Use all visible information together:
- artwork
- printed card name
- original writing system
- HP
- type
- evolution stage
- set code
- graphical set symbol
- collector number
- printed set total
- promo or subset numbering
- copyright year
- regional card layout
- foil or stamp pattern

SUPPORTED LANGUAGES:
English
Japanese
Simplified Chinese
Traditional Chinese
Korean
Dutch
German
French
Italian
Spanish
Portuguese

BASE CARD RULES:
1. Identify the base card first.
2. Finish or foil pattern must never change the base-card identity.
3. For Japanese, Chinese and Korean cards, do not depend on Latin OCR.
4. Use original-script text, artwork, HP, numbering and set marks together.
5. card_name should be the canonical English Pokémon or card name when confidently known.
6. printed_name should preserve the printed original-language name when readable.
7. Never invent unreadable digits.
8. Never invent a set code.
9. If the exact set cannot be determined, leave set_name or set_code empty rather than guessing.
10. found=false only when the card identity is genuinely unusable.

NUMBER RULES:
- card_number = numerator only, for example 012, 074, 224, TG14, GG21, SWSH075.
- set_total = denominator only when printed, for example 086, 187, 207, TG30, GG70.
- collector_number = full printed value, for example 012/086 or 224/187.
- Do not return card_number as 224/187.
- Do not confuse rarity labels such as RR, SR, SAR, AR or UR with set codes.

ASIAN CARD RULES:
- Japanese: use Japanese name, artwork, number, HP, type and set marks.
- Simplified Chinese: use Chinese name, artwork, number, HP, type and regional set markings.
- Traditional Chinese: same rule, preserving Traditional Chinese script.
- Korean: use Korean name, artwork, number, HP, type and regional set markings.
- Regional Asian set codes may differ from English or Japanese equivalents.
- Preserve a printed regional set code when visible.

FINISH RULES:
Determine finish only after the base card is identified.

Allowed finish values:
Basic / Normaal
Holo
Reverse Holo
Poké Ball
Great Ball
Master Ball
Cracked Ice Holo
Cosmos Holo
Galaxy Holo
Pokémon Together stamp
Snowflake stamp
Play! Pokémon stamp
Other
Unknown

If the exact finish is uncertain, use Unknown.

Return only the structured result.
`;

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp01(value) {
  const number = Number(value || 0);
  return Math.max(0, Math.min(1, number));
}

function splitCollector(value) {
  const match = cleanText(value).match(/^([^/]+)\/([^/]+)$/);

  if (!match) {
    return null;
  }

  return [
    match[1].trim(),
    match[2].trim()
  ];
}

function normalizeResult(raw) {
  let cardNumber = cleanText(raw?.card_number);
  let setTotal = cleanText(raw?.set_total);
  let collectorNumber = cleanText(raw?.collector_number);

  const partsFromCollector = splitCollector(collectorNumber);
  const partsFromCardNumber = splitCollector(cardNumber);
  const parts = partsFromCollector || partsFromCardNumber;

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
    language: LANGUAGES.includes(raw?.language)
      ? raw.language
      : "Unknown",
    set_name: cleanText(raw?.set_name),
    set_code: cleanText(raw?.set_code),
    card_number: cardNumber,
    set_total: setTotal,
    collector_number: collectorNumber,
    finish: FINISHES.includes(raw?.finish)
      ? raw.finish
      : "Unknown",
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

      if (
        content?.json &&
        typeof content.json === "object"
      ) {
        pieces.push(JSON.stringify(content.json));
      }
    }
  }

  return cleanText(pieces.join("\n"));
}

function parseStructuredResult(response) {
  const outputText = extractOutputText(response);

  if (!outputText) {
    console.error(
      "No usable OpenAI output:",
      JSON.stringify(response?.output || []).slice(0, 5000)
    );

    throw new Error("AI returned no usable output");
  }

  const cleaned = outputText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (firstError) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new Error("AI returned invalid JSON");
    }

    parsed = JSON.parse(
      cleaned.slice(start, end + 1)
    );
  }

  return normalizeResult(parsed);
}

function jsonError(
  res,
  status,
  message,
  diagnostic = ""
) {
  return res.status(status).json({
    ok: false,
    error: message,
    diagnostic: cleanText(diagnostic).slice(0, 500)
  });
}

export default async function handler(req, res) {
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");

    return jsonError(
      res,
      405,
      "Gebruik POST."
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(
      res,
      503,
      "OPENAI_API_KEY ontbreekt in Vercel."
    );
  }

  const image = req.body?.image;

  if (
    typeof image !== "string" ||
    !image.startsWith("data:image/")
  ) {
    return jsonError(
      res,
      400,
      "Geen geldige kaartafbeelding ontvangen."
    );
  }

  if (image.length > 12_000_000) {
    return jsonError(
      res,
      413,
      "Afbeelding is te groot. Probeer een kleinere foto."
    );
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: MODEL,

      input: [
        {
          role: "user",

          content: [
            {
              type: "input_text",
              text: PROMPT
            },
            {
              type: "input_image",
              image_url: image,
              detail: "high"
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

      max_output_tokens: 1000
    });

    const result = parseStructuredResult(response);

    return res
      .status(200)
      .json(result);

  } catch (error) {

    console.error(
      "ZamexCards scan error:",
      {
        name: error?.name,
        message: error?.message,
        status: error?.status,
        type: error?.type,
        code: error?.code
      }
    );

    const status = Number(
      error?.status || 0
    );

    if (status === 401) {
      return jsonError(
        res,
        401,
        "OpenAI API-sleutel is ongeldig.",
        error?.message
      );
    }

    if (status === 429) {
      return jsonError(
        res,
        429,
        "OpenAI API-limiet of tegoed bereikt.",
        error?.message
      );
    }

    return jsonError(
      res,
      500,
      "AI kaartscan mislukt. Probeer opnieuw.",
      error?.message
    );
  }
}

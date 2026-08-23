import OpenAI from "openai";

export const config = {
  maxDuration: 30
};

const MODEL = process.env.SCANNER_MODEL || "gpt-4.1-mini";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    card_name: { type: "string" },
    printed_name: { type: "string" },
    language: {
      type: "string",
      enum: [
        "English",
        "Japanese",
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
      ]
    },
    set_name: { type: "string" },
    set_code: { type: "string" },
    card_number: { type: "string" },
    set_total: { type: "string" },
    collector_number: { type: "string" },
    finish: {
      type: "string",
      enum: [
        "Basic / Normaal",
        "Holo",
        "Reverse Holo",
        "Poké Ball",
        "Great Ball",
        "Master Ball",
        "Cracked Ice Holo",
        "Cosmos Holo",
        "Galaxy Holo",
        "Stamped",
        "Other",
        "Unknown"
      ]
    },
    identity_confidence: { type: "number", minimum: 0, maximum: 1 },
    finish_confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" }
  },
  required: [
    "found", "card_name", "printed_name", "language", "set_name",
    "set_code", "card_number", "set_total", "collector_number",
    "finish", "identity_confidence", "finish_confidence", "notes"
  ]
};

const SYSTEM_PROMPT = [
  "You identify Pokemon Trading Card Game cards from one photo.",
  "Return JSON that matches the provided schema.",
  "Use the whole card image, not OCR alone.",
  "Support English, Japanese, Korean, Simplified Chinese and Traditional Chinese.",
  "",
  "Identification priority:",
  "1. printed card name",
  "2. artwork",
  "3. collector number and set total",
  "4. set code or set symbol",
  "5. HP, type and card layout",
  "",
  "Important rules:",
  "- Identify the base card before identifying the finish.",
  "- For Asian cards, read the original script and combine it with artwork and collector number.",
  "- card_name must be the canonical English card or Pokemon name when confidently known.",
  "- printed_name should preserve the visible printed name.",
  "- card_number is only the part before the slash.",
  "- set_total is only the part after the slash.",
  "- collector_number is the complete visible value such as 074/187.",
  "- Do not confuse RR, SR, SAR, AR, UR or other rarity marks with the set code.",
  "- Never invent a set code or unreadable number.",
  "- If set_name or set_code is uncertain, use an empty string instead of guessing.",
  "- If the base card is identifiable but finish is uncertain, use Unknown for finish.",
  "- Poke Ball, Great Ball and Master Ball patterns are finishes/variants of the same base card.",
  "- found should be true when the base card can be identified with useful confidence."
].join("\n");

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeNumberFields(result) {
  let cardNumber = clean(result.card_number);
  let setTotal = clean(result.set_total);
  let collectorNumber = clean(result.collector_number);

  const full = collectorNumber || cardNumber;
  const match = full.match(/^([^/]+)\/([^/]+)$/);

  if (match) {
    cardNumber = match[1].trim();
    if (!setTotal) setTotal = match[2].trim();
    collectorNumber = `${match[1].trim()}/${match[2].trim()}`;
  } else if (!collectorNumber && cardNumber && setTotal) {
    collectorNumber = `${cardNumber}/${setTotal}`;
  }

  return {
    ...result,
    card_number: cardNumber,
    set_total: setTotal,
    collector_number: collectorNumber
  };
}

function sendError(res, status, message, diagnostic = "") {
  return res.status(status).json({
    ok: false,
    error: message,
    diagnostic: clean(diagnostic).slice(0, 800)
  });
}

function getImageDataUrl(body) {
  const candidates = [
    body?.image,
    body?.imageData,
    body?.image_data,
    body?.dataUrl,
    body?.data_url
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      return value;
    }
  }
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Gebruik POST.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendError(res, 503, "OPENAI_API_KEY ontbreekt in Vercel.");
  }

  const imageDataUrl = getImageDataUrl(req.body);

  if (!imageDataUrl) {
    return sendError(
      res,
      400,
      "Geen geldige kaartafbeelding ontvangen.",
      "Verwacht een data:image/... URL in image, imageData, image_data, dataUrl of data_url."
    );
  }

  try {
    const response = await client.responses.create({
      model: MODEL,
      temperature: 0,
      max_output_tokens: 1200,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Identify this Pokemon TCG card. Return only the structured result."
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
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
          schema: SCHEMA
        }
      }
    });

    const outputText = clean(response.output_text);

    if (!outputText) {
      return sendError(
        res,
        502,
        "AI kaartscan mislukt. Probeer opnieuw.",
        `AI returned no usable output. response_id=${clean(response.id)}`
      );
    }

    let result;
    try {
      result = JSON.parse(outputText);
    } catch (error) {
      return sendError(
        res,
        502,
        "AI gaf geen geldige kaartgegevens terug.",
        `JSON parse error: ${error.message}; output=${outputText.slice(0, 400)}`
      );
    }

    result = normalizeNumberFields(result);

    return res.status(200).json(result);
  } catch (error) {
    console.error("ZamexCards scan error:", error);

    const diagnostic = [
      error?.name,
      error?.message,
      error?.status ? `status=${error.status}` : "",
      error?.code ? `code=${error.code}` : ""
    ].filter(Boolean).join(" | ");

    return sendError(
      res,
      500,
      "AI kaartscan mislukt. Probeer opnieuw.",
      diagnostic
    );
  }
}

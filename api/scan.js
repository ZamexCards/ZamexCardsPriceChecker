import OpenAI from "openai";
import { resolveCatalogCard } from "../lib/catalog-resolver.js";

export const config = {
  maxDuration: 30
};

const MODEL = process.env.SCANNER_MODEL || "gpt-4.1-mini";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const LANGUAGES = [
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
  "Stamped",
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
    notes: { type: "string" },
    hp: { type: "string" },
    attack_names: { type: "array", items: { type: "string" } },
    illustrator: { type: "string" },
    regulation_mark: { type: "string" }
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
    "notes",
    "hp",
    "attack_names",
    "illustrator",
    "regulation_mark"
  ]
};


const COLLECTOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    card_number: { type: "string" },
    set_total: { type: "string" },
    collector_number: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" }
  },
  required: [
    "card_number",
    "set_total",
    "collector_number",
    "confidence",
    "notes"
  ]
};

const COLLECTOR_PROMPT = [
  "You are a Pokemon TCG collector-number reader.",
  "Your ONLY task is to read the printed collector-number fraction from the bottom edge of the photographed card.",
  "Examples: 012/086, 074/187, 230/207, TG14/TG30.",
  "Do not identify the set from memory.",
  "Do not use HP, attack damage, Pokedex number, copyright year, regulation mark, rarity, anniversary logos or other numbers.",
  "If the exact fraction is not visibly readable, return empty strings and low confidence instead of guessing.",
  "card_number = numerator exactly as printed.",
  "set_total = denominator exactly as printed.",
  "collector_number = complete numerator/denominator exactly as printed."
].join("\n");

const FINISH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    finish: { type: "string", enum: FINISHES },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reverse_surface: { type: "boolean" },
    visible_pattern: { type: "string" },
    notes: { type: "string" }
  },
  required: [
    "finish",
    "confidence",
    "reverse_surface",
    "visible_pattern",
    "notes"
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
  "- hp should be the visible HP number only, or empty if unreadable.",
  "- attack_names should contain the visible attack names only; do not invent them.",
  "- illustrator should be the printed illustrator name from the bottom of the card, or empty if unreadable.",
  "- regulation_mark should be the visible regulation letter/mark, or empty if unreadable.",
  "- card_number is ONLY the numerator from the collector-number fraction printed at the bottom of the card.",
  "- set_total is ONLY the denominator from that SAME bottom collector-number fraction.",
  "- collector_number must be the complete visible bottom fraction, for example 012/086 or 074/187.",
  "- CRITICAL: never use a standalone anniversary number, logo number, HP, Pokédex number, attack damage, regulation mark, rarity mark, year or set branding as card_number or set_total.",
  "- A standalone number such as 25, 30 or 151 is NOT a collector number unless it is physically printed as the bottom fraction X/Y.",
  "- set_code must come from the small printed set/code marking next to the bottom collector number, or from a clearly identifiable official set code.",
  "- Never use a digits-only anniversary/logo number such as 25 as set_code.",
  "- Before returning, visually re-check the bottom-left/bottom-edge collector line and make card_number, set_total and collector_number internally consistent.",
  "- If the card identity is clear but the bottom collector fraction is unreadable, leave card_number, set_total and collector_number empty rather than substituting another visible number.",
  "- Do not confuse RR, SR, SAR, AR, UR or other rarity marks with the set code.",
  "- Never invent a set code or unreadable number.",
  "- If set_name or set_code is uncertain, use an empty string instead of guessing.",
  "- found should be true when the base card can be identified with useful confidence."
].join("\n");

const FINISH_PROMPT = [
  "You are now ONLY a Pokemon TCG foil/finish classifier.",
  "Ignore card identity except as context.",
  "Inspect the entire card surface carefully, especially the text box/background and repeated foil symbols.",
  "",
  "Classification rules:",
  "- If repeated Poké Ball symbols are visible across the reverse-holo surface, return finish = Poké Ball.",
  "- If repeated Great Ball symbols are visible across the reverse-holo surface, return finish = Great Ball.",
  "- If repeated Master Ball symbols are visible across the reverse-holo surface, return finish = Master Ball.",
  "- These Poké Ball / Great Ball / Master Ball variants ARE reverse-holo style variants. Do NOT call them plain Holo or plain Reverse Holo.",
  "- Use Reverse Holo only when the card has reverse foil but no special ball/stamp pattern.",
  "- Use Holo only when the artwork/card has ordinary holo treatment and the body is not reverse-holo patterned.",
  "- If there is a clear repeated special stamp or logo pattern that is not a ball pattern, use Stamped.",
  "- If reflections from a sleeve or lighting make the pattern uncertain, use Unknown rather than guessing.",
  "",
  "Return only the structured finish result."
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

async function identifyCard(imageDataUrl) {
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
        schema: CARD_SCHEMA
      }
    }
  });

  const outputText = clean(response.output_text);
  if (!outputText) {
    throw new Error(`Identity scan returned no output. response_id=${clean(response.id)}`);
  }

  return normalizeNumberFields(JSON.parse(outputText));
}


async function verifyCollectorNumber(imageDataUrl) {
  const response = await client.responses.create({
    model: MODEL,
    temperature: 0,
    max_output_tokens: 300,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: COLLECTOR_PROMPT }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Read only the exact collector-number fraction printed at the bottom of this card."
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
        name: "pokemon_collector_number",
        strict: true,
        schema: COLLECTOR_SCHEMA
      }
    }
  });

  const outputText = clean(response.output_text);
  if (!outputText) {
    throw new Error(`Collector-number verification returned no output. response_id=${clean(response.id)}`);
  }

  return JSON.parse(outputText);
}

async function classifyFinish(imageDataUrl) {
  const response = await client.responses.create({
    model: MODEL,
    temperature: 0,
    max_output_tokens: 500,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: FINISH_PROMPT }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Classify ONLY the foil/finish of this exact card image."
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
        name: "pokemon_finish_scan",
        strict: true,
        schema: FINISH_SCHEMA
      }
    }
  });

  const outputText = clean(response.output_text);
  if (!outputText) {
    throw new Error(`Finish scan returned no output. response_id=${clean(response.id)}`);
  }

  return JSON.parse(outputText);
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
      "Verwacht een data:image/... URL."
    );
  }

  try {
    // Identity and finish are independent, so run them in parallel for speed.
    const [identityResult, collectorResult, finishResult] = await Promise.allSettled([
      identifyCard(imageDataUrl),
      verifyCollectorNumber(imageDataUrl),
      classifyFinish(imageDataUrl)
    ]);

    if (identityResult.status !== "fulfilled") {
      throw identityResult.reason || new Error("Kaartidentificatie mislukt.");
    }

    const card = identityResult.value;

    // Dedicated collector-number reader is more authoritative than the general identity pass.
    // It may correct a wrong AI guess such as 007/073 -> 012/086.
    if (collectorResult.status === "fulfilled") {
      const verified = collectorResult.value || {};
      const full = clean(verified.collector_number);
      const match = full.match(/^([^/]+)\/([^/]+)$/);

      if (match && Number(verified.confidence || 0) >= 0.72) {
        card.card_number = clean(match[1]);
        card.set_total = clean(match[2]);
        card.collector_number = `${clean(match[1])}/${clean(match[2])}`;
        card.collector_confidence = Number(verified.confidence || 0);
        card.notes = [
          clean(card.notes),
          `Collector verified independently: ${card.collector_number}`
        ].filter(Boolean).join(" | ").slice(0, 1200);
      } else {
        card.collector_confidence = Number(verified.confidence || 0);
      }
    } else {
      card.collector_confidence = 0;
      console.warn(
        "Collector-number verification failed:",
        collectorResult.reason?.message || String(collectorResult.reason || "")
      );
    }

    if (finishResult.status === "fulfilled") {
      const finish = finishResult.value;

      card.finish = finish.finish;
      card.finish_confidence = Number(finish.confidence || 0);

      const extra = [
        finish.reverse_surface ? "reverse-holo surface" : "",
        clean(finish.visible_pattern),
        clean(finish.notes)
      ].filter(Boolean).join("; ");

      if (extra) {
        card.notes = [clean(card.notes), `Finish check: ${extra}`]
          .filter(Boolean)
          .join(" | ")
          .slice(0, 1000);
      }
    } else {
      console.warn(
        "Dedicated finish scan failed:",
        finishResult.reason?.message || String(finishResult.reason || "")
      );
    }

    // NEW: AI is only a first-pass recognizer. The catalog becomes the source of truth.
    try {
      const resolved = await resolveCatalogCard({
        imageDataUrl,
        aiCard: card,
        client,
        model: MODEL
      });

      if (resolved?.resolved) {
        card.card_name = resolved.card_name || card.card_name;
        card.set_name = resolved.set_name || "";
        card.set_code = resolved.set_code || "";
        card.card_number = resolved.card_number || card.card_number;
        card.set_total = resolved.set_total || card.set_total;
        card.collector_number = resolved.collector_number || card.collector_number;
        card.identity_confidence = Math.max(
          Number(card.identity_confidence || 0),
          Number(resolved.confidence || 0)
        );
        card.catalog_id = resolved.catalog_id || "";
        card.catalog_match_method = resolved.method || "";
        card.catalog_image = resolved.image || "";
        card.catalog_release_date = resolved.release_date || "";
        card.notes = [
          clean(card.notes),
          `Catalog verified: ${resolved.set_name || ""} ${resolved.collector_number || ""} (${resolved.method || "catalog"})`
        ].filter(Boolean).join(" | ").slice(0, 1200);
      } else {
        // Never present a guessed set as fact when the catalog could not verify it.
        card.set_name = "";
        card.set_code = "";
        card.notes = [
          clean(card.notes),
          `Catalog unresolved: ${clean(resolved?.reason)}`
        ].filter(Boolean).join(" | ").slice(0, 1200);
      }
    } catch (catalogError) {
      console.warn(
        "Catalog resolver failed:",
        catalogError?.message || String(catalogError || "")
      );
      card.set_name = "";
      card.set_code = "";
    }

    return res.status(200).json(card);
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

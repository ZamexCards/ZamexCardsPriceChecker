import OpenAI from "openai";

const MODEL = process.env.SCANNER_MODEL || "gpt-5.6-luna";

const FINISHES = [
  "Basic / Normaal", "Holo", "Reverse Holo", "Poké Ball", "Great Ball",
  "Master Ball", "Cracked Ice Holo", "Cosmos Holo", "Galaxy Holo",
  "Pokémon Together stamp", "Snowflake stamp", "Play! Pokémon stamp",
  "Other", "Unknown"
];

const LANGUAGES = [
  "English", "Japanese", "Chinese", "Simplified Chinese", "Traditional Chinese",
  "Korean", "Dutch", "German", "French", "Italian", "Spanish", "Portuguese",
  "Other", "Unknown"
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
    "found", "card_name", "printed_name", "language", "set_name", "set_code",
    "card_number", "set_total", "collector_number", "finish",
    "identity_confidence", "finish_confidence", "notes"
  ]
};

const BASE_PROMPT = `
You are a specialist Pokémon Trading Card Game card scanner.
Analyze the COMPLETE card image and identify the BASE CARD first.

Support English, Japanese, Simplified Chinese, Traditional Chinese, Korean,
Dutch, German, French, Italian, Spanish and Portuguese Pokémon TCG cards,
including old sets, modern sets, promos, special subsets and regional releases.

Use all visible evidence together:
- artwork and layout
- printed name and script
- HP, type and evolution stage
- set code or graphical set symbol
- collector number and printed set total
- promo/gallery/subset numbering
- copyright/era markings
- foil/stamp/pattern

ASIAN-LANGUAGE RULES:
- Japanese: do not require Latin OCR. Use Japanese text + artwork + numbering + set marks.
- Chinese: support both Simplified and Traditional Chinese. Use Chinese text + artwork + numbering + set marks.
- Korean: do not require Latin OCR. Use Korean text + artwork + numbering + set marks.
- card_name should be the canonical English Pokémon/card name when confidently known.
- printed_name should preserve the visible original-script name when readable.

IDENTITY RULES:
1. Finish must NEVER change base-card identity.
2. Read collector numbers exactly where possible: 012/086, 130/094, TG14/TG30, GG21/GG70, SWSH075, SVP036.
3. Read printed set codes when present, e.g. BLK, PFL, BRS, ASR, SVP.
4. For graphical set symbols, infer set_name from symbol + artwork + era + collector number.
5. Never invent unreadable digits or set codes; use empty strings instead.
6. found=false only when there is not enough information for a useful identity.

FINISH RULES:
Choose exactly one allowed finish. Poké Ball / Great Ball / Master Ball / stamps are variants only.
If uncertain, use Unknown.

Return only the structured result.
`;

const RETRY_PROMPT = `
Re-analyze the same Pokémon card because the first pass was incomplete.
Focus on the TOP name area and the BOTTOM collector-number / set-code area.
For Japanese, Chinese and Korean cards, use visual recognition, original-script text,
artwork, HP, numbering and set marks together. Ignore glare and foil when determining identity.
Do not guess missing digits. Return only the structured result.
`;

function cleanText(v) {
  return String(v ?? "").trim();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v || 0)));
}

function cleanResult(x) {
  const out = {
    found: Boolean(x?.found),
    card_name: cleanText(x?.card_name),
    printed_name: cleanText(x?.printed_name),
    language: LANGUAGES.includes(x?.language) ? x.language : "Unknown",
    set_name: cleanText(x?.set_name),
    set_code: cleanText(x?.set_code).toUpperCase(),
    card_number: cleanText(x?.card_number),
    set_total: cleanText(x?.set_total),
    collector_number: cleanText(x?.collector_number),
    finish: FINISHES.includes(x?.finish) ? x.finish : "Unknown",
    identity_confidence: clamp01(x?.identity_confidence),
    finish_confidence: clamp01(x?.finish_confidence),
    notes: cleanText(x?.notes).slice(0, 700)
  };

  if (!out.collector_number && out.card_number && out.set_total) {
    out.collector_number = `${out.card_number}/${out.set_total}`;
  }

  return out;
}

function extractResponseText(response) {
  const direct = cleanText(response?.output_text);
  if (direct) return direct;

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
    }
  }

  return cleanText(pieces.join("\n"));
}

function parseJsonText(text) {
  const raw = cleanText(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!raw) {
    throw new Error("AI returned an empty response");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");

    if (first >= 0 && last > first) {
      return JSON.parse(raw.slice(first, last + 1));
    }

    throw new Error("AI returned no valid JSON");
  }
}

function parseResponse(response) {
  if (response?.status === "failed") {
    throw new Error(
      `OpenAI response failed: ${JSON.stringify(response?.error || {})}`
    );
  }

  if (response?.status === "incomplete") {
    console.warn(
      "OpenAI response incomplete:",
      response?.incomplete_details || null
    );
  }

  const text = extractResponseText(response);

  if (!text) {
    console.error(
      "Empty OpenAI output structure:",
      JSON.stringify(response?.output || []).slice(0, 4000)
    );

    throw new Error("AI returned an empty response");
  }

  return cleanResult(parseJsonText(text));
}

async function runStructuredScan(client, image, prompt) {
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

    max_output_tokens: 1200
  });

  return parseResponse(response);
}

async function runJsonFallback(client, image, prompt) {
  const fallbackPrompt = `${prompt}

IMPORTANT FALLBACK:
Return one JSON object only, with exactly these keys:
found, card_name, printed_name, language, set_name, set_code, card_number,
set_total, collector_number, finish, identity_confidence,
finish_confidence, notes.

No markdown and no explanation outside JSON.
`;

  const response = await client.responses.create({
    model: MODEL,

    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: fallbackPrompt
          },
          {
            type: "input_image",
            image_url: image,
            detail: "high"
          }
        ]
      }
    ],

    max_output_tokens: 1200
  });

  return parseResponse(response);
}

function shouldRetry(result) {
  if (!result?.found) {
    return true;
  }

  if (result.identity_confidence < 0.62) {
    return true;
  }

  return !(
    result.card_name ||
    (
      result.card_number &&
      (
        result.set_code ||
        result.set_name ||
        result.set_total
      )
    )
  );
}

function resultScore(x) {
  let score = (x?.identity_confidence || 0) * 100;

  if (x?.card_name) score += 15;
  if (x?.card_number) score += 18;
  if (x?.set_total) score += 10;
  if (x?.set_code) score += 14;
  if (x?.set_name) score += 8;
  if (x?.collector_number) score += 10;

  if (
    x?.language &&
    x.language !== "Unknown"
  ) {
    score += 4;
  }

  return score;
}

function chooseBetter(first, second) {
  return resultScore(second) > resultScore(first)
    ? second
    : first;
}

async function scanWithFallbacks(client, image) {
  let first = null;

  /*
   * Eerste poging:
   * Structured Output.
   */
  try {
    first = await runStructuredScan(
      client,
      image,
      BASE_PROMPT
    );
  } catch (error) {
    console.warn(
      "Structured scan failed, using JSON fallback:",
      error?.message || error
    );

    /*
     * Structured Output leeg/mislukt?
     * Dan gewone JSON-poging.
     */
    first = await runJsonFallback(
      client,
      image,
      BASE_PROMPT
    );
  }

  /*
   * Goed resultaat?
   */
  if (!shouldRetry(first)) {
    return first;
  }

  /*
   * Tweede gerichte analyse.
   */
  try {
    let second;

    try {
      second = await runStructuredScan(
        client,
        image,
        `${BASE_PROMPT}

${RETRY_PROMPT}`
      );
    } catch (error) {
      console.warn(
        "Structured retry failed, using JSON fallback retry:",
        error?.message || error
      );

      second = await runJsonFallback(
        client,
        image,
        `${BASE_PROMPT}

${RETRY_PROMPT}`
      );
    }

    return chooseBetter(
      first,
      second
    );

  } catch (error) {
    console.warn(
      "Second scan pass failed; using first result:",
      error?.message || error
    );

    return first;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader(
      "Allow",
      "POST, OPTIONS"
    );

    return res
      .status(204)
      .end();
  }

  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST, OPTIONS"
    );

    return res
      .status(405)
      .json({
        error: "Gebruik POST."
      });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res
      .status(503)
      .json({
        error:
          "AI scanner is nog niet geconfigureerd: OPENAI_API_KEY ontbreekt in Vercel."
      });
  }

  const image =
    req.body?.image;

  if (
    typeof image !== "string" ||
    !image.startsWith("data:image/")
  ) {
    return res
      .status(400)
      .json({
        error:
          "Geen geldige kaartafbeelding ontvangen."
      });
  }

  if (
    image.length >
    12_000_000
  ) {
    return res
      .status(413)
      .json({
        error:
          "Afbeelding is te groot. Probeer een kleinere foto."
      });
  }

  try {
    const client =
      new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY
      });

    const result =
      await scanWithFallbacks(
        client,
        image
      );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .json(result);

  } catch (error) {
    console.error(
      "OpenAI scan error:",
      error
    );

    const status =
      Number(error?.status) || 500;

    const safeStatus =
      status >= 400 &&
      status < 600
        ? status
        : 500;

    return res
      .status(safeStatus)
      .json({
        error:
          safeStatus === 401
            ? "OpenAI API-sleutel is ongeldig."
          : safeStatus === 429
            ? "OpenAI API-limiet of tegoed bereikt. Controleer Billing/Limits."
          : safeStatus === 413
            ? "Afbeelding is te groot. Probeer een kleinere foto."
          : "AI kaartscan mislukt. Probeer opnieuw."
      });
  }
}

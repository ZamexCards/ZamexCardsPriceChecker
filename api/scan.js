import OpenAI from "openai";

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
    language: {
      type: "string",
      enum: LANGUAGES
    },
    set_name: { type: "string" },
    set_code: { type: "string" },
    card_number: { type: "string" },
    set_total: { type: "string" },
    collector_number: { type: "string" },
    finish: {
      type: "string",
      enum: FINISHES
    },
    identity_confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    finish_confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
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

const BASE_PROMPT = `
You are a specialist Pokémon Trading Card Game card scanner.

Analyze the COMPLETE card image and identify the BASE CARD first.

Support:
- English
- Japanese
- Simplified Chinese
- Traditional Chinese
- Korean
- Dutch
- German
- French
- Italian
- Spanish
- Portuguese

Support:
- old Pokémon cards
- modern Pokémon cards
- promos
- Black Star Promos
- Trainer Gallery
- Galarian Gallery
- Illustration Rare
- Special Illustration Rare
- Japanese regional releases
- Chinese regional releases
- Korean regional releases
- stamped cards
- special foil variants

Use ALL visible information together:
- artwork
- card layout
- printed name and writing system
- HP
- type
- evolution stage
- set code
- graphical set symbol
- collector number
- printed set total
- promo/gallery/subset numbering
- copyright / era markings
- foil / stamp / Poké Ball / Great Ball / Master Ball pattern

IDENTITY RULES

1.
Identify the BASE CARD independently from its finish.

2.
Finish must NEVER change which card it is.

3.
Read collector numbers exactly where possible.

Examples:
012/086
130/094
TG14/TG30
GG21/GG70
SWSH075
SVP036

4.
card_number must contain ONLY the first part.

Examples:
074
224
012
130
TG14
GG21
SWSH075

5.
set_total must contain ONLY the second part when printed.

Examples:
187
086
094
TG30
GG70

6.
collector_number should contain the complete printed value.

Examples:
074/187
224/187
012/086

7.
Read printed set codes when present.

Examples:
BLK
PFL
BRS
ASR
SVP
SV8A

8.
For graphical set symbols, identify the likely set using:
- symbol
- artwork
- era
- copyright
- collector number
- set total

9.
Never invent unreadable digits.

10.
Never invent a set code.

11.
found=false only when there is not enough information to identify a useful base-card identity.

ASIAN LANGUAGE RULES

12.
For Japanese cards:
- do not require Latin OCR
- use Japanese printed name
- artwork
- collector number
- set code/symbol
- HP
- type
- layout

Return card_name as the canonical English Pokémon/card name when confidently known.

Keep the original Japanese printed name in printed_name.

13.
For Simplified Chinese and Traditional Chinese cards:
- do not rely on English OCR
- use Chinese printed name
- artwork
- collector number
- set markings
- HP
- type
- layout
- regional release style

Return language as:
Simplified Chinese
or
Traditional Chinese
when confidently known.

If only Chinese can be determined:
language = Chinese

14.
For Korean cards:
- do not require Latin OCR
- use Korean printed name
- artwork
- collector number
- set markings
- HP
- type
- layout

Return card_name as the canonical English Pokémon/card name when confidently known.

Keep the original Korean printed name in printed_name.

15.
For Japanese, Chinese and Korean cards:
do NOT leave both set_name and set_code empty if the set can reasonably be determined from:
- collector number
- set symbol/code
- artwork
- regional layout
- release style

16.
If the set cannot be determined reliably:
leave set_name and set_code empty rather than guessing.

FINISH RULES

17.
Determine finish only AFTER the base card is identified.

18.
Choose exactly one of:

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

19.
Poké Ball / Great Ball / Master Ball / stamps are variants only.

20.
If uncertain:
finish = Unknown

Return only the structured result.
`;

const RETRY_PROMPT = `
Perform a second, stricter verification of this Pokémon card.

Focus especially on:

BOTTOM AREA
- collector number
- set total
- set code
- set symbol
- rarity label

TOP AREA
- card name
- Japanese text
- Chinese text
- Korean text
- HP
- type
- evolution stage

ARTWORK
- identify the Pokémon from artwork
- compare artwork and layout to known Pokémon TCG printings

ASIAN CARDS
For Japanese, Chinese and Korean cards:
- use original-script text
- artwork
- collector number
- set markings
- HP
- layout
- regional release style

NUMBER NORMALIZATION
If a previous result returned:
card_number = "224/187"

correct this to:

card_number = "224"
set_total = "187"
collector_number = "224/187"

Do not confuse rarity labels such as RR / SR / SAR with set codes.

Do not guess unreadable digits.

Return only the structured result.
`;

function cleanText(value) {
  return String(value ?? "").trim();
}

function clamp01(value) {
  return Math.max(
    0,
    Math.min(
      1,
      Number(value || 0)
    )
  );
}

function normalizeCollectorParts(result) {
  let cardNumber = cleanText(result?.card_number);
  let setTotal = cleanText(result?.set_total);
  let collector = cleanText(result?.collector_number);

  const splitCollector = (value) => {
    const match = cleanText(value).match(/^([^/]+)\/([^/]+)$/);

    if (!match) {
      return null;
    }

    return [
      match[1].trim(),
      match[2].trim()
    ];
  };

  let parts = splitCollector(collector);

  if (!parts) {
    parts = splitCollector(cardNumber);
  }

  if (parts) {
    cardNumber = parts[0];

    if (!setTotal) {
      setTotal = parts[1];
    }

    collector =
      `${parts[0]}/${parts[1]}`;
  }

  if (
    !collector &&
    cardNumber &&
    setTotal
  ) {
    collector =
      `${cardNumber}/${setTotal}`;
  }

  const cardParts =
    splitCollector(cardNumber);

  if (cardParts) {
    cardNumber =
      cardParts[0];

    if (!setTotal) {
      setTotal =
        cardParts[1];
    }

    if (!collector) {
      collector =
        `${cardParts[0]}/${cardParts[1]}`;
    }
  }

  return {
    cardNumber,
    setTotal,
    collector
  };
}

function cleanResult(result) {
  const parts =
    normalizeCollectorParts(
      result || {}
    );

  return {
    found:
      Boolean(result?.found),

    card_name:
      cleanText(result?.card_name),

    printed_name:
      cleanText(result?.printed_name),

    language:
      LANGUAGES.includes(result?.language)
        ? result.language
        : "Unknown",

    set_name:
      cleanText(result?.set_name),

    set_code:
      cleanText(result?.set_code),

    card_number:
      parts.cardNumber,

    set_total:
      parts.setTotal,

    collector_number:
      parts.collector,

    finish:
      FINISHES.includes(result?.finish)
        ? result.finish
        : "Unknown",

    identity_confidence:
      clamp01(
        result?.identity_confidence
      ),

    finish_confidence:
      clamp01(
        result?.finish_confidence
      ),

    notes:
      cleanText(result?.notes)
        .slice(0, 900)
  };
}

function extractResponseText(response) {
  const direct =
    cleanText(
      response?.output_text
    );

  if (direct) {
    return direct;
  }

  const pieces = [];

  for (
    const item
    of response?.output || []
  ) {

    if (
      typeof item?.text === "string"
    ) {
      pieces.push(
        item.text
      );
    }

    for (
      const content
      of item?.content || []
    ) {

      if (
        typeof content?.text === "string"
      ) {
        pieces.push(
          content.text
        );
      }

      if (
        typeof content?.output_text === "string"
      ) {
        pieces.push(
          content.output_text
        );
      }

      if (
        typeof content?.json === "string"
      ) {
        pieces.push(
          content.json
        );
      }

      if (
        content?.json &&
        typeof content.json === "object"
      ) {
        pieces.push(
          JSON.stringify(
            content.json
          )
        );
      }
    }
  }

  return cleanText(
    pieces.join("\n")
  );
}

function parseJsonText(text) {
  const raw =
    cleanText(text)
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  if (!raw) {
    throw new Error(
      "AI returned an empty response"
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    const first =
      raw.indexOf("{");

    const last =
      raw.lastIndexOf("}");

    if (
      first >= 0 &&
      last > first
    ) {
      return JSON.parse(
        raw.slice(
          first,
          last + 1
        )
      );
    }

    throw new Error(
      "AI returned no valid JSON"
    );
  }
}

function parseResponse(response) {
  if (
    response?.status === "failed"
  ) {
    throw new Error(
      `OpenAI response failed: ${JSON.stringify(
        response?.error || {}
      )}`
    );
  }

  const text =
    extractResponseText(
      response
    );

  if (!text) {
    console.error(
      "Empty OpenAI output:",
      JSON.stringify(
        response?.output || []
      ).slice(
        0,
        5000
      )
    );

    throw new Error(
      "AI returned an empty response"
    );
  }

  return cleanResult(
    parseJsonText(text)
  );
}

async function runStructuredScan(
  client,
  image,
  prompt
) {
  const response =
    await client.responses.create({

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

      max_output_tokens: 1400
    });

  return parseResponse(
    response
  );
}

async function runJsonFallback(
  client,
  image,
  prompt
) {
  const fallbackPrompt = `
${prompt}

Return exactly ONE JSON object and nothing else.

Use exactly these keys:

found
card_name
printed_name
language
set_name
set_code
card_number
set_total
collector_number
finish
identity_confidence
finish_confidence
notes

IMPORTANT:

card_number must NOT contain "/".

Example:

card_number = "224"
set_total = "187"
collector_number = "224/187"
`;

  const response =
    await client.responses.create({

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

      max_output_tokens: 1400
    });

  return parseResponse(
    response
  );
}

function isAsianLanguage(language) {
  return [
    "Japanese",
    "Chinese",
    "Simplified Chinese",
    "Traditional Chinese",
    "Korean"
  ].includes(language);
}

function shouldRetry(result) {
  if (!result?.found) {
    return true;
  }

  if (
    result.identity_confidence <
    0.70
  ) {
    return true;
  }

  if (
    !result.card_name &&
    !result.card_number
  ) {
    return true;
  }

  if (
    !result.card_number
  ) {
    return true;
  }

  if (
    isAsianLanguage(
      result.language
    ) &&
    !result.set_name &&
    !result.set_code
  ) {
    return true;
  }

  if (
    result.collector_number &&
    result.collector_number.includes("/") &&
    (
      !result.set_total ||
      !result.card_number
    )
  ) {
    return true;
  }

  return false;
}

function resultScore(result) {
  let score =
    (
      result?.identity_confidence ||
      0
    ) * 100;

  if (
    result?.card_name
  ) {
    score += 18;
  }

  if (
    result?.card_number
  ) {
    score += 20;
  }

  if (
    result?.set_total
  ) {
    score += 12;
  }

  if (
    result?.set_code
  ) {
    score += 16;
  }

  if (
    result?.set_name
  ) {
    score += 12;
  }

  if (
    result?.collector_number
  ) {
    score += 12;
  }

  if (
    result?.language &&
    result.language !== "Unknown"
  ) {
    score += 5;
  }

  if (
    isAsianLanguage(
      result?.language
    ) &&
    (
      result?.set_name ||
      result?.set_code
    )
  ) {
    score += 8;
  }

  return score;
}

function chooseBetter(
  first,
  second
) {
  return (
    resultScore(second) >
    resultScore(first)
  )
    ? second
    : first;
}

async function scanWithFallbacks(
  client,
  image
) {
  let first;

  try {
    first =
      await runStructuredScan(
        client,
        image,
        BASE_PROMPT
      );

  } catch (error) {

    console.warn(
      "Structured scan failed; using JSON fallback:",
      error?.message || error
    );

    first =
      await runJsonFallback(
        client,
        image,
        BASE_PROMPT
      );
  }

  if (
    !shouldRetry(first)
  ) {
    return cleanResult(
      first
    );
  }

  try {
    let second;

    const verificationPrompt = `
${BASE_PROMPT}

${RETRY_PROMPT}

FIRST RESULT TO VERIFY:

${JSON.stringify(first)}
`;

    try {
      second =
        await runStructuredScan(
          client,
          image,
          verificationPrompt
        );

    } catch (error) {

      console.warn(
        "Structured retry failed; using JSON fallback retry:",
        error?.message || error
      );

      second =
        await runJsonFallback(
          client,
          image,
          verificationPrompt
        );
    }

    return cleanResult(
      chooseBetter(
        first,
        second
      )
    );

  } catch (error) {

    console.warn(
      "Second scan pass failed; using first result:",
      error?.message || error
    );

    return cleanResult(
      first
    );
  }
}

export default async function handler(
  req,
  res
) {
  if (
    req.method === "OPTIONS"
  ) {
    res.setHeader(
      "Allow",
      "POST, OPTIONS"
    );

    return res
      .status(204)
      .end();
  }

  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST, OPTIONS"
    );

    return res
      .status(405)
      .json({
        error:
          "Gebruik POST."
      });
  }

  if (
    !process.env.OPENAI_API_KEY
  ) {
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
    !image.startsWith(
      "data:image/"
    )
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
      Number(
        error?.status
      ) || 500;

    const safeStatus =
      (
        status >= 400 &&
        status < 600
      )
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

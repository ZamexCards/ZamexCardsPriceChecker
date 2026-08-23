
71d8adc8-25b6-4880-9aef-b605df799807.png
c6543992-d241-4356-aca2-b6c0b05ff0d1.png
5b1d6184-0aab-4081-bd6b-87e94c9760d4.png
5868d12a-cd62-4a77-bbbb-4516c9b25a07.png

b90431fc-00a6-40ee-b9ec-4e5ddb74418e.png

11171129-67b9-4e46-a8c4-63bdf2a357b5.png
we zjn nu hier al 2 uur mee aan het rommelen, kan je iets bedenken waar we dit nu echt mee op kunnen lossen ?

8f3eeade-37d8-4011-b718-38bbfc147f60.png
ik begin het zat te worden. 

Mooi. 👍

Test nu alleen de Chinese Shiinotic die steeds problemen gaf.

Er zijn nu twee interessante uitkomsten:

HTTP 200 / Klaar → dan hebben we het fundamentele probleem waarschijnlijk opgelost.

HTTP 500 → stuur mij alleen een screenshot van JSON-resultaat. In v20 hoort bij diagnostic nu veel duidelijkere informatie te staan, bijvoorbeeld status, reason en reasoning_tokens.

Daarmee kunnen we bij een fout precies zien waarom OpenAI geen resultaat terugstuurt, in plaats van opnieuw onderdelen willekeurig te veranderen.

Ik ben vooral benieuwd wat de Shiinotic nu doet.


a11db0bb-32fb-4fbb-bf14-c69756632027.png

Ja, dit is belangrijk: dit is nu weer een ánder probleem dan de AI-herkenning.

De fout ontstaat al na 0,82 seconde en de server geeft:

FUNCTION_INVOCATION_FAILED

Dat betekent dat /api/scan crasht voordat de aanvraag überhaupt goed bij OpenAI komt. Daarom zien we ook geen nieuwe diagnostic. Dit is dus niet omdat de Chinese kaart moeilijk te herkennen is.

Bovendien hadden we eerder precies deze aanwijzing in Vercel:

SyntaxError: Unexpected identifier 'is'

En dat verklaart waarom het soms wél werkte en na een wijziging ineens alle kaarten weer 500 kunnen geven: er staat waarschijnlijk opnieuw een JavaScript-syntaxfout in api/scan.js.

Ik wil nu stoppen met kleine reparaties. De beste aanpak is om api/scan.js helemaal opnieuw schoon op te bouwen, zonder code van de huidige versies over te nemen. Dan maken we één eenvoudige, stabiele versie die eerst maar één ding doet:

foto → OpenAI Vision → kaartgegevens → JSON

Nog géén prijzen, database, fallback-constructies of andere extra's.

Daarna testen we dezelfde vier kaarten waarmee we inmiddels weten wat er moet gebeuren: Mega Charizard X ex, Koreaanse Eevee ex, Japanse Iron Valiant ex en deze Chinese Shiinotic. Pas als die vier betrouwbaar werken, bouwen we verder.

Ik zou dus nu niet nogmaals dezelfde code proberen te repareren. We hebben daar inmiddels genoeg tijd aan besteed.

Als je wilt, maak ik nu een volledig nieuwe scan.js vanaf nul, en ik geef hem je als één compleet tekstbestand zodat je alleen maar alles selecteren → verwijderen → plakken → opslaan hoeft te doen.


ok

Ik heb nu een echt schone scanner-backend vanaf nul gemaakt.

Belangrijk verschil: deze versie gebruikt GPT-4.1 mini, een non-reasoning model met image input en Structured Outputs. Dat vermijdt precies het probleem waarbij reasoning-modellen tokens kunnen “opeten” zonder zichtbare output. OpenAI ondersteunt bij GPT-4.1 mini zowel image input als Structured Outputs. 

Ook heb ik jouw package.json gecontroleerd: je gebruikt openai ^6.0.0 en ESM, dus deze code past bij jouw projectopzet.

De JavaScript-syntax is gecontroleerd: OK.

Aanbevolen ZIP:
Download ZamexCards clean scanner

Of als tekstbestand:
Download scan_clean_v1_kopieren.txt

Vervang alleen api/scan.js door de scan.js uit de ZIP.

Daarna testen we één kaart eerst: de Chinese Shiinotic. Als deze nog fout gaat, krijgen we nu een normale JSON-foutmelding uit deze veel simpelere backend, in plaats van weer een hele keten van recovery- en reasoningproblemen. 


scan_clean_v1_kopieren.txt
Document


Bibliotheek
/
scan_clean_v1_kopieren.txt


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
  "- Poké Ball, Great Ball and Master Ball patterns are finishes/variants of the same base card.",
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
    if (!setTotal) {
      setTotal = match[2].trim();
    }
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Gebruik POST.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendError(
      res,
      503,
      "OPENAI_API_KEY ontbreekt in Vercel."
    );
  }

  const image = req.body?.image;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return sendError(
      res,
      400,
      "Geen geldige kaartafbeelding ontvangen."
    );
  }

  if (image.length > 12000000) {
    return sendError(
      res,
      413,
      "Afbeelding is te groot. Gebruik een kleinere foto."
    );
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify this Pokemon TCG card and return the structured JSON result."
            },
            {
              type: "image_url",
              image_url: {
                url: image,
                detail: "high"
              }
            }
          ]
        }
      ],

      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pokemon_card_scan",
          strict: true,
          schema: SCHEMA
        }
      },

      max_tokens: 1200,
      temperature: 0
    });

    const message = completion?.choices?.[0]?.message;
    const content = clean(message?.content);

    if (!content) {
      return sendError(
        res,
        502,
        "AI gaf geen kaartresultaat terug.",
        `finish_reason=${completion?.choices?.[0]?.finish_reason || "unknown"}`
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return sendError(
        res,
        502,
        "AI-resultaat kon niet worden gelezen.",
        error?.message || "JSON parse error"
      );
    }

    const result = normalizeNumberFields(parsed);

    return res.status(200).json(result);

  } catch (error) {
    console.error("ZamexCards clean scanner error:", {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type
    });

    const status = Number(error?.status || 0);

    if (status === 401) {
      return sendError(
        res,
        401,
        "OpenAI API-sleutel is ongeldig.",
        error?.message
      );
    }

    if (status === 429) {
      return sendError(
        res,
        429,
        "OpenAI API-limiet of tegoed bereikt.",
        error?.message
      );
    }

    return sendError(
      res,
      500,
      "AI kaartscan mislukt.",
      error?.message || String(error)
    );
  }
}

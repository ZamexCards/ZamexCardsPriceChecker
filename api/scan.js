
71d8adc8-25b6-4880-9aef-b605df799807.png
c6543992-d241-4356-aca2-b6c0b05ff0d1.png
5b1d6184-0aab-4081-bd6b-87e94c9760d4.png
5868d12a-cd62-4a77-bbbb-4516c9b25a07.png

b90431fc-00a6-40ee-b9ec-4e5ddb74418e.png

11171129-67b9-4e46-a8c4-63bdf2a357b5.png
we zjn nu hier al 2 uur mee aan het rommelen, kan je iets bedenken waar we dit nu echt mee op kunnen lossen ?

Zeker. Ik heb nu beide varianten gemaakt:

Aanbevolen: ZIP-bestand — uitpakken en scan.js rechtstreeks uploaden naar de map api in GitHub:

Download ZamexCards-scan-js.zip

Of als je liever de volledige tekst kopieert:

Download scan-js-om-te-kopieren.txt

Ik raad de ZIP-versie aan. Daarmee voorkomen we dat er tijdens kopiëren opnieuw vreemde tekst in scan.js terechtkomt.

Na het uploaden zeg je “geupload”; dan controleer ik eerst het bestand in GitHub voordat we opnieuw gaan testen. 


scan-js-om-te-kopieren.txt
Document


ik heb het ebstand voa de zip vervangen, als het goed is is het gelukt

Ja, dit ziet er nu goed uit. 👍

Ik heb rechtstreeks in jouw GitHub-repository gekeken. De nieuwe api/scan.js staat daadwerkelijk op main en begint nu correct met:

import OpenAI from "openai";

export const config = {
  maxDuration: 30
};
Ik heb ook verderop in het bestand gecontroleerd. De callVision()-functie, JSON-verwerking en de OpenAI-aanroep staan nu als echte JavaScript-code in het bestand. De chattekst die het bestand eerder kapotmaakte, staat daar niet meer tussen.

Dus nu pas weer testen.

Pak als eerste precies de Chinese Shiinotic die steeds fout ging en druk één keer op AI scan uitvoeren.

Als die nog fout gaat, stuur je alleen het resultaat/screenshot. Nu weten we namelijk zeker dat we niet meer tegen die kapotte scan.js aan het debuggen zijn.


8f3eeade-37d8-4011-b718-38bbfc147f60.png
ik begin het zat te worden. 

Ja. We hebben nu eindelijk genoeg informatie om niet meer te gokken.

De fout AI returned no usable output bij de moeilijke Chinese kaart past heel goed bij een output-tokenprobleem van het reasoning-model: bij de Responses API telt max_output_tokens óók de interne reasoning-tokens mee. Als die limiet op is, kan een response incomplete worden zonder zichtbare tekst. OpenAI documenteert dit expliciet; max_output_tokens omvat zowel zichtbare output als reasoning-tokens. 

Dat verklaart ook waarom:

eenvoudige kaarten rond 5–6 sec wel werken;

moeilijkere Chinese kaarten langer nadenken;

en daarna soms helemaal geen output_text teruggeven.

Ik heb daarom v20 gemaakt met drie gerichte wijzigingen:

reasoning.effort = "minimal" zodat de scanner veel minder interne tokens verbruikt;

max_output_tokens verhoogd van 1000 naar 4000;

één enkele scan-call in plaats van twee achter elkaar, zodat we niet tegen de Vercel-limiet aanlopen.

De JavaScript-syntax is gecontroleerd: OK.

Gebruik bij voorkeur weer de ZIP-methode, omdat die bij jou nu bewezen goed werkt:

Download ZamexCards scan v20 ZIP

Of als tekst:

Download scan_v20_kopieren.txt

Vervang alleen api/scan.js met de scan.js uit de ZIP.

Daarna wil ik niet weer vijf kaarten laten testen. Alleen die Chinese Shiinotic eerst. Als deze v20 nog faalt, geeft de diagnostic voortaan ook status, reason en het aantal reasoning_tokens. Dan weten we exact of mijn diagnose klopt, in plaats van weer een ronde op goed geluk te doen. 


scan_v20_kopieren.txt
Document


Bibliotheek
/
scan_v20_kopieren.txt


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

const PROMPT = [
  "Identify exactly one Pokémon TCG card from the image.",
  "Work from the whole card, not OCR alone.",
  "Use artwork, printed name, HP, type, collector number, set total, set code or symbol, copyright/layout, language and foil pattern.",
  "Support English, Japanese, Simplified Chinese, Traditional Chinese, Korean, Dutch, German, French, Italian, Spanish and Portuguese.",
  "",
  "Identity rules:",
  "- Identify the base card first.",
  "- For Japanese, Chinese and Korean, read the original script and use artwork + HP + numbering + regional markings together.",
  "- card_name is the canonical English name when confidently known.",
  "- printed_name preserves the visible original-language name when readable.",
  "- Never invent unreadable digits or a set code.",
  "- If the exact set name/code is uncertain, leave that field empty but still identify the card when the card identity and collector number are usable.",
  "",
  "Number rules:",
  "- card_number is numerator only, such as 074, 224, 230 or TG14.",
  "- set_total is denominator only, such as 187, 207 or TG30.",
  "- collector_number is the complete printed number such as 074/187.",
  "- Do not confuse RR, SR, SAR, AR or UR rarity labels with set codes.",
  "",
  "Finish rules:",
  "- Determine finish only after base-card identity.",
  "- Poké Ball, Great Ball and Master Ball patterns are variants of the same base card.",
  "- If finish is uncertain use Unknown.",
  "",
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
  const m = cleanText(value).match(/^([^/]+)\/([^/]+)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

function normalizeResult(raw) {
  let cardNumber = cleanText(raw?.card_number);
  let setTotal = cleanText(raw?.set_total);
  let collectorNumber = cleanText(raw?.collector_number);

  const parts = splitCollector(collectorNumber) || splitCollector(cardNumber);

  if (parts) {
    cardNumber = parts[0];
    if (!setTotal) setTotal = parts[1];
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

function parseOutput(response) {
  const text = cleanText(response?.output_text);

  if (!text) {
    const reason = response?.incomplete_details?.reason || "";
    const reasoningTokens =
      response?.usage?.output_tokens_details?.reasoning_tokens ?? "";
    const status = response?.status || "unknown";

    throw new Error(
      `No visible output; status=${status}; reason=${reason || "none"}; reasoning_tokens=${reasoningTokens}`
    );
  }

  return normalizeResult(JSON.parse(text));
}

function jsonError(res, status, message, diagnostic = "") {
  return res.status(status).json({
    ok: false,
    error: message,
    diagnostic: cleanText(diagnostic).slice(0, 600)
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
    return jsonError(res, 405, "Gebruik POST.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(res, 503, "OPENAI_API_KEY ontbreekt in Vercel.");
  }

  const image = req.body?.image;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return jsonError(res, 400, "Geen geldige kaartafbeelding ontvangen.");
  }

  if (image.length > 12000000) {
    return jsonError(res, 413, "Afbeelding is te groot. Probeer een kleinere foto.");
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: MODEL,

      reasoning: {
        effort: "minimal"
      },

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

      max_output_tokens: 4000
    });

    const result = parseOutput(response);

    return res.status(200).json(result);

  } catch (error) {
    console.error("ZamexCards scan v20 error:", {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type
    });

    const status = Number(error?.status || 0);

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

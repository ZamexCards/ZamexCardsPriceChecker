
dit is japans

chinees
koriaans

7c82d8f3-ffa0-4b42-b59c-971523082077.png

82eea0b3-25e1-468a-9ea3-36d0ea227a1a.png

7af0aee2-ec28-496c-b33f-da33e0df89a2.png
kan dit aan mij liggen?

19b67279-c929-4052-a8a0-cf075a8f3eb9.png
deze chineze kaart werkt

41daf288-6035-439c-b2e6-4a4031bfc72c.png
maar deze chineze kaart niet

e17f4000-3dea-4bb4-9038-ffdec1579a37.png
nu is het bedrag resterend nog 

b5081f79-a60b-4202-90d5-85716ec50248.png

38ab29e1-7684-40ed-b55a-9a17bda36e23.png

0d3e0383-efa2-4208-bad9-29f54bbfd576.png

9163d421-3c17-419a-8119-d43d68df2ae0.png

e3ee001f-bb08-45f1-a742-cd26e659293f.png
deze kaart wordt ook niet herkend

95bc3524-4795-461a-9bfb-b9dd995d4eb8.png
deze chineze ook nie

Ik kan de drie scans niet rechtstreeks vanaf mijn eigen werkomgeving uitvoeren, omdat die omgeving jouw Vercel-domein niet kan bereiken. Ik heb het geprobeerd; de verbinding strandt al op DNS voordat er een request naar jouw site kan gaan.

Wat ik wél kan doen, en dat is eigenlijk nog beter voor het debuggen: ik kan een zelftestpagina maken die drie vaste kaartafbeeldingen achter elkaar naar jouw /api/scan stuurt en per test laat zien:

HTTP-status

scantijd

ruwe serverreactie

JSON-resultaat

geslaagd/mislukt

Dan hoef jij alleen die pagina in GitHub te zetten en één keer op “Start 3 tests” te klikken. Daarmee testen we jouw echte Vercel-backend onder precies dezelfde omstandigheden als je scanner.

Ik zou daarvoor deze drie nemen:

Engelse Mega Charizard

Chinese Shiinotic

Chinese kaart die eerder wél werkte

Dan zien we meteen of het probleem kaartafhankelijk is of dat scan.js nog steeds algemeen crasht.

Als je wilt, maak ik die 3-kaarten zelftestpagina nu voor je.


b4b2e189-9c62-43ee-8068-c70b64b2fbee.png
ab5e9236-f262-4726-9ad4-acc20e6af212.png
9dbe6eb0-43be-4172-8f2e-aab52dc6a113.png
2465f8c0-bb7c-4a36-9861-e8575dd721db.png
f303cfe2-bcbd-495c-bc44-8fcbd9ce3110.png

Ja, dit is nu heel nuttige testinformatie. We hebben het probleem behoorlijk scherp.

Van de 5 voorbeelden:

✅ Engels – Mega Charizard X ex: werkt, HTTP 200, ~5,65 sec.

❌ Chinees – Shiinotic 1505/07: mislukt, HTTP 500, ~14,65 sec., AI returned no usable output.

✅ Koreaans – Eevee ex 224/187: werkt, HTTP 200, ~6,08 sec.

❌ Chinees – Cufant 230/207: mislukt, HTTP 500, ~12,08 sec., dezelfde AI returned no usable output.

✅ Japans – Iron Valiant ex 074/187: werkt, HTTP 200, ~4,67 sec.

Dus 3 van 5 werken. Belangrijker: de backend, API-key, afbeelding-upload en JSON-verwerking functioneren aantoonbaar. Het probleem concentreert zich nu op bepaalde Chinese kaarten.

Ook zie ik iets belangrijks: bij de twee mislukte scans duurt het 12–15 seconden, terwijl succesvolle scans rond 5–6 seconden klaar zijn. De API wordt dus daadwerkelijk aangeroepen; dit is niet meer de oude JavaScript/Vercel-crash.

Mijn volgende aanpassing zou daarom niet nóg meer aan de HTML veranderen. Ik wil scan.js zo aanpassen dat bij AI returned no usable output automatisch een tweede, vereenvoudigde vision-poging wordt gedaan, specifiek gericht op: taal → Pokémon → kaartnummer → setcode. Daarna kunnen we eventueel een derde fallback gebruiken waarbij alleen de zichtbare kaartgegevens worden uitgelezen.

Dat is ook handig voor de uiteindelijke scanner: een moeilijke Chinese/Japanse/Koreaanse kaart geeft dan niet meteen een foutmelding, maar schakelt automatisch naar een robuustere herkenningsmethode.

Ik zou dus nu alleen scan.js aanpakken; de HTML laten we met rust.


voer maar uit

Uitgevoerd. Ik heb scan.js v18 gemaakt met een extra herstelpoging voor moeilijke kaarten, vooral voor Chinees/Japans/Koreaans.

De nieuwe werking is:

eerste scan = volledige herkenning;

als OpenAI no usable output geeft, volgt automatisch een vereenvoudigde recovery-scan;

die tweede poging focust alleen op taal, kaartnaam/Pokémon, kaartnummer, setcode/set en basis-finish;

Chinese kaarten hoeven daarbij niet eerst perfect aan een Engelstalige set gekoppeld te worden;

als de exacte set onzeker is, kan de kaart toch worden teruggegeven;

JavaScript-syntax is gecontroleerd: OK.

Download scan_v18_kopieren.txt

Vervang opnieuw de volledige inhoud van api/scan.js door dit bestand en commit naar main.

Daarna zou ik precies deze vijf opnieuw testen: Mega Charizard, Japanse Iron Valiant, Koreaanse Eevee, Chinese Cufant en Chinese Shiinotic. Vooral bij de twee Chinese kaarten moet v18 nu de recovery-scan proberen in plaats van meteen HTTP 500 te geven. 


scan_v18_kopieren.txt
Document


scan_v18_kopieren.txt


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

const MAIN_PROMPT = `
You are a specialist Pokémon Trading Card Game scanner.

Analyze ONE Pokémon TCG card image and identify the exact base card.

Use:
- artwork
- printed card name
- original writing system
- HP
- type
- evolution stage
- collector number
- set total
- set code
- graphical set symbol
- promo/subset numbering
- copyright year
- regional layout
- foil/stamp pattern

Support:
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

Important:
- Identify the BASE CARD first.
- Finish must not change base-card identity.
- For Japanese, Chinese and Korean cards, do not depend on Latin OCR.
- Use original-script text, artwork, HP, number, set mark and layout together.
- card_name = canonical English card/Pokémon name when confidently known.
- printed_name = visible original-language printed name when readable.
- Never invent unreadable digits.
- Never invent a set code.
- If set is uncertain, leave set_name or set_code empty rather than guessing.
- found=false only when useful base-card identity cannot be established.

Number format:
- card_number = numerator only, e.g. 074, 224, 230, TG14.
- set_total = denominator only, e.g. 187, 207, TG30.
- collector_number = complete value, e.g. 074/187, 230/207.
- Do not return card_number as 224/187.
- Do not confuse rarity labels RR, SR, SAR, AR or UR with set codes.

Finish values:
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

If finish is uncertain, use Unknown.

Return only the structured result.
`;

const FALLBACK_PROMPT = `
You are reading a difficult Pokémon TCG card image.

Do a SIMPLE recovery scan. Focus only on:
1. language
2. Pokémon/card identity from artwork and printed name
3. collector number
4. set code or set symbol if visible
5. basic finish type

For Chinese cards:
- read Simplified or Traditional Chinese script directly
- use artwork + HP + visible collector number + printed regional code
- do not require English text
- if the set name is uncertain, leave it empty
- still return the card if name/artwork and number are usable

For Japanese and Korean cards, use the same principle.

Do not overthink the set.
Do not invent values.

Return only the structured result.
`;

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

function extractOutputText(response) {
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

async function callVision(client, image, prompt, detail = "high", maxOutputTokens = 1000) {
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
            detail
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

function jsonError(res, status, message, diagnostic = "") {
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
    return jsonError(res, 405, "Gebruik POST.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(res, 503, "OPENAI_API_KEY ontbreekt in Vercel.");
  }

  const image = req.body?.image;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return jsonError(res, 400, "Geen geldige kaartafbeelding ontvangen.");
  }

  if (image.length > 12_000_000) {
    return jsonError(res, 413, "Afbeelding is te groot. Probeer een kleinere foto.");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  let firstError = null;

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
    firstError = error;
    console.warn("Primary scan failed:", error?.message || error);
  }

  try {
    const fallbackResult = await callVision(
      client,
      image,
      FALLBACK_PROMPT,
      "auto",
      650
    );

    fallbackResult.notes = cleanText(
      `${fallbackResult.notes} | Recovery scan used`
    ).slice(0, 900);

    return res.status(200).json(fallbackResult);
  } catch (fallbackError) {
    console.error("Fallback scan failed:", {
      primary: firstError?.message,
      fallback: fallbackError?.message,
      status: fallbackError?.status,
      code: fallbackError?.code,
      type: fallbackError?.type
    });

    const status = Number(fallbackError?.status || firstError?.status || 0);

    if (status === 401) {
      return jsonError(
        res,
        401,
        "OpenAI API-sleutel is ongeldig.",
        fallbackError?.message || firstError?.message
      );
    }

    if (status === 429) {
      return jsonError(
        res,
        429,
        "OpenAI API-limiet of tegoed bereikt.",
        fallbackError?.message || firstError?.message
      );
    }

    return jsonError(
      res,
      500,
      "AI kaartscan mislukt. Probeer opnieuw.",
      `Primary: ${firstError?.message || "unknown"} | Fallback: ${fallbackError?.message || "unknown"}`
    );
  }
}

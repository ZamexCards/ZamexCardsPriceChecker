
dit is japans

chinees
koriaans

Klaar. Ik heb scan.js v15 gemaakt met de verbeteringen die we net wilden:

card_number wordt altijd netjes gesplitst van set_total;

collector_number blijft volledig, bijvoorbeeld 224/187;

Japanse, Chinese en Koreaanse kaarten krijgen extra controle als setnaam/setcode nog ontbreekt;

bij Aziatische kaarten wordt een tweede analyse gedaan als de setherkenning zwak is;

de eerste AI-uitkomst wordt bij de tweede controle meegenomen, zodat hij gericht kan corrigeren;

Structured Output + JSON fallback blijven beide actief;

JavaScript-syntax is gecontroleerd: OK.

Download scan.js v15

Vervang in GitHub weer alleen:

api/scan.js

door dit bestand en commit naar main. Vercel hoort daarna automatisch opnieuw te deployen.

Daarna zou ik meteen deze drie opnieuw testen op scanner-test.html: de Chinese Copperajah, de Japanse Iron Valiant ex en de Koreaanse Eevee ex. Dan kunnen we zien of vooral de setherkenning bij Chinees beter is geworden en of de kaartnummers nu netjes als 074, 224, enz. worden teruggegeven. 


scan_v15.js
Code


7c82d8f3-ffa0-4b42-b59c-971523082077.png

Dat is normaal: GitHub/Vercel kan van een .js-bestand geen visuele preview maken, daarom staat er “Er is geen voorbeeld beschikbaar”.

Je kunt gewoon op Downloaden klikken. Het bestand zelf is goed.

Gebruik deze link:

Download scan.js v15

Daarna in GitHub:

open api/scan.js

klik op het potloodje Edit

Ctrl+A

verwijder alles

open het gedownloade scan_v15.js in Kladblok/Notepad

Ctrl+A → Ctrl+C

plak alles in GitHub

klik Commit changes

commit naar main

Daarna deployt Vercel automatisch opnieuw.

Als je wilt, kun je na de commit meteen weer de Chinese kaart testen.


scan_v15.js
Code


82eea0b3-25e1-468a-9ea3-36d0ea227a1a.png

Ja, ik zie het. De vorige downloadlink geeft bij jou ERR_INVALID_RESPONSE. Dat ligt aan de bestandsdownload vanuit ChatGPT, niet aan GitHub of Vercel.

Ik heb daarom exact dezelfde code ook als een eenvoudig .txt-bestand gemaakt. Dat is makkelijker te openen:

Download scan_v15_kopieren.txt

Daarna heel eenvoudig
Open het gedownloade bestand in Kladblok en doe:

Ctrl + A → Ctrl + C

Ga vervolgens naar GitHub → api → scan.js → Edit.

Daar:

Ctrl + A → Delete → Ctrl + V

Daarna Commit changes.

De bestandsnaam in GitHub blijft dus gewoon scan.js. Je gebruikt het .txt-bestand alleen om de nieuwe code gemakkelijk te kunnen kopiëren.

Als deze download óók dezelfde fout geeft, zeg dan alleen “werkt ook niet”. Dan doen we het zonder downloaden en geef ik je de code op een manier die je rechtstreeks in GitHub kunt plakken. 


scan_v15_kopieren.txt
Document


scan_v15_kopieren.txt


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

Support old cards, modern cards, promos, gallery/subsets, special regional releases,
Japanese releases, Chinese releases and Korean releases.

Use ALL visible information together:
- artwork
- card layout
- printed name and writing system
- HP, type and evolution stage
- set code or graphical set symbol
- collector number and printed set total
- promo/gallery/subset numbering
- copyright / era markings
- foil / stamp / Poké Ball / Great Ball / Master Ball pattern

IDENTITY RULES
1. Identify the BASE CARD independently from its finish.
2. Finish must NEVER change which card it is.
3. Read collector numbers exactly where possible.
4. card_number must contain ONLY the numerator, e.g. "074", "224", "TG14", "GG21", "SWSH075".
5. set_total must contain ONLY the denominator when printed, e.g. "187", "086", "TG30", "GG70".
6. collector_number should contain the combined printed value, e.g. "074/187".
7. Read printed set codes when present.
8. For graphical set symbols, infer set_name from symbol + artwork + era + collector number.
9. Never invent unreadable digits or set codes.
10. found=false only when there is not enough information for a useful identity.

ASIAN CARD RULES
11. Japanese cards: use Japanese name, artwork, number, set mark, HP and layout together.
12. Chinese cards: support both Simplified and Traditional Chinese. Use Chinese text,
    artwork, collector number, set markings, HP, type and layout together.
13. Korean cards: use Korean name, artwork, number, set markings, HP and layout together.
14. card_name should be the canonical English Pokémon/card name when confidently known.
15. printed_name should preserve the visible original-script name when readable.
16. For Asian cards, do NOT leave set_name and set_code both empty if the set can reasonably
    be inferred from artwork, collector number, printed code, regional layout or release style.
17. If the set cannot be determined reliably, leave set_name/set_code empty rather than guessing.

FINISH RULES
18. Determine finish only AFTER the base card is identified.
19. Choose exactly one allowed finish.
20. Poké Ball / Great Ball / Master Ball / stamps are variants of the same base card.
21. If uncertain, use Unknown.

Return only the structured result.
`;

const RETRY_PROMPT = `
Perform a second, stricter verification of this Pokémon card.

Focus especially on:
- bottom-left and bottom-center collector number;
- whether card_number was incorrectly returned as "074/187" instead of "074";
- set total;
- printed set code or symbol;
- top name area;
- Japanese / Chinese / Korean script;
- artwork identity;
- regional release style.

For Japanese, Chinese and Korean cards:
- identify the exact base card from artwork + number + set markings;
- determine the set name/code if reasonably possible;
- keep card_number and set_total separated;
- do not confuse rarity labels such as RR / SAR with the set code.

Do not guess missing digits.
Return only the structured result.
`;

function cleanText(v) {
  return String(v ?? "").trim();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v || 0)));
}

function normalizeCollectorParts(result) {
  let cardNumber = cleanText(result.card_number);
  let setTotal = cleanText(result.set_total);
  let collector = cleanText(result.collector_number);

  const split = (value) => {
    const m = cleanText(value).match(/^([^/]+)\/([^/]+)$/);
    return m ? [m[1].trim(), m[2].trim()] : null;
  };

  let parts = split(collector);
  if (!parts) parts = split(cardNumber);

  if (parts) {
    cardNumber = parts[0];
    if (!setTotal) setTotal = parts[1];
    collector = `${parts[0]}/${parts[1]}`;
  } else if (!collector && cardNumber && setTotal) {
    collector = `${cardNumber}/${setTotal}`;
  }

  // Prevent accidental duplication like card_number="224/187", set_total="187"
  const cardParts = split(cardNumber);
  if (cardParts) {
    cardNumber = cardParts[0];
    if (!setTotal) setTotal = cardParts[1];
    collector = collector || `${cardParts[0]}/${cardParts[1]}`;
  }

  return { cardNumber, setTotal, collector };
}

function cleanResult(x) {
  const parts = normalizeCollectorParts(x || {});

  const out = {
    found: Boolean(x?.found),
    card_name: cleanText(x?.card_name),
    printed_name: cleanText(x?.printed_name),
    language: LANGUAGES.includes(x?.language) ? x.language : "Unknown",
    set_name: cleanText(x?.set_name),
    set_code: cleanText(x?.set_code),
    card_number: parts.cardNumber,
    set_total: parts.setTotal,
    collector_number: parts.collector,
    finish: FINISHES.includes(x?.finish) ? x.finish : "Unknown",
    identity_confidence: clamp01(x?.identity_confidence),
    finish_confidence: clamp01(x?.finish_confidence),
    notes: cleanText(x?.notes).slice(0, 900)
  };

  return out;
}

function extractResponseText(response) {
  const direct = cleanText(response?.output_text);
  if (direct) return direct;

  const pieces = [];

  for (const item of response?.output || []) {
    if (typeof item?.text === "string") pieces.push(item.text);

    for (const c of item?.content || []) {
      if (typeof c?.text === "string") pieces.push(c.text);
      if (typeof c?.output_text === "string") pieces.push(c.output_text);
      if (typeof c?.json === "string") pieces.push(c.json);
      if (c?.json && typeof c.json === "object") pieces.push(JSON.stringify(c.json));
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

  if (!raw) throw new Error("AI returned an empty response");

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
    throw new Error(`OpenAI response failed: ${JSON.stringify(response?.error || {})}`);
  }

  const text = extractResponseText(response);

  if (!text) {
    console.error("Empty OpenAI output:", JSON.stringify(response?.output || []).slice(0, 5000));
    throw new Error("AI returned an empty response");
  }

  return cleanResult(parseJsonText(text));
}

async function runStructuredScan(client, image, prompt) {
  const response = await client.responses.create({
    model: MODEL,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: image, detail: "high" }
      ]
    }],
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

  return parseResponse(response);
}

async function runJsonFallback(client, image, prompt) {
  const fallbackPrompt = `${prompt}

Return exactly one JSON object and nothing else.
The object MUST contain:
found, card_name, printed_name, language, set_name, set_code,
card_number, set_total, collector_number, finish,
identity_confidence, finish_confidence, notes.

IMPORTANT:
card_number must NOT contain "/".
Example:
card_number = "224"
set_total = "187"
collector_number = "224/187"
`;

  const response = await client.responses.create({
    model: MODEL,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: fallbackPrompt },
        { type: "input_image", image_url: image, detail: "high" }
      ]
    }],
    max_output_tokens: 1400
  });

  return parseResponse(response);
}

function isAsianLanguage(lang) {
  return [
    "Japanese",
    "Chinese",
    "Simplified Chinese",
    "Traditional Chinese",
    "Korean"
  ].includes(lang);
}

function shouldRetry(result) {
  if (!result?.found) return true;
  if (result.identity_confidence < 0.70) return true;
  if (!result.card_name && !result.card_number) return true;
  if (!result.card_number) return true;

  // Asian cards get a second pass when set identification is weak.
  if (
    isAsianLanguage(result.language) &&
    !result.set_name &&
    !result.set_code
  ) {
    return true;
  }

  // Extra verification for collector numbering consistency.
  if (
    result.collector_number &&
    result.collector_number.includes("/") &&
    (!result.set_total || !result.card_number)
  ) {
    return true;
  }

  return false;
}

function resultScore(x) {
  let score = (x?.identity_confidence || 0) * 100;

  if (x?.card_name) score += 18;
  if (x?.card_number) score += 20;
  if (x?.set_total) score += 12;
  if (x?.set_code) score += 16;
  if (x?.set_name) score += 12;
  if (x?.collector_number) score += 12;
  if (x?.language && x.language !== "Unknown") score += 5;

  if (
    isAsianLanguage(x?.language) &&
    (x?.set_name || x?.set_code)
  ) {
    score += 8;
  }

  return score;
}

function chooseBetter(first, second) {
  return resultScore(second) > resultScore(first) ? second : first;
}

async function scanWithFallbacks(client, image) {
  let first;

  try {
    first = await runStructuredScan(client, image, BASE_PROMPT);
  } catch (error) {
    console.warn("Structured scan failed; using JSON fallback:", error?.message || error);
    first = await runJsonFallback(client, image, BASE_PROMPT);
  }

  if (!shouldRetry(first)) {
    return cleanResult(first);
  }

  try {
    let second;

    try {
      second = await runStructuredScan(
        client,
        image,
        `${BASE_PROMPT}\n\n${RETRY_PROMPT}\n\nFIRST RESULT TO VERIFY:\n${JSON.stringify(first)}`
      );
    } catch (error) {
      console.warn("Structured retry failed; using JSON fallback retry:", error?.message || error);
      second = await runJsonFallback(
        client,
        image,
        `${BASE_PROMPT}\n\n${RETRY_PROMPT}\n\nFIRST RESULT TO VERIFY:\n${JSON.stringify(first)}`
      );
    }

    return cleanResult(chooseBetter(first, second));
  } catch (error) {
    console.warn("Second scan pass failed; using first result:", error?.message || error);
    return cleanResult(first);
  }
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
    return res.status(400).json({
      error: "Geen geldige kaartafbeelding ontvangen."
    });
  }

  if (image.length > 12_000_000) {
    return res.status(413).json({
      error: "Afbeelding is te groot. Probeer een kleinere foto."
    });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const result = await scanWithFallbacks(client, image);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(result);

  } catch (error) {
    console.error("OpenAI scan error:", error);

    const status = Number(error?.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    return res.status(safeStatus).json({
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

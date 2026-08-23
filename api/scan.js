
dit is japans

chinees
koriaans

7c82d8f3-ffa0-4b42-b59c-971523082077.png

82eea0b3-25e1-468a-9ea3-36d0ea227a1a.png

7af0aee2-ec28-496c-b33f-da33e0df89a2.png
kan dit aan mij liggen?

19b67279-c929-4052-a8a0-cf075a8f3eb9.png
deze chineze kaart werkt

Ja! 🎉 Deze Chinese kaart werkt nu goed. Dit is een flinke verbetering ten opzichte van de vorige test.

De scanner haalt nu netjes uit de foto:

Pokémon: Cufant ✅

Gedrukte Chinese naam: 铜象 ✅

Taal: Simplified Chinese ✅

Set: Black Bolt ✅

Setcode: CBB6C ✅

Kaartnummer: 230 ✅

Set totaal: 207 ✅

Volledig nummer: 230/207 ✅

Variant: Reverse Holo ✅

Identificatiezekerheid: 98% ✅

Finish-zekerheid: 78%

En belangrijk: hij herkent dus ook een Secret/over-number kaart correct. 230/207 is volledig logisch; kaartnummer 230 ligt boven het reguliere settotaal van 207.

Wat ik nu zou testen
Voordat we deze AI-scanner in de echte ZamexCards Price Checker gaan bouwen, zou ik nog vier kaarten testen:

🇯🇵 Japanse kaart – liefst eentje waarbij setcode en kaartnummer duidelijk zichtbaar zijn.

🇰🇷 Koreaanse kaart.

🇬🇧 Engelse kaart – bijvoorbeeld een normale moderne kaart.

✨ Moeilijke variant – bijvoorbeeld Poké Ball, Master Ball, Reverse Holo, SAR/AR of andere speciale finish.

Als die vier goed gaan, hebben we voldoende bewijs dat de herkenningsbasis betrouwbaar werkt.

Daarna kunnen we de interessante stap zetten: scanner → gevonden kaart → kaartafbeelding → actuele prijsgegevens → toevoegen aan kaartenlijst → totaal → 80%-waarde.

Dat maakt van deze testscanner daadwerkelijk de ZamexCards-kaartscanner die we oorspronkelijk voor ogen hadden.


41daf288-6035-439c-b2e6-4a4031bfc72c.png
maar deze chineze kaart niet

Ja, precies. Deze tweede Chinese kaart laat zien dat het probleem nog niet de herkenning zelf hoeft te zijn, maar de foutafhandeling van scan.js.

De belangrijke melding is:

SyntaxError: Unexpected token 'A', "An error o"... is not valid JSON

Dat betekent dat /api/scan bij deze kaart géén JSON terugstuurt. Waarschijnlijk komt er vanuit Vercel/OpenAI een gewone tekstmelding terug die begint met “An error occurred…”. Daarna probeert scanner-test.html die tekst als JSON te lezen en ontstaat deze fout.

Bij de vorige Chinese Cufant kreeg de scanner wél een geldig antwoord. Deze kaart is dus een goede testcase: hij is duidelijk genoeg, met onderaan zichtbaar CBB6C en 1505/07, maar ergens tijdens de API-aanroep gaat het mis.

Dit moeten we nu oplossen
Ik zou niet opnieuw alleen de AI-prompt aanpassen. We moeten scan.js robuuster maken zodat:

OpenAI altijd gestructureerde JSON moet teruggeven.

Chinese, Japanse, Koreaanse en Engelse kaarten ondersteund blijven.

Een onduidelijke setcode/kaartnummer niet de hele scan laat mislukken.

Als OpenAI een fout geeft, scan.js die fout opvangt.

/api/scan altijd JSON naar de browser terugstuurt, óók bij een fout.

We tijdelijk de echte foutmelding zichtbaar maken, zodat we niet meer alleen "AI kaartscan mislukt" of "An error occurred" zien.

Daarmee lossen we eigenlijk twee problemen tegelijk op: betrouwbaarder scannen én fatsoenlijke foutdiagnose.

Ik kan nu een volledige nieuwe scan.js voor je maken die je net als de vorige keer in GitHub volledig kunt selecteren, verwijderen en vervangen. Dan hoef je zelf niets aan de code te wijzigen.


ja maak maar.

het is wel gek dat hij de ene chineze kaart wel zien en de andere niet

Ja, dat verschil is op zichzelf goed te verklaren: de ene Chinese kaart kon in één AI-poging volledig worden herkend, terwijl de andere kaart extra verificatie nodig had. Onze vorige scan.js deed dan een tweede AI-call. Op Vercel zit jouw functie rond een maximumduur van 30 seconden; daardoor kan zo’n moeilijke kaart nét over de limiet gaan en krijg je die gewone fouttekst “An error occurred…” in plaats van JSON.

Ik heb daarom een nieuwe v16 gemaakt die dit anders doet:

maar één AI-call per scan;

dus veel kleinere kans op Vercel-timeout;

Engels, Japans, Chinees en Koreaans blijven ondersteund;

kaartnummer en settotaal worden automatisch netjes gesplitst;

finish/variant blijft apart van de kaartidentiteit;

/api/scan probeert altijd JSON terug te sturen bij normale applicatiefouten;

JavaScript-syntax is gecontroleerd: OK.

OpenAI ondersteunt de Responses API met multimodale input en Structured Outputs, dus die basis blijft hetzelfde. 

Omdat downloaden eerder bij jou lastig ging, kun je het bestand op twee manieren gebruiken:

Download scan.js v16

of als tekstbestand:

Download scan_v16_kopieren.txt

Vervang in GitHub weer de volledige inhoud van api/scan.js door de inhoud van v16 en commit naar main.

Daarna zou ik precies die Chinese Shiinotic-kaart opnieuw testen. Die is nu onze beste stresstest: als die met v16 gewoon resultaat geeft, hebben we zeer waarschijnlijk het timeoutprobleem opgelost. 


scan_v16.js
Code


scan_v16_kopieren.txt
Document


Bibliotheek
/
scan_v16_kopieren.txt


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
You are a high-accuracy Pokémon Trading Card Game scanner.

Your job is to identify ONE physical Pokémon TCG card from the supplied image.

IMPORTANT: perform the entire identification in ONE pass.

Use all visible evidence together:
- artwork
- card layout
- printed Pokémon/card name
- original writing system
- HP
- Pokémon type
- evolution stage
- collector number
- set total
- printed set code
- graphical set symbol
- promo / gallery / subset numbering
- copyright year / regional layout
- foil pattern
- Poké Ball / Great Ball / Master Ball pattern
- stamps

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

SUPPORTED RELEASES:
old cards
modern cards
promos
Black Star Promos
Trainer Gallery
Galarian Gallery
special subsets
regional Japanese releases
regional Chinese releases
regional Korean releases
special foil/stamped variants

BASE-CARD IDENTIFICATION RULES:

1. Identify the BASE CARD first.
2. The foil/finish must NEVER change the base-card identity.
3. Use artwork + name + collector number + set markings together.
4. Do not depend on Latin OCR for Japanese, Chinese or Korean cards.
5. For Asian cards, use original-script text, artwork, HP, collector number, set marks and layout together.
6. card_name should be the canonical English Pokémon/card name when confidently known.
7. printed_name should preserve the visible original-script name when readable.
8. Never invent unreadable collector-number digits.
9. Never invent a set code.
10. If set_name or set_code cannot be determined reliably, leave that field empty, but still return the correctly identified card whenever possible.
11. found=false only when the base-card identity is genuinely unusable.

NUMBER RULES:

card_number must contain ONLY the numerator / first part.

Examples:
012
074
224
230
TG14
GG21
SWSH075
SVP036

set_total must contain ONLY the denominator / second part when printed.

Examples:
086
187
207
TG30
GG70

collector_number must contain the complete printed value.

Examples:
012/086
074/187
224/187
230/207

If the image visibly shows 1505/07, preserve exactly what is visibly printed unless you are certain that typography means a different official collector-number format.

Do NOT return card_number as "224/187".
Return:
card_number = "224"
set_total = "187"
collector_number = "224/187"

SET RULES:

- Read a printed code when present.
- Do not confuse rarity labels (RR, SR, SAR, AR, UR) with set codes.
- For graphical set symbols, infer the set only when reasonably confident.
- For Simplified/Traditional Chinese cards, regional set codes may differ from English/Japanese equivalents. Preserve the regional printed code.
- For Korean cards, do not automatically reuse a Japanese set code unless the printed Korean card actually supports that mapping.

FINISH RULES:

Determine finish only after the base card is identified.

Allowed values:
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

If a Poké Ball / Great Ball / Master Ball symbol appears repeatedly in the foil, treat it as a finish variant of the SAME base card.

If finish is uncertain, use Unknown.

Return ONLY the structured result.
`;

function text(v) {
  return String(v ?? "").trim();
}

function clamp(v) {
  const n = Number(v || 0);
  return Math.max(0, Math.min(1, n));
}

function splitCollector(value) {
  const m = text(value).match(/^([^/]+)\/([^/]+)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

function normalizeResult(raw) {
  let cardNumber = text(raw?.card_number);
  let setTotal = text(raw?.set_total);
  let collector = text(raw?.collector_number);

  let parts = splitCollector(collector) || splitCollector(cardNumber);

  if (parts) {
    cardNumber = parts[0];
    if (!setTotal) setTotal = parts[1];
    collector = `${parts[0]}/${parts[1]}`;
  } else if (!collector && cardNumber && setTotal) {
    collector = `${cardNumber}/${setTotal}`;
  }

  return {
    found: Boolean(raw?.found),
    card_name: text(raw?.card_name),
    printed_name: text(raw?.printed_name),
    language: LANGUAGES.includes(raw?.language) ? raw.language : "Unknown",
    set_name: text(raw?.set_name),
    set_code: text(raw?.set_code),
    card_number: cardNumber,
    set_total: setTotal,
    collector_number: collector,
    finish: FINISHES.includes(raw?.finish) ? raw.finish : "Unknown",
    identity_confidence: clamp(raw?.identity_confidence),
    finish_confidence: clamp(raw?.finish_confidence),
    notes: text(raw?.notes).slice(0, 900)
  };
}

function getOutputText(response) {
  const direct = text(response?.output_text);
  if (direct) return direct;

  const pieces = [];

  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") pieces.push(content.text);
      if (typeof content?.output_text === "string") pieces.push(content.output_text);
      if (typeof content?.json === "string") pieces.push(content.json);
      if (content?.json && typeof content.json === "object") {
        pieces.push(JSON.stringify(content.json));
      }
    }
  }

  return text(pieces.join("\n"));
}

function parseResult(response) {
  const output = getOutputText(response);

  if (!output) {
    console.error(
      "No usable AI output:",
      JSON.stringify(response?.output || []).slice(0, 4000)
    );
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
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first === -1 || last <= first) {
      throw new Error("AI returned invalid JSON");
    }

    parsed = JSON.parse(cleaned.slice(first, last + 1));
  }

  return normalizeResult(parsed);
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
    return res.status(405).json({
      ok: false,
      error: "Gebruik POST."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "OPENAI_API_KEY ontbreekt in Vercel."
    });
  }

  const image = req.body?.image;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return res.status(400).json({
      ok: false,
      error: "Geen geldige kaartafbeelding ontvangen."
    });
  }

  if (image.length > 12_000_000) {
    return res.status(413).json({
      ok: false,
      error: "Afbeelding is te groot. Probeer een kleinere foto."
    });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // BELANGRIJK: slechts ÉÉN AI-call.
    // Geen tweede verificatie-call meer, zodat Vercel niet tegen de functietijd aanloopt.
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

    const result = parseResult(response);

    return res.status(200).json(result);

  } catch (error) {
    console.error("ZamexCards scan error:", {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      code: error?.code
    });

    const status = Number(error?.status);

    if (status === 401) {
      return res.status(401).json({
        ok: false,
        error: "OpenAI API-sleutel is ongeldig."
      });
    }

    if (status === 429) {
      return res.status(429).json({
        ok: false,
        error: "OpenAI API-limiet of tegoed bereikt."
      });
    }

    return res.status(500).json({
      ok: false,
      error: "AI kaartscan mislukt. Probeer opnieuw.",
      diagnostic: text(error?.message).slice(0, 300)
    });
  }
}

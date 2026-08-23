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
    found: {
      type: "boolean"
    },

    card_name: {
      type: "string"
    },

    printed_name: {
      type: "string"
    },

    language: {
      type: "string",
      enum: LANGUAGES
    },

    set_name: {
      type: "string"
    },

    set_code: {
      type: "string"
    },

    card_number: {
      type: "string"
    },

    set_total: {
      type: "string"
    },

    collector_number: {
      type: "string"
    },

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

    notes: {
      type: "string"
    }
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

Analyze the COMPLETE Pokémon card image.

Do NOT depend on one OCR fragment.

Use ALL visible information together:

- artwork
- card layout
- printed Pokémon/card name
- HP
- evolution stage
- Pokémon type
- language
- set code
- graphical set symbol
- collector number
- printed set total
- promo numbering
- gallery/subset numbering
- copyright year
- foil pattern
- Poké Ball pattern
- Great Ball pattern
- Master Ball pattern
- stamps
- regional layout differences


SUPPORTED LANGUAGES

The scanner must support:

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


SUPPORTED CARDS

Recognize:

- very old Pokémon TCG cards
- Base Set era cards
- modern cards
- EX
- GX
- V
- VMAX
- VSTAR
- ex
- Mega Evolution
- promos
- Black Star Promos
- Trainer Gallery
- Galarian Gallery
- Illustration Rare
- Special Illustration Rare
- regional Asian releases
- Japanese cards
- Chinese cards
- Korean cards
- special foil versions
- stamped cards


IMPORTANT IDENTITY RULES

1.
Identify the BASE CARD first.

The finish or foil pattern must NEVER change which card it is.

For example:

Victini BLK 012/086

must remain Victini BLK 012/086 whether it is:

- Basic / Normaal
- Reverse Holo
- Poké Ball
- Great Ball
- Master Ball


2.
Read the collector number at the bottom as accurately as possible.

Examples:

012/086
130/094
TG14/TG30
GG21/GG70
SWSH075
SVP036


3.
Read the printed set code when one exists.

Examples:

BLK
PFL
BRS
ASR
SVP
MEP


4.
For older cards that use a GRAPHICAL SET SYMBOL instead of a printed code:

identify the likely set using:

- set symbol
- artwork
- card layout
- copyright year
- collector number
- set total


5.
For JAPANESE cards:

Do NOT require an English or Latin card name.

Use:

- Japanese printed name
- artwork
- collector number
- set code
- set symbol
- HP
- type
- layout

Return card_name as the canonical English Pokémon/card name when confidently known.

Keep the visible Japanese name in printed_name.


6.
For SIMPLIFIED or TRADITIONAL CHINESE cards:

Do NOT rely on English OCR.

Use:

- Chinese printed name
- artwork
- collector number
- set code
- set symbol
- HP
- type
- card layout
- regional markings

Return:

language = "Simplified Chinese"

or:

language = "Traditional Chinese"

when this can be determined.

If only "Chinese" can confidently be determined, use:

language = "Chinese"


7.
For KOREAN cards:

Do NOT require Latin text.

Use:

- Korean printed name
- artwork
- collector number
- set code
- HP
- card layout
- set markings

Return card_name as the canonical English card name when confidently known.

Keep the Korean printed name in printed_name.


8.
card_name should preferably be the canonical ENGLISH card/Pokémon name.

Examples:

灯罩夜菇 → Shiinotic
ビクティニ → Victini
빅티니 → Victini


9.
printed_name should contain the visible printed card name in its original language/script whenever readable.


10.
Never invent collector-number digits.

If something really cannot be read, return an empty string.


11.
Never invent a set code.

If the graphical set can be identified but no printed code exists, return:

set_name = identified set name

and:

set_code = ""


12.
found=false should only be used when there is not enough information to identify a useful base-card identity.


FINISH / VARIANT RULES

Only determine the finish AFTER identifying the base card.

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


Poké Ball / Great Ball / Master Ball patterns may cover a large portion of the card.

They are VARIANTS of the base card and must never influence the card identity.


If the finish is uncertain:

finish = "Unknown"

Do not guess.


CONFIDENCE

identity_confidence:
How certain you are about the BASE CARD identity.

finish_confidence:
How certain you are about the exact finish/variant.


Return the structured result only.
`;

const RETRY_PROMPT = `
Perform a SECOND careful analysis of this Pokémon card.

The first recognition was incomplete or uncertain.

Concentrate specifically on:


BOTTOM LEFT / BOTTOM CENTER

Look carefully for:

- printed set code
- graphical set symbol
- card number
- set total
- promo number
- subset code


TOP OF CARD

Look for:

- Pokémon/card name
- Japanese text
- Chinese text
- Korean text
- HP
- evolution stage
- type


ARTWORK

Use the artwork itself as an identification signal.

Many Pokémon cards can be identified even when one printed field is difficult to read.


ASIAN CARDS

For Japanese, Chinese and Korean cards:

Do not fail simply because Latin OCR is unavailable.

Use:

- visual artwork recognition
- Asian printed name
- number
- set code/symbol
- HP
- layout
- copyright markings


FOIL / PATTERN

Ignore foil reflections when identifying the base card.

Poké Ball / Great Ball / Master Ball / Reverse Holo / stamped versions should match the SAME base card.


Do not guess unreadable digits.

Return empty strings for fields that truly cannot be read.

Return the structured result only.
`;

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanResult(result) {
  const output = {
    found: Boolean(result?.found),

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
      cleanText(result?.set_code).toUpperCase(),

    card_number:
      cleanText(result?.card_number),

    set_total:
      cleanText(result?.set_total),

    collector_number:
      cleanText(result?.collector_number),

    finish:
      FINISHES.includes(result?.finish)
        ? result.finish
        : "Unknown",

    identity_confidence:
      Math.max(
        0,
        Math.min(
          1,
          Number(result?.identity_confidence || 0)
        )
      ),

    finish_confidence:
      Math.max(
        0,
        Math.min(
          1,
          Number(result?.finish_confidence || 0)
        )
      ),

    notes:
      cleanText(result?.notes).slice(0, 700)
  };


  /*
   * Wanneer kaartnummer en totaal wel bekend zijn,
   * maar collector_number leeg is:
   */

  if (
    !output.collector_number &&
    output.card_number &&
    output.set_total
  ) {
    output.collector_number =
      `${output.card_number}/${output.set_total}`;
  }


  return output;
}


/*
 * Leest het Structured Output resultaat.
 */

function parseStructuredResponse(response) {

  const text =
    cleanText(response?.output_text);

  if (!text) {

    throw new Error(
      "AI returned an empty structured response"
    );
  }


  try {

    return cleanResult(
      JSON.parse(text)
    );

  } catch (error) {

    console.error(
      "Structured output parse failure:",
      text.slice(0, 1000)
    );

    throw new Error(
      "AI returned invalid structured JSON"
    );
  }
}


/*
 * Eén AI-scan uitvoeren.
 */

async function runScan(
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


      /*
       * STRUCTURED OUTPUT
       *
       * Hierdoor moet de AI altijd
       * hetzelfde JSON-schema gebruiken.
       */

      text: {

        format: {

          type: "json_schema",

          name:
            "pokemon_card_scan",

          description:
            "Structured identification of one Pokémon TCG card from an image.",

          strict: true,

          schema:
            CARD_SCHEMA

        }

      },


      max_output_tokens: 1000

    });


  return parseStructuredResponse(
    response
  );
}


/*
 * Bepalen of een tweede analyse nodig is.
 */

function shouldRetry(result) {

  if (!result.found) {
    return true;
  }


  if (
    result.identity_confidence < 0.62
  ) {
    return true;
  }


  const usefulIdentity =
    Boolean(

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


  return !usefulIdentity;
}


/*
 * Vergelijk eerste en tweede AI-resultaat.
 */

function chooseBetter(
  first,
  second
) {

  const score = (result) => {

    let value =
      result.identity_confidence * 100;


    if (result.card_name) {
      value += 15;
    }

    if (result.card_number) {
      value += 18;
    }

    if (result.set_total) {
      value += 10;
    }

    if (result.set_code) {
      value += 14;
    }

    if (result.set_name) {
      value += 8;
    }

    if (result.collector_number) {
      value += 10;
    }

    if (
      result.language !== "Unknown"
    ) {
      value += 4;
    }


    return value;
  };


  return (
    score(second) >
    score(first)
  )
    ? second
    : first;
}


/*
 * VERCEL API HANDLER
 */

export default async function handler(
  req,
  res
) {


  /*
   * OPTIONS
   */

  if (req.method === "OPTIONS") {

    res.setHeader(
      "Allow",
      "POST, OPTIONS"
    );

    return res
      .status(204)
      .end();
  }


  /*
   * Alleen POST toestaan.
   */

  if (req.method !== "POST") {

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


  /*
   * API-key controleren.
   */

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


  /*
   * Afbeelding ophalen.
   */

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


  /*
   * Bestandsgrootte beschermen.
   */

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


    /*
     * OpenAI client.
     */

    const client =
      new OpenAI({

        apiKey:
          process.env.OPENAI_API_KEY

      });


    /*
     * EERSTE ANALYSE
     */

    let result =
      await runScan(

        client,

        image,

        BASE_PROMPT

      );


    /*
     * Indien nodig automatisch
     * een tweede analyse.
     */

    if (
      shouldRetry(result)
    ) {

      try {

        const retry =
          await runScan(

            client,

            image,

            `${BASE_PROMPT}

${RETRY_PROMPT}`

          );


        result =
          chooseBetter(
            result,
            retry
          );


      } catch (
        retryError
      ) {

        /*
         * Als alleen poging 2 mislukt,
         * gebruiken we poging 1.
         */

        console.warn(

          "Second scan pass failed; using first structured result:",

          retryError

        );
      }

    }


    /*
     * Geen caching.
     */

    res.setHeader(
      "Cache-Control",
      "no-store"
    );


    /*
     * Resultaat teruggeven.
     */

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


    /*
     * Begrijpelijke foutmeldingen.
     */

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

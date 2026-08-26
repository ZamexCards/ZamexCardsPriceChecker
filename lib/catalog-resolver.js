
const TCGDEX_BASE = "https://api.tcgdex.net/v2";

const LANG_MAP = {
  English: "en",
  Japanese: "ja",
  "Traditional Chinese": "zh-tw"
};

function clean(v) {
  return String(v ?? "").trim();
}

function norm(v) {
  return clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function num(v) {
  const m = clean(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function imageUrl(base) {
  const s = clean(base);
  if (!s) return "";
  if (/\.(png|jpe?g|webp)(\?|$)/i.test(s)) return s;
  return `${s}/high.webp`;
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}

function langCode(language) {
  return LANG_MAP[clean(language)] || "";
}

function exactName(a, b) {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && x === y;
}

function attackNames(card) {
  return Array.isArray(card?.attacks)
    ? card.attacks.map(a => norm(a?.name)).filter(Boolean)
    : [];
}

function featureScore(ai, card) {
  let score = 0;

  if (exactName(ai.card_name, card?.name)) score += 35;

  const aiHp = num(ai.hp);
  const cardHp = num(card?.hp);
  if (aiHp != null && cardHp != null) {
    if (aiHp === cardHp) score += 18;
    else score -= 8;
  }

  const aiIllustrator = norm(ai.illustrator);
  const cardIllustrator = norm(card?.illustrator);
  if (aiIllustrator && cardIllustrator) {
    if (aiIllustrator === cardIllustrator) score += 28;
    else if (aiIllustrator.includes(cardIllustrator) || cardIllustrator.includes(aiIllustrator)) score += 18;
  }

  const aiAttacks = Array.isArray(ai.attack_names)
    ? ai.attack_names.map(norm).filter(Boolean)
    : [];
  const cAttacks = attackNames(card);
  for (const a of aiAttacks) {
    if (cAttacks.includes(a)) score += 24;
  }

  const aiMark = norm(ai.regulation_mark);
  const cMark = norm(card?.regulationMark || card?.regulation_mark);
  if (aiMark && cMark && aiMark === cMark) score += 8;

  const aiNum = num(ai.card_number);
  const cNum = num(card?.localId || card?.number);
  if (aiNum != null && cNum != null) {
    if (aiNum === cNum) score += 14;
    else if (Math.abs(aiNum - cNum) === 1) score += 2;
  }

  const aiTotal = num(ai.set_total);
  const cTotal = num(card?.set?.cardCount?.official);
  if (aiTotal != null && cTotal != null && aiTotal === cTotal) score += 10;

  return score;
}

async function listByNameAndHp(lang, ai) {
  const name = clean(ai.card_name);
  if (!name) return [];

  const qs = new URLSearchParams();
  qs.set("name", `eq:${name}`);
  if (clean(ai.hp)) qs.set("hp", `eq:${clean(ai.hp)}`);
  qs.set("pagination:itemsPerPage", "250");

  try {
    const data = await fetchJson(`${TCGDEX_BASE}/${lang}/cards?${qs.toString()}`);
    if (Array.isArray(data) && data.length) return data;
  } catch (e) {}

  const qs2 = new URLSearchParams();
  qs2.set("name", `eq:${name}`);
  qs2.set("pagination:itemsPerPage", "250");
  const data2 = await fetchJson(`${TCGDEX_BASE}/${lang}/cards?${qs2.toString()}`);
  return Array.isArray(data2) ? data2 : [];
}

async function fetchDetails(lang, briefs, ai) {
  // Preserve likely matches first, but never trust scanner set as a hard filter.
  const aiNum = num(ai.card_number);
  const ordered = [...briefs].sort((a, b) => {
    const an = num(a.localId);
    const bn = num(b.localId);
    const ad = aiNum == null || an == null ? 999 : Math.abs(an - aiNum);
    const bd = aiNum == null || bn == null ? 999 : Math.abs(bn - aiNum);
    return ad - bd;
  });

  // With HP filtering this is normally small. Cap only to protect runtime.
  const chosen = ordered.slice(0, 40);
  const results = await Promise.allSettled(
    chosen.map(c => fetchJson(`${TCGDEX_BASE}/${lang}/cards/${encodeURIComponent(c.id)}`, 7000))
  );
  return results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => r.value);
}

const CHOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    match_index: { type: "integer", minimum: 0, maximum: 8 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["match_index", "confidence", "reason"]
};

async function visionChoose(client, model, imageDataUrl, ranked) {
  const top = ranked.slice(0, 8);
  if (!top.length) return null;

  const content = [
    {
      type: "input_text",
      text:
        "The FIRST image is the photographed Pokemon TCG card. " +
        "After it are numbered catalog candidate images. " +
        "Choose the exact same BASE CARD by artwork, HP, attacks, illustrator, frame/layout, " +
        "collector-number area and regulation mark. Ignore foil reflections and special reverse-holo patterns. " +
        "If none is the same base card, return match_index 0."
    },
    { type: "input_image", image_url: imageDataUrl, detail: "high" }
  ];

  top.forEach((x, i) => {
    content.push({
      type: "input_text",
      text:
        `Candidate ${i + 1}: ${clean(x.card?.name)} | ` +
        `${clean(x.card?.set?.name)} | localId ${clean(x.card?.localId)} | ` +
        `HP ${clean(x.card?.hp)} | illustrator ${clean(x.card?.illustrator)} | ` +
        `attacks ${(x.card?.attacks || []).map(a => clean(a?.name)).join(", ")}`
    });
    const img = imageUrl(x.card?.image);
    if (img) content.push({ type: "input_image", image_url: img, detail: "low" });
  });

  const response = await client.responses.create({
    model,
    temperature: 0,
    max_output_tokens: 250,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "catalog_card_choice",
        strict: true,
        schema: CHOICE_SCHEMA
      }
    }
  });

  const txt = clean(response.output_text);
  if (!txt) return null;
  const parsed = JSON.parse(txt);
  if (!parsed.match_index || parsed.match_index < 1 || parsed.match_index > top.length) return null;

  return {
    card: top[parsed.match_index - 1].card,
    confidence: Number(parsed.confidence || 0),
    reason: clean(parsed.reason)
  };
}

async function fetchSetDetail(lang, card) {
  const setId = clean(card?.set?.id);
  if (!setId) return card?.set || null;
  try {
    return await fetchJson(`${TCGDEX_BASE}/${lang}/sets/${encodeURIComponent(setId)}`, 6000);
  } catch (e) {
    return card?.set || null;
  }
}

function officialSetCode(setDetail) {
  return clean(
    setDetail?.abbreviations?.official ||
    setDetail?.tcgOnline ||
    setDetail?.abbreviation ||
    setDetail?.id ||
    ""
  );
}

function padCollector(localId, officialTotal) {
  const id = clean(localId);
  const totalNum = num(officialTotal);
  if (!id) return { cardNumber: "", setTotal: "", collector: "" };

  let total = totalNum == null ? clean(officialTotal) : String(totalNum);
  let number = id;

  // Modern printed fractions are commonly 3 digits; preserve a wider localId if present.
  const numericId = /^\d+$/.test(id);
  if (numericId) {
    const width = Math.max(id.length, total.length >= 3 ? total.length : 3);
    number = String(Number(id)).padStart(width, "0");
    if (total) total = String(totalNum ?? total).padStart(width, "0");
  }

  return {
    cardNumber: number,
    setTotal: total,
    collector: total ? `${number}/${total}` : number
  };
}

export async function resolveCatalogCard({ imageDataUrl, aiCard, client, model }) {
  const lang = langCode(aiCard?.language);
  if (!lang || !clean(aiCard?.card_name)) {
    return { resolved: false, reason: "language_or_name_not_supported" };
  }

  let briefs;
  try {
    briefs = await listByNameAndHp(lang, aiCard);
  } catch (e) {
    return { resolved: false, reason: `catalog_list_failed: ${clean(e?.message)}` };
  }

  if (!briefs.length) return { resolved: false, reason: "no_name_candidates" };

  let details;
  try {
    details = await fetchDetails(lang, briefs, aiCard);
  } catch (e) {
    return { resolved: false, reason: `catalog_detail_failed: ${clean(e?.message)}` };
  }

  if (!details.length) return { resolved: false, reason: "no_candidate_details" };

  const ranked = details
    .map(card => ({ card, score: featureScore(aiCard, card) }))
    .sort((a, b) => b.score - a.score);

  let selected = null;
  let confidence = 0;
  let method = "";

  const top = ranked[0];
  const second = ranked[1];

  // Strong structured evidence: use catalog directly.
  if (top && top.score >= 70 && (!second || top.score - second.score >= 18)) {
    selected = top.card;
    confidence = Math.min(0.99, 0.80 + Math.min(0.19, (top.score - 70) / 100));
    method = "catalog_features";
  } else {
    try {
      const choice = await visionChoose(client, model, imageDataUrl, ranked);
      if (choice && choice.confidence >= 0.72) {
        selected = choice.card;
        confidence = choice.confidence;
        method = "catalog_visual_match";
      }
    } catch (e) {
      // Do not force a bad catalog match if the visual tie-breaker fails.
    }
  }

  if (!selected) {
    return {
      resolved: false,
      reason: "ambiguous_catalog_candidates",
      candidates: ranked.slice(0, 6).map(x => ({
        id: x.card?.id,
        name: x.card?.name,
        set: x.card?.set?.name,
        localId: x.card?.localId,
        image: x.card?.image,
        score: x.score
      }))
    };
  }

  const setDetail = await fetchSetDetail(lang, selected);
  const officialTotal =
    setDetail?.cardCount?.official ??
    selected?.set?.cardCount?.official ??
    "";

  const collector = padCollector(selected?.localId, officialTotal);

  return {
    resolved: true,
    method,
    confidence,
    catalog_id: clean(selected?.id),
    card_name: clean(selected?.name) || clean(aiCard.card_name),
    set_name: clean(setDetail?.name || selected?.set?.name),
    set_code: officialSetCode(setDetail),
    card_number: collector.cardNumber,
    set_total: collector.setTotal,
    collector_number: collector.collector,
    image: imageUrl(selected?.image),
    release_date: clean(setDetail?.releaseDate || selected?.set?.releaseDate)
  };
}

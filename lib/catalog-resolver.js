
const TCGDEX_BASE = "https://api.tcgdex.net/v2";

const LANG_MAP = {
  English: "en",
  Japanese: "ja",
  "Simplified Chinese": "zh-cn",
  "Traditional Chinese": "zh-tw",
  Korean: "ko"
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

function isAsianLanguage(language) {
  return [
    "Japanese",
    "Simplified Chinese",
    "Traditional Chinese",
    "Korean"
  ].includes(clean(language));
}

function sameCollector(ai, card) {
  const aiNum = num(ai?.card_number);
  const aiTotal = num(ai?.set_total);
  const cardNum = num(card?.localId || card?.number);
  const cardTotal = num(card?.set?.cardCount?.official);

  if (aiNum == null || aiTotal == null || cardNum == null || cardTotal == null) {
    return false;
  }

  return aiNum === cardNum && aiTotal === cardTotal;
}

function attackNames(card) {
  return Array.isArray(card?.attacks)
    ? card.attacks.map(a => norm(a?.name)).filter(Boolean)
    : [];
}

function featureScore(ai, card) {
  let score = 0;

  // English canonical name or printed/localized name may match.
  if (exactName(ai.card_name, card?.name)) score += 35;
  if (exactName(ai.printed_name, card?.name)) score += 40;

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
    else if (
      aiIllustrator.includes(cardIllustrator) ||
      cardIllustrator.includes(aiIllustrator)
    ) score += 18;
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
    if (aiNum === cNum) score += 24;
    else if (Math.abs(aiNum - cNum) === 1) score += 2;
  }

  const aiTotal = num(ai.set_total);
  const cTotal = num(card?.set?.cardCount?.official);
  if (aiTotal != null && cTotal != null) {
    if (aiTotal === cTotal) score += 22;
    else score -= 6;
  }

  return score;
}

function dedupeBriefs(items) {
  const map = new Map();
  for (const c of items || []) {
    const id = clean(c?.id);
    if (id && !map.has(id)) map.set(id, c);
  }
  return [...map.values()];
}

async function queryCards(lang, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== "" && v != null) qs.set(k, String(v));
  }
  qs.set("pagination:itemsPerPage", "250");
  const data = await fetchJson(`${TCGDEX_BASE}/${lang}/cards?${qs.toString()}`);
  return Array.isArray(data) ? data : [];
}

async function listCandidates(lang, ai) {
  const out = [];
  const language = clean(ai?.language);
  const canonical = clean(ai?.card_name);
  const printed = clean(ai?.printed_name);
  const hp = clean(ai?.hp);
  const localId = clean(ai?.card_number);

  // 1) For Asian cards, the localized TCGdex catalog normally uses the
  // printed Japanese/Chinese/Korean name, NOT the English canonical name.
  if (isAsianLanguage(language) && printed) {
    try {
      out.push(...await queryCards(lang, {
        name: `eq:${printed}`,
        ...(hp ? { hp: `eq:${hp}` } : {})
      }));
    } catch (e) {}

    try {
      out.push(...await queryCards(lang, { name: `eq:${printed}` }));
    } catch (e) {}
  }

  // 2) Canonical English / normal exact name path.
  if (canonical) {
    try {
      out.push(...await queryCards(lang, {
        name: `eq:${canonical}`,
        ...(hp ? { hp: `eq:${hp}` } : {})
      }));
    } catch (e) {}

    try {
      out.push(...await queryCards(lang, { name: `eq:${canonical}` }));
    } catch (e) {}
  }

  // 3) Collector-number fallback.
  // This is especially important for Asian cards and for English names
  // whose punctuation differs between AI output and the catalog.
  if (localId) {
    const variants = new Set([
      localId,
      String(num(localId) ?? ""),
      String(num(localId) ?? "").padStart(2, "0"),
      String(num(localId) ?? "").padStart(3, "0")
    ]);
    variants.delete("");

    for (const id of variants) {
      try {
        out.push(...await queryCards(lang, { localId: `eq:${id}` }));
      } catch (e) {}
    }
  }

  return dedupeBriefs(out);
}

async function fetchDetails(lang, briefs, ai) {
  const aiNum = num(ai.card_number);

  const ordered = [...briefs].sort((a, b) => {
    const an = num(a.localId);
    const bn = num(b.localId);
    const ad = aiNum == null || an == null ? 999 : Math.abs(an - aiNum);
    const bd = aiNum == null || bn == null ? 999 : Math.abs(bn - aiNum);
    return ad - bd;
  });

  // Slightly wider candidate window because regional catalogs can contain
  // many cards with the same local collector number.
  const chosen = ordered.slice(0, 70);

  const results = [];
  const concurrency = 10;
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= chosen.length) return;
      const c = chosen[i];
      try {
        const detail = await fetchJson(
          `${TCGDEX_BASE}/${lang}/cards/${encodeURIComponent(c.id)}`,
          7000
        );
        if (detail) results.push(detail);
      } catch (e) {}
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, chosen.length) }, worker)
  );

  return results;
}

const CHOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    match_index: { type: "integer", minimum: 0, maximum: 10 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["match_index", "confidence", "reason"]
};

async function visionChoose(client, model, imageDataUrl, ranked) {
  const top = ranked.slice(0, 10);
  if (!top.length) return null;

  const content = [
    {
      type: "input_text",
      text:
        "The FIRST image is the photographed Pokemon TCG card. " +
        "After it are numbered catalog candidate images. " +
        "Choose the exact same BASE CARD by artwork, HP, attacks, illustrator, frame/layout, " +
        "collector-number area, language printing and regulation mark. " +
        "The photographed card may be English, Japanese, Simplified Chinese, Traditional Chinese or Korean. " +
        "Ignore foil reflections and special reverse-holo patterns. " +
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
    if (img) content.push({
      type: "input_image",
      image_url: img,
      detail: "low"
    });
  });

  const response = await client.responses.create({
    model,
    temperature: 0,
    max_output_tokens: 300,
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
  if (
    !parsed.match_index ||
    parsed.match_index < 1 ||
    parsed.match_index > top.length
  ) return null;

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
    return await fetchJson(
      `${TCGDEX_BASE}/${lang}/sets/${encodeURIComponent(setId)}`,
      6000
    );
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

function candidateDto(x) {
  return {
    id: x.card?.id,
    name: x.card?.name,
    set: x.card?.set?.name,
    setId: x.card?.set?.id,
    localId: x.card?.localId,
    image: imageUrl(x.card?.image),
    rarity: x.card?.rarity || "",
    hp: x.card?.hp || "",
    officialTotal: x.card?.set?.cardCount?.official || "",
    score: x.score
  };
}

export async function resolveCatalogCard({
  imageDataUrl,
  aiCard,
  client,
  model
}) {
  const lang = langCode(aiCard?.language);

  if (!lang) {
    return {
      resolved: false,
      reason: `language_not_supported:${clean(aiCard?.language)}`
    };
  }

  // For regional cards, printed_name can be more useful than card_name.
  if (!clean(aiCard?.card_name) && !clean(aiCard?.printed_name)) {
    return { resolved: false, reason: "name_not_available" };
  }

  let briefs = [];
  try {
    briefs = await listCandidates(lang, aiCard);
  } catch (e) {
    return {
      resolved: false,
      reason: `catalog_list_failed:${clean(e?.message)}`
    };
  }

  if (!briefs.length) {
    return {
      resolved: false,
      reason: "no_catalog_candidates"
    };
  }

  let details = [];
  try {
    details = await fetchDetails(lang, briefs, aiCard);
  } catch (e) {
    return {
      resolved: false,
      reason: `catalog_detail_failed:${clean(e?.message)}`
    };
  }

  if (!details.length) {
    return {
      resolved: false,
      reason: "no_candidate_details"
    };
  }

  const ranked = details
    .map(card => ({ card, score: featureScore(aiCard, card) }))
    .sort((a, b) => b.score - a.score);

  const hasCompleteCollector =
    num(aiCard?.card_number) != null &&
    num(aiCard?.set_total) != null;

  let selected = null;
  let confidence = 0;
  let method = "";

  if (hasCompleteCollector) {
    // The collector fraction is the hard identity anchor.
    // Do NOT require the English AI name to equal a Japanese/Chinese/Korean catalog name.
    const exactCollectorMatches = ranked.filter(x =>
      sameCollector(aiCard, x.card)
    );

    if (exactCollectorMatches.length === 1) {
      selected = exactCollectorMatches[0].card;
      confidence = 0.995;
      method = "exact_collector";
    } else if (exactCollectorMatches.length > 1) {
      // Prefer an exact local/canonical name if that makes the answer unique.
      const named = exactCollectorMatches.filter(x =>
        exactName(aiCard.card_name, x.card?.name) ||
        exactName(aiCard.printed_name, x.card?.name)
      );

      if (named.length === 1) {
        selected = named[0].card;
        confidence = 0.995;
        method = "exact_collector_and_name";
      } else {
        try {
          const choice = await visionChoose(
            client,
            model,
            imageDataUrl,
            named.length ? named : exactCollectorMatches
          );

          if (choice && choice.confidence >= 0.82) {
            selected = choice.card;
            confidence = choice.confidence;
            method = "exact_collector_visual_tiebreak";
          }
        } catch (e) {}
      }
    }

    if (!selected) {
      return {
        resolved: false,
        reason: exactCollectorMatches.length
          ? "multiple_exact_collector_candidates"
          : "collector_not_found_in_language_catalog",
        candidates: (
          exactCollectorMatches.length ? exactCollectorMatches : ranked
        ).slice(0, 30).map(candidateDto)
      };
    }
  } else {
    // If collector fraction isn't trustworthy, allow a very strong visual match
    // but keep the threshold high to avoid forcing a wrong printing.
    try {
      const choice = await visionChoose(
        client,
        model,
        imageDataUrl,
        ranked.slice(0, 10)
      );

      if (choice && choice.confidence >= 0.94) {
        selected = choice.card;
        confidence = choice.confidence;
        method = "high_confidence_visual_without_collector";
      }
    } catch (e) {}

    if (!selected) {
      return {
        resolved: false,
        reason: "collector_unverified_manual_choice_required",
        candidates: ranked.slice(0, 30).map(candidateDto)
      };
    }
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
    card_name:
      clean(aiCard?.card_name) ||
      clean(selected?.name) ||
      clean(aiCard?.printed_name),
    printed_name: clean(aiCard?.printed_name),
    language: clean(aiCard?.language),
    set_name: clean(setDetail?.name || selected?.set?.name),
    set_code: officialSetCode(setDetail),
    card_number: collector.cardNumber,
    set_total: collector.setTotal,
    collector_number: collector.collector,
    image: imageUrl(selected?.image),
    rarity: clean(selected?.rarity),
    release_date: clean(
      setDetail?.releaseDate ||
      selected?.set?.releaseDate
    )
  };
}

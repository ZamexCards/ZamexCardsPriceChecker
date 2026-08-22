const demoPriceCache = new Map();

function seededNumber(seed, min, max) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const value = (h >>> 0) / 4294967295;
  return min + value * (max - min);
}

function makePrice(card) {
  const key = `${card.id}-${card.name}-${card.number}`;
  if (demoPriceCache.has(key)) return demoPriceCache.get(key);
  const from = seededNumber(key, 1.25, 89.95);
  const trend = from * seededNumber(key + 'trend', 0.88, 1.32);
  const avg30 = from * seededNumber(key + 'avg30', 0.95, 1.45);
  const psa10 = card.rarity && /rare|illustration|secret|ultra|special|rainbow|hyper/i.test(card.rarity)
    ? avg30 * seededNumber(key + 'psa', 5, 22)
    : null;
  const movement = seededNumber(key + 'move', -12, 14);
  const sellers = ['CardsNL', 'TCG Holland', 'Zamex Demo Seller', 'Dutch PokéDeals', 'Rotterdam Cards'];
  const seller = sellers[Math.floor(seededNumber(key + 'seller', 0, sellers.length - 0.01))];
  const history = Array.from({ length: 30 }, (_, i) => {
    const wave = Math.sin(i / 2.8) * 0.08;
    const drift = (i - 15) * (movement / 2200);
    return Math.max(0.2, trend * (1 + wave + drift + seededNumber(key + i, -0.04, 0.04)));
  });
  const price = {
    fromPrice: Number(from.toFixed(2)),
    trendPrice: Number(trend.toFixed(2)),
    average30Days: Number(avg30.toFixed(2)),
    psa10Price: psa10 ? Number(psa10.toFixed(2)) : null,
    movement: Number(movement.toFixed(1)),
    cheapestDutchSeller: seller,
    currency: 'EUR',
    history: history.map(v => Number(v.toFixed(2)))
  };
  demoPriceCache.set(key, price);
  return price;
}

const SET_CODE_TO_ID = {
  ASR: 'swsh10',
  ASG: 'swsh10', // veelgebruikte typefout voor ASR
  BRS: 'swsh9',
  FST: 'swsh8',
  EVS: 'swsh7',
  CRE: 'swsh6',
  BST: 'swsh5',
  SHF: 'swsh45',
  VIV: 'swsh4',
  CPA: 'swsh35',
  DAA: 'swsh3',
  RCL: 'swsh2',
  SSH: 'swsh1',
  LOR: 'swsh11',
  SIT: 'swsh12',
  CRZ: 'swsh12pt5',
  PAL: 'sv2',
  OBF: 'sv3',
  MEW: 'sv3pt5',
  PAR: 'sv4',
  PAF: 'sv4pt5',
  TEF: 'sv5',
  TWM: 'sv6',
  SFA: 'sv6pt5',
  SCR: 'sv7',
  SSP: 'sv8',
  PRE: 'sv8pt5',
  MEP: 'mep'
};

function clean(value = '') {
  return value.trim().replace(/[^a-zA-Z0-9\s'.:/-]/g, '');
}

function splitInput(...values) {
  return values.filter(Boolean).join(' ').trim().split(/\s+/).filter(Boolean);
}

function parseSearch(rawName, rawSet, rawNumber) {
  const tokens = splitInput(rawName, rawSet, rawNumber);
  let setCode = '';
  let number = '';
  const nameTokens = [];

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (!setCode && SET_CODE_TO_ID[upper]) {
      setCode = upper;
      continue;
    }
    if (!number && /^(?:TG|GG|SV)?\d{1,3}[A-Z]?$/i.test(token)) {
      number = upper;
      continue;
    }
    nameTokens.push(token);
  }

  // Explicit fields take precedence, while still allowing combined searches in any field.
  const explicitSet = clean(rawSet).toUpperCase();
  if (SET_CODE_TO_ID[explicitSet]) setCode = explicitSet;
  const explicitNumber = clean(rawNumber).toUpperCase();
  if (explicitNumber && /^(?:TG|GG|SV)?\d{1,3}[A-Z]?$/i.test(explicitNumber)) number = explicitNumber;

  return {
    name: clean(nameTokens.join(' ')),
    setCode,
    setId: SET_CODE_TO_ID[setCode] || '',
    number: clean(number)
  };
}

async function apiQuery(q, pageSize = 40) {
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&orderBy=-set.releaseDate,number&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Pokemon TCG API error ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

const TCGDEX_SET_IDS = {
  MEP: 'mep'
};

function normalizeCardNumber(value = '') {
  return String(value).trim().replace(/^0+(?=\d)/, '').toUpperCase();
}

function tcgdexImageVariants(base = '') {
  if (!base) return [];
  return [
    `${base}/low.webp`,
    `${base}/high.webp`,
    `${base}/low.png`,
    `${base}/high.png`
  ];
}

async function tcgdexGetJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function findTcgdexCard(name, number, setCode = '') {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (number) params.set('localId', number);
  params.set('pagination:page', '1');
  params.set('pagination:itemsPerPage', '40');

  const list = await tcgdexGetJson(`https://api.tcgdex.net/v2/en/cards?${params}`);
  if (!Array.isArray(list) || !list.length) return null;

  const expectedSetId = TCGDEX_SET_IDS[setCode] || '';
  const wantedNumber = normalizeCardNumber(number);
  const wantedName = (name || '').toLowerCase();

  let candidates = list.filter(card => {
    const cardNumber = normalizeCardNumber(card.localId || '');
    const numberOk = !wantedNumber || cardNumber === wantedNumber;
    const nameOk = !wantedName || (card.name || '').toLowerCase().includes(wantedName);
    const setOk = !expectedSetId || (card.id || '').toLowerCase().startsWith(`${expectedSetId.toLowerCase()}-`);
    return numberOk && nameOk && setOk;
  });

  if (!candidates.length && expectedSetId && number) {
    const direct = await tcgdexGetJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(expectedSetId + '-' + String(number).padStart(3, '0'))}`);
    if (direct && direct.id) return direct;
  }

  if (!candidates.length) return null;
  const brief = candidates[0];
  return (await tcgdexGetJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(brief.id)}`)) || brief;
}

async function enrichCardImage(card, setCode = '') {
  const primary = [card.images?.small, card.images?.large].filter(Boolean);
  if (primary.length >= 2) return { primary, tcgdex: [] };
  const tcg = await findTcgdexCard(card.name || '', card.number || '', setCode);
  return { primary, tcgdex: tcgdexImageVariants(tcg?.image || '') };
}

function toResult(card, extraImages = []) {
  const images = [card.images?.small, card.images?.large, ...extraImages].filter(Boolean);
  return {
    id: card.id,
    name: card.name,
    image: images[0] || '',
    imageCandidates: [...new Set(images)],
    set: card.set?.name || '',
    series: card.set?.series || '',
    setLogo: card.set?.images?.logo || '',
    number: card.number || '',
    rarity: card.rarity || 'Onbekend',
    types: card.types || [],
    releaseDate: card.set?.releaseDate || '',
    prices: makePrice(card)
  };
}

function tcgdexToResult(card) {
  const pseudo = {
    id: `tcgdex-${card.id}`,
    name: card.name || 'Onbekende kaart',
    number: card.localId || '',
    rarity: card.rarity || 'Onbekend'
  };
  const setName = card.set?.name || card.set?.id || 'Nieuwe / promo set';
  const seriesName = card.set?.serie?.name || card.set?.series?.name || card.serie?.name || 'Pokémon TCG';
  const images = tcgdexImageVariants(card.image || '');
  return {
    id: pseudo.id,
    name: pseudo.name,
    image: images[0] || '',
    imageCandidates: images,
    set: setName,
    series: seriesName,
    setLogo: '',
    number: pseudo.number,
    rarity: pseudo.rarity,
    types: card.types || [],
    releaseDate: card.set?.releaseDate || '',
    prices: makePrice(pseudo)
  };
}

function matchesRarity(card, rarity) {
  return !rarity || (card.rarity || '').toLowerCase() === rarity.toLowerCase();
}

async function fetchCards(rawName, rawSet, rawNumber, rarity) {
  const parsed = parseSearch(rawName, rawSet, rawNumber);
  const attempts = [];

  // Most precise first. Using set.id makes abbreviations such as ASR/BRS reliable.
  if (parsed.setId && parsed.number && parsed.name) attempts.push(`set.id:${parsed.setId} number:${parsed.number} name:${parsed.name}*`);
  if (parsed.setId && parsed.number) attempts.push(`set.id:${parsed.setId} number:${parsed.number}`);
  if (parsed.setId && parsed.name) attempts.push(`set.id:${parsed.setId} name:${parsed.name}*`);
  if (parsed.number && parsed.name) attempts.push(`number:${parsed.number} name:${parsed.name}*`);
  if (parsed.number) attempts.push(`number:${parsed.number}`);
  if (parsed.name) attempts.push(`name:${parsed.name}*`);
  if (parsed.setId) attempts.push(`set.id:${parsed.setId}`);
  if (!attempts.length) attempts.push('name:pikachu*');

  const seen = new Map();
  for (const q of attempts) {
    const cards = await apiQuery(q);
    for (const card of cards) {
      // If a set code was supplied, never mix in another set during broader fallbacks.
      if (parsed.setId && card.set?.id !== parsed.setId) continue;
      if (parsed.number && String(card.number).toUpperCase() !== parsed.number.toUpperCase()) continue;
      if (parsed.name && !card.name.toLowerCase().includes(parsed.name.toLowerCase())) continue;
      if (!matchesRarity(card, rarity)) continue;
      seen.set(card.id, card);
    }
    if (seen.size >= 18) break;
  }

  const pokemonCards = [...seen.values()].slice(0, 18);

  // Enrich cards whose primary provider is missing artwork. TCGdex is a second image source.
  const enriched = await Promise.all(pokemonCards.map(async card => {
    if (card.images?.small && card.images?.large) return toResult(card);
    const extra = await enrichCardImage(card, parsed.setCode);
    return toResult(card, extra.tcgdex);
  }));

  // If the primary card database does not know a very new/promo card yet,
  // use TCGdex as a secondary card source as well. This is especially useful
  // for new promo series such as MEP.
  if (!enriched.length && (parsed.name || parsed.number)) {
    const tcg = await findTcgdexCard(parsed.name, parsed.number, parsed.setCode);
    if (tcg) return [tcgdexToResult(tcg)];
  }

  return enriched;
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, `https://${req.headers.host}`);
    const query = url.searchParams.get('q') || '';
    const set = url.searchParams.get('set') || '';
    const number = url.searchParams.get('number') || '';
    const rarity = url.searchParams.get('rarity') || '';
    const cards = await fetchCards(query, set, number, rarity);
    res.status(200).json({
      source: 'Kaartgegevens via Pokémon TCG API. Prijzen zijn demo-data totdat officiële prijsbron gekoppeld is.',
      cards
    });
  } catch (error) {
    res.status(500).json({ error: error.message, cards: [] });
  }
}

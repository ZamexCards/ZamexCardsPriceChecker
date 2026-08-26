/*
  ZamexCards Scanner -> Price Checker
  Resolver v3

  Architecture:
  - Scanner UI remains untouched.
  - /api/scan verifies the base card against TCGdex first.
  - This bridge prefers the verified database set + card number.
  - If automatic verification is still ambiguous, the user gets real catalog candidates.
  - No guessed scanner set is ever forced into the Price Checker.
*/
(function () {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const VARIANTS = [
    ["Standard", "Normaal"],
    ["Holo", "Holo"],
    ["Reverse Holo", "Reverse Holo"],
    ["Poké Ball", "Poké Ball"],
    ["Great Ball", "Great Ball"],
    ["Master Ball", "Master Ball"]
  ];

  function clean(v) { return String(v ?? "").trim(); }

  function norm(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function numPart(v) {
    const m = clean(v).match(/[A-Za-z]*0*(\d+)/);
    return m ? String(Number(m[1])) : clean(v).toUpperCase();
  }

  function splitCollector(v) {
    const s = clean(v).replace(/\s+/g, "");
    const m = s.match(/^([^/]+)\/([^/]+)$/);
    return m
      ? { number: clean(m[1]), total: clean(m[2]), full: s }
      : { number: s, total: "", full: s };
  }

  function normalizeVariant(v) {
    const x = clean(v).toLowerCase();
    if (x.includes("master") && x.includes("ball")) return "Master Ball";
    if (x.includes("great") && x.includes("ball")) return "Great Ball";
    if ((x.includes("poke") || x.includes("poké")) && x.includes("ball")) return "Poké Ball";
    if (x.includes("reverse") || x.includes("ball variant")) return "Reverse Holo";
    if (x.includes("holo")) return "Holo";
    return "Standard";
  }

  function ensureVariant(value) {
    const select = $("variant");
    if (!select) return;
    if (![...select.options].some(o => o.value === value)) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = value;
      select.appendChild(o);
    }
  }

  function cardSetCode(card) {
    return clean(
      card?.setCode ||
      card?.ptcgoCode ||
      card?.set?.abbreviations?.official ||
      card?.set?.tcgOnline ||
      card?.setId ||
      ""
    );
  }

  function cardSetTotal(card) {
    try {
      if (typeof zcSetTotalFromCard === "function") {
        const x = clean(zcSetTotalFromCard(card));
        if (x) return x;
      }
    } catch (e) {}

    const values = [
      card?.printedTotal,
      card?.setTotal,
      card?.officialTotal,
      card?.set?.cardCount?.official,
      card?.set?.cardCount?.total
    ];
    for (const v of values) {
      const m = clean(v).match(/\d+/);
      if (m) return m[0];
    }
    return "";
  }

  function sameName(name, card) {
    const a = norm(name);
    const b = norm(card?.name);
    return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
  }

  function sameNumber(number, card) {
    return numPart(number) === numPart(card?.number || card?.localId || card?.printedNumber);
  }

  function sameTotal(total, card) {
    if (!clean(total)) return true;
    const ct = cardSetTotal(card);
    return !!ct && numPart(total) === numPart(ct);
  }

  function scanPayload() {
    const p = new URLSearchParams(location.search);
    return {
      enabled: p.get("zcscan") === "1",
      name: clean(p.get("name")),
      printed: clean(p.get("printed")),
      set: clean(p.get("set")),
      number: clean(p.get("number")),
      collector: clean(p.get("collector")) || clean(p.get("number")),
      language: clean(p.get("language")),
      finish: clean(p.get("finish")) || clean(p.get("variant")),
      confidence: clean(p.get("confidence"))
    };
  }

  function injectStyle() {
    if ($("zcResolverStyle")) return;
    const s = document.createElement("style");
    s.id = "zcResolverStyle";
    s.textContent = `
      .zc-resolver{margin:14px 0;padding:16px;border:1px solid #2fcf70;border-radius:16px;background:linear-gradient(180deg,#082b50,#061f3d);color:#fff}
      .zc-resolver.warn{border-color:#e8ad44}
      .zc-resolver.bad{border-color:#ff6b6b}
      .zc-resolver h3{margin:0 0 8px;font-size:20px}
      .zc-resolver p{margin:0;color:#c0d5e4;line-height:1.5}
      .zc-meta{margin-top:10px;padding:10px 12px;border-radius:10px;background:#092442;font-size:13px;line-height:1.55}
      .zc-variant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:13px}
      .zc-variant-btn{border:1px solid #31587b;background:#0a294c;color:#fff;border-radius:11px;padding:12px 8px;font-weight:900;cursor:pointer}
      .zc-variant-btn.active{border-color:#58df67;background:linear-gradient(135deg,#1d7c42,#2ea84b)}
      @media(max-width:600px){.zc-variant-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function box() {
    injectStyle();
    let el = $("zcResolver");
    if (el) return el;
    el = document.createElement("section");
    el.id = "zcResolver";
    el.className = "zc-resolver";
    const detail = $("detailPanel");
    const strip = $("resultsStrip");
    const parent = (strip && strip.parentNode) || (detail && detail.parentNode) || document.body;
    if (detail && detail.parentNode === parent) parent.insertBefore(el, detail);
    else parent.appendChild(el);
    return el;
  }

  function setFields(scan, card) {
    const collector = splitCollector(scan.collector);
    if ($("q")) $("q").value = clean(card?.name) || scan.name;
    if ($("set")) $("set").value = cardSetCode(card) || scan.set || "";
    if ($("number")) $("number").value = clean(card?.number || card?.localId) || collector.number;

    if ($("language") && [...$("language").options].some(o => o.value === scan.language)) {
      $("language").value = scan.language;
    }

    const variant = normalizeVariant(scan.finish);
    ensureVariant(variant);
    if ($("variant")) $("variant").value = variant;
  }

  function variantChooser(scan, card) {
    const el = box();
    const suggested = normalizeVariant(scan.finish);
    const collector = splitCollector(scan.collector);

    el.className = "zc-resolver";
    el.innerHTML = `
      <h3>✅ Kaart uit database bevestigd</h3>
      <p>
        De basiskaart is nu gekoppeld aan één catalogusitem.
        Set en kaartnummer van de database zijn leidend; de oorspronkelijke AI-setgok niet.
      </p>
      <div class="zc-meta">
        Kaart: <strong>${clean(card?.name)}</strong><br>
        Set: <strong>${clean(card?.set || card?.setName) || "databasekaart"}</strong>
        ${cardSetCode(card) ? ` · <strong>${cardSetCode(card)}</strong>` : ""}<br>
        Kaartnummer: <strong>${clean(card?.number || card?.localId || collector.number)}</strong><br>
        Scanner-uitvoering: ${scan.finish || "onbekend"}
      </div>
      <div class="zc-variant-grid">
        ${VARIANTS.map(([value,label]) => `
          <button type="button" class="zc-variant-btn ${value === suggested ? "active" : ""}" data-zc-v="${value}">${label}</button>
        `).join("")}
      </div>
    `;

    el.querySelectorAll("[data-zc-v]").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.zcV;
        ensureVariant(value);
        if ($("variant")) {
          $("variant").value = value;
          $("variant").dispatchEvent(new Event("change", { bubbles: true }));
        }
        el.querySelectorAll("[data-zc-v]").forEach(b => b.classList.toggle("active", b === btn));
        try { if (typeof renderDetail === "function") renderDetail(); } catch (e) {}
      });
    });
  }

  function candidateMessage(scan, cards) {
    const el = box();
    el.className = "zc-resolver warn";
    el.innerHTML = `
      <h3>🔎 Kies de juiste databasekaart</h3>
      <p>
        De automatische controle kon niet veilig tot één kaart komen.
        Daarom worden echte cataloguskaarten getoond. Kies de juiste op afbeelding en set.
      </p>
      <div class="zc-meta">
        AI-hint: ${scan.name || "onbekend"} · ${scan.collector || "nummer onzeker"} · ${scan.set || "set onzeker"}<br>
        Kandidaten: <strong>${cards.length}</strong><br>
        Er wordt bewust geen set gegokt.
      </div>
    `;
  }

  function noCandidates(scan) {
    const el = box();
    el.className = "zc-resolver bad";
    el.innerHTML = `
      <h3>⚠️ Geen veilige catalogusmatch</h3>
      <p>
        Er is niets automatisch geselecteerd. Scan de kaart nogmaals met de volledige kaart in beeld.
      </p>
      <div class="zc-meta">
        Gelezen naam: ${scan.name || "onbekend"}<br>
        Gelezen nummer: ${scan.collector || "onbekend"}
      </div>
    `;
  }

  async function waitForPc() {
    for (let i = 0; i < 100; i++) {
      if (
        typeof zcSearchDirect === "function" &&
        typeof renderStrip === "function" &&
        typeof renderDetail === "function"
      ) return true;
      await sleep(50);
    }
    return false;
  }

  async function search(name, set, number) {
    try {
      let cards = await zcSearchDirect(name || "", set || "", number || "", "");
      if (typeof zcValidateCards === "function") cards = zcValidateCards(cards);
      return Array.isArray(cards) ? cards : [];
    } catch (e) {
      console.error("Scanner resolver search failed", e);
      return [];
    }
  }

  function activateManual(scan) {
    window.ZC_PENDING_SCAN = scan;
    if (window.ZC_SELECT_WRAPPED || typeof selectCard !== "function") return;

    const original = selectCard;
    selectCard = function(i) {
      original(i);
      if (!window.ZC_PENDING_SCAN || !selectedCard) return;
      const pending = window.ZC_PENDING_SCAN;
      setFields(pending, selectedCard);
      variantChooser(pending, selectedCard);
      window.ZC_PENDING_SCAN = null;
      box().scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.ZC_SELECT_WRAPPED = true;
  }

  async function boot() {
    const scan = scanPayload();
    if (!scan.enabled) return;

    window.ZC_LAST_SCANNER_IMPORT = scan;
    history.replaceState({}, document.title, location.pathname + location.hash);

    if (!(await waitForPc())) {
      noCandidates(scan);
      return;
    }

    const collector = splitCollector(scan.collector);

    // 1. Preferred path: backend has catalog-verified set code.
    if (scan.name && scan.set && collector.number) {
      const withSet = await search(scan.name, scan.set, collector.number);
      const exact = withSet.filter(c =>
        sameName(scan.name, c) &&
        sameNumber(collector.number, c)
      );

      if (exact.length === 1) {
        currentCards = exact;
        selectedCard = exact[0];
        setFields(scan, selectedCard);
        renderStrip();
        renderDetail();
        variantChooser(scan, selectedCard);
        box().scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (exact.length > 1) {
        currentCards = exact;
        selectedCard = null;
        renderStrip();
        activateManual(scan);
        candidateMessage(scan, exact);
        box().scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    // 2. Name + number + printed total, without trusting set.
    if (scan.name && collector.number) {
      const byNumber = await search(scan.name, "", collector.number);
      const exactNumber = byNumber.filter(c =>
        sameName(scan.name, c) &&
        sameNumber(collector.number, c) &&
        sameTotal(collector.total, c)
      );

      if (exactNumber.length === 1) {
        currentCards = exactNumber;
        selectedCard = exactNumber[0];
        setFields(scan, selectedCard);
        renderStrip();
        renderDetail();
        variantChooser(scan, selectedCard);
        box().scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (exactNumber.length > 1) {
        currentCards = exactNumber;
        selectedCard = null;
        renderStrip();
        activateManual(scan);
        candidateMessage(scan, exactNumber);
        box().scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    // 3. Safe fallback: throw away guessed set and guessed number; search only by Pokemon name.
    if (scan.name) {
      let all = await search(scan.name, "", "");
      all = all.filter(c => sameName(scan.name, c));

      const seen = new Set();
      all = all.filter(c => {
        const k = `${clean(c?.id)}|${clean(c?.setId || c?.set)}|${clean(c?.number || c?.localId)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 30);

      if (all.length) {
        currentCards = all;
        selectedCard = null;
        renderStrip();
        activateManual(scan);
        candidateMessage(scan, all);
        box().scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    currentCards = [];
    selectedCard = null;
    renderStrip();
    noCandidates(scan);
    box().scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
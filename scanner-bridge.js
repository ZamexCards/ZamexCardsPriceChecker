/*
  ZamexCards Scanner -> Price Checker
  Candidate Resolver v1

  BELANGRIJK:
  - Scanner wordt NIET aangepast.
  - Scanner-setcode is alleen een hint en wordt NIET als harde zoekwaarde gebruikt.
  - De kaartdatabase is leidend.
  - Identiteit wordt bepaald op:
      1) naam
      2) kaartnummer vóór de slash
      3) officieel settotaal ná de slash
  - Pas NA de exacte basiskaartmatch kiest de gebruiker de uitvoering.
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

  function clean(v) {
    return String(v ?? "").trim();
  }

  function norm(v) {
    return clean(v)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function normNumber(v) {
    return clean(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
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

  function databaseSetCode(card) {
    return clean(
      card?.setCode ||
      card?.ptcgoCode ||
      card?.set?.code ||
      card?.setId ||
      ""
    );
  }

  function databaseSetTotal(card) {
    // Gebruik eerst de helper uit de huidige Price Checker.
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

    for (const value of values) {
      const m = clean(value).match(/\d{1,4}/);
      if (m) return m[0];
    }
    return "";
  }

  function exactIdentity(scan, card) {
    const collector = splitCollector(scan.collector);

    const sameName =
      !scan.name ||
      norm(card?.name) === norm(scan.name) ||
      norm(card?.name).includes(norm(scan.name)) ||
      norm(scan.name).includes(norm(card?.name));

    const sameNumber =
      normNumber(card?.number || card?.printedNumber) === normNumber(collector.number);

    const cardTotal = databaseSetTotal(card);
    const sameTotal =
      !!collector.total &&
      !!cardTotal &&
      normNumber(cardTotal) === normNumber(collector.total);

    return sameName && sameNumber && sameTotal;
  }

  function scanPayload() {
    const p = new URLSearchParams(location.search);
    return {
      enabled: p.get("zcscan") === "1",
      name: clean(p.get("name")),
      printed: clean(p.get("printed")),
      scannerSet: clean(p.get("set")),
      number: clean(p.get("number")),
      collector: clean(p.get("collector")) || clean(p.get("number")),
      language: clean(p.get("language")),
      finish: clean(p.get("finish")) || clean(p.get("variant")),
      confidence: clean(p.get("confidence"))
    };
  }

  function injectStyle() {
    if ($("zcCandidateResolverStyle")) return;
    const s = document.createElement("style");
    s.id = "zcCandidateResolverStyle";
    s.textContent = `
      .zc-resolver{
        margin:14px 0;padding:16px;border:1px solid #2c8c47;border-radius:16px;
        background:linear-gradient(180deg,#082b50,#061f3d);color:#fff;
      }
      .zc-resolver.warn{border-color:#e8ad44}
      .zc-resolver.bad{border-color:#ff6b6b}
      .zc-resolver h3{margin:0 0 7px;font-size:20px}
      .zc-resolver p{margin:0;color:#c0d5e4;line-height:1.5}
      .zc-resolver-meta{margin-top:10px;padding:10px 12px;border-radius:10px;background:#092442;font-size:13px;line-height:1.55}
      .zc-variant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:13px}
      .zc-variant-btn{border:1px solid #31587b;background:#0a294c;color:#fff;border-radius:11px;padding:12px 8px;font-weight:900;cursor:pointer}
      .zc-variant-btn.active{border-color:#58df67;background:linear-gradient(135deg,#1d7c42,#2ea84b)}
      @media(max-width:600px){.zc-variant-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function resolverBox() {
    injectStyle();
    let box = $("zcCandidateResolver");
    if (box) return box;

    box = document.createElement("section");
    box.id = "zcCandidateResolver";
    box.className = "zc-resolver";

    const detail = $("detailPanel");
    const strip = $("resultsStrip");
    const parent = (strip && strip.parentNode) || (detail && detail.parentNode) || document.body;

    if (detail && detail.parentNode === parent) parent.insertBefore(box, detail);
    else parent.appendChild(box);

    return box;
  }

  function setSearchFields(scan, card) {
    const collector = splitCollector(scan.collector);

    if ($("q")) $("q").value = card?.name || scan.name;
    if ($("number")) $("number").value = card?.number || collector.number;

    // DATABASE is leidend voor setcode.
    if ($("set")) {
      $("set").value = databaseSetCode(card) || card?.set || "";
    }

    if ($("language") && [...$("language").options].some(o => o.value === scan.language)) {
      $("language").value = scan.language;
    }

    const suggestion = normalizeVariant(scan.finish);
    ensureVariant(suggestion);
    if ($("variant")) $("variant").value = suggestion;
  }

  function showVariantChooser(scan, card) {
    const box = resolverBox();
    const suggested = normalizeVariant(scan.finish);
    const collector = splitCollector(scan.collector);

    box.className = "zc-resolver";
    box.innerHTML = `
      <h3>✅ Exacte basiskaart gevonden</h3>
      <p>
        De kaartdatabase heeft <strong>${clean(card?.name)}</strong>
        <strong>${collector.full}</strong> bevestigd.
        De set uit de database is nu leidend.
      </p>
      <div class="zc-resolver-meta">
        Database-set: <strong>${clean(card?.set) || "onbekend"}</strong>
        ${databaseSetCode(card) ? ` · <strong>${databaseSetCode(card)}</strong>` : ""}<br>
        Scanner-set (alleen hint): ${scan.scannerSet || "onbekend"}<br>
        Scanner-uitvoering: ${scan.finish || "onbekend"}
      </div>
      <div class="zc-variant-grid">
        ${VARIANTS.map(([value,label]) => `
          <button type="button"
            class="zc-variant-btn ${value === suggested ? "active" : ""}"
            data-zc-variant="${value}">${label}</button>
        `).join("")}
      </div>
    `;

    box.querySelectorAll("[data-zc-variant]").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.zcVariant;
        ensureVariant(value);
        if ($("variant")) {
          $("variant").value = value;
          $("variant").dispatchEvent(new Event("change", { bubbles: true }));
        }
        box.querySelectorAll("[data-zc-variant]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });
        try { if (typeof renderDetail === "function") renderDetail(); } catch (e) {}
      });
    });
  }

  function showMultiple(scan, matches) {
    const box = resolverBox();
    box.className = "zc-resolver warn";
    box.innerHTML = `
      <h3>🔎 Meerdere mogelijke kaarten gevonden</h3>
      <p>
        Naam en volledig kaartnummer passen bij meerdere database-items.
        Kies hieronder in de gevonden kaarten de juiste afbeelding/set.
      </p>
      <div class="zc-resolver-meta">
        Scanner: <strong>${scan.name}</strong> · <strong>${scan.collector}</strong><br>
        ${matches.length} kandidaten gevonden. Er wordt niets automatisch gegokt.
      </div>
    `;
  }

  function showNone(scan, pool) {
    const box = resolverBox();
    box.className = "zc-resolver bad";
    box.innerHTML = `
      <h3>⚠️ Nog geen exacte catalogusmatch</h3>
      <p>
        Er is geen databasekaart bevestigd met exact
        <strong>${scan.name}</strong> en <strong>${scan.collector}</strong>.
        Er wordt bewust geen andere set gekozen.
      </p>
      <div class="zc-resolver-meta">
        Scanner-set: ${scan.scannerSet || "onbekend"}<br>
        Kandidaten op naam/nummer bekeken: ${pool.length}
      </div>
    `;
  }

  async function waitForPriceChecker() {
    for (let i = 0; i < 80; i++) {
      if (
        typeof zcSearchDirect === "function" &&
        typeof renderStrip === "function" &&
        typeof renderDetail === "function"
      ) return true;
      await sleep(50);
    }
    return false;
  }

  async function boot() {
    const scan = scanPayload();
    if (!scan.enabled) return;

    // Payload veilig vastleggen vóór URL wordt opgeschoond.
    window.ZC_LAST_SCANNER_IMPORT = scan;
    history.replaceState({}, document.title, location.pathname + location.hash);

    if (!(await waitForPriceChecker())) {
      const box = resolverBox();
      box.className = "zc-resolver bad";
      box.innerHTML = "<h3>Price Checker nog niet klaar</h3><p>Ververs de pagina één keer.</p>";
      return;
    }

    const collector = splitCollector(scan.collector);
    if (!scan.name || !collector.number || !collector.total) {
      showNone(scan, []);
      return;
    }

    // CRUCIAAL:
    // De scanner-set wordt hier bewust NIET gebruikt.
    // Zoek breed op naam + nummer en laat de database het settotaal bevestigen.
    let pool = [];
    try {
      pool = await zcSearchDirect(scan.name, "", collector.number, "");
      if (typeof zcValidateCards === "function") pool = zcValidateCards(pool);
    } catch (e) {
      console.error("Candidate Resolver search error:", e);
    }

    const matches = (pool || []).filter(card => exactIdentity(scan, card));

    if (matches.length === 1) {
      currentCards = matches;
      selectedCard = matches[0];
      setSearchFields(scan, selectedCard);
      renderStrip();
      renderDetail();
      showVariantChooser(scan, selectedCard);
      resolverBox().scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (matches.length > 1) {
      currentCards = matches;
      selectedCard = null;
      renderStrip();
      if ($("detailPanel")) {
        $("detailPanel").innerHTML =
          '<div class="placeholder"><strong>Meerdere exacte kandidaten.</strong><br>Kies de juiste kaart op basis van afbeelding en set.</div>';
      }
      showMultiple(scan, matches);
      resolverBox().scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Toon alleen de relevante naam/nummer-pool; geen willekeurige kaart selecteren.
    currentCards = pool || [];
    selectedCard = null;
    renderStrip();
    if ($("detailPanel")) {
      $("detailPanel").innerHTML =
        '<div class="placeholder"><strong>Geen exacte kaart geselecteerd.</strong><br>De scanner-set wordt niet gebruikt om een verkeerde kaart af te dwingen.</div>';
    }
    showNone(scan, pool || []);
    resolverBox().scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
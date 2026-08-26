/*
  ZamexCards Scanner -> Price Checker bridge
  v3 - exacte kaartcontrole op volledige collector number
*/
(function () {
  const VARIANTS = [
    { value: "Standard", label: "Normaal" },
    { value: "Holo", label: "Holo" },
    { value: "Reverse Holo", label: "Reverse Holo" },
    { value: "Poké Ball", label: "Poké Ball" },
    { value: "Great Ball", label: "Great Ball" },
    { value: "Master Ball", label: "Master Ball" }
  ];

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function clean(v) {
    return String(v || "").trim();
  }

  function normalizeCollector(v) {
    return clean(v).replace(/\s+/g, "").toUpperCase();
  }

  function numerator(v) {
    const x = normalizeCollector(v);
    return x.includes("/") ? x.split("/")[0] : x;
  }

  function normalizeVariant(v) {
    const x = clean(v).toLowerCase();
    if (x.includes("master")) return "Master Ball";
    if (x.includes("great")) return "Great Ball";
    if (x.includes("poké ball") || x.includes("poke ball")) return "Poké Ball";
    if (x.includes("reverse")) return "Reverse Holo";
    if (x === "holo" || x.includes(" holo")) return "Holo";
    return "Standard";
  }

  function ensureVariantOption(select, value) {
    if (!select) return;
    if (![...select.options].some(o => o.value === value)) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = value;
      select.appendChild(o);
    }
  }

  function injectStyles() {
    if ($("zcBridgeStyles")) return;
    const s = document.createElement("style");
    s.id = "zcBridgeStyles";
    s.textContent = `
      .zc-scan-box{
        margin:14px 0;padding:16px;border:1px solid #2c8c47;border-radius:14px;
        background:linear-gradient(180deg,#082b50,#061f3d);color:#fff;
      }
      .zc-scan-box.bad{border-color:#ff6b6b}
      .zc-scan-box h3{margin:0 0 7px;font-size:19px}
      .zc-scan-box p{margin:0 0 12px;color:#c0d5e4;line-height:1.45}
      .zc-variant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .zc-variant-btn{
        border:1px solid #31587b;background:#0a294c;color:#fff;border-radius:11px;
        padding:12px 8px;min-height:48px;font-weight:900;cursor:pointer
      }
      .zc-variant-btn.active{
        border-color:#58df67;background:linear-gradient(135deg,#1d7c42,#2ea84b)
      }
      .zc-scan-meta{
        margin-top:11px;padding:10px;border-radius:9px;background:#092442;
        color:#d6e8f5;font-size:13px;line-height:1.45
      }
      .zc-exact-ok{color:#69e477;font-weight:900}
      .zc-exact-bad{color:#ff8b96;font-weight:900}
      @media(max-width:600px){.zc-variant-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function anchorParent() {
    const detail = $("detailPanel");
    const strip = $("resultsStrip");
    return (strip && strip.parentNode) || (detail && detail.parentNode) || document.body;
  }

  function getDetailText() {
    return clean($("detailPanel")?.innerText || $("detailPanel")?.textContent || "");
  }

  function detailHasCollector(collector) {
    const wanted = normalizeCollector(collector);
    if (!wanted) return false;
    const text = normalizeCollector(getDetailText());
    return text.includes(wanted);
  }

  async function runSearch() {
    if (typeof window.searchCards === "function") {
      await window.searchCards();
    } else {
      const form = $("searchForm");
      if (form) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    }
    await sleep(500);
  }

  function showExactFailure(scan) {
    injectStyles();
    let box = $("zcScannerVariantChooser");
    if (!box) {
      box = document.createElement("section");
      box.id = "zcScannerVariantChooser";
      anchorParent().insertBefore(box, $("detailPanel") || null);
    }
    box.className = "zc-scan-box bad";
    box.innerHTML = `
      <h3>⚠️ Exacte kaart nog niet gevonden</h3>
      <p>
        De Price Checker heeft geen kaart gevonden met exact
        <strong>${clean(scan.name)}</strong> en collector number
        <strong>${clean(scan.collector)}</strong>.
      </p>
      <div class="zc-scan-meta">
        <span class="zc-exact-bad">Een andere set/kaart wordt niet automatisch geaccepteerd.</span><br>
        Scanner-set: ${clean(scan.set) || "onbekend"}<br>
        Scanner-uitvoering: ${clean(scan.finish) || "onbekend"}
      </div>
    `;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderVariantChooser(scan) {
    injectStyles();
    let box = $("zcScannerVariantChooser");
    if (!box) {
      box = document.createElement("section");
      box.id = "zcScannerVariantChooser";
      anchorParent().insertBefore(box, $("detailPanel") || null);
    }

    const detected = normalizeVariant(scan.finish);
    const variant = $("variant");
    ensureVariantOption(variant, detected);
    variant.value = detected;

    box.className = "zc-scan-box";
    box.innerHTML = `
      <h3>✅ Basiskaart exact gevonden</h3>
      <p>
        Collector number <strong>${clean(scan.collector)}</strong> komt exact overeen.
        Kies nu zelf de juiste uitvoering.
      </p>
      <div class="zc-variant-grid">
        ${VARIANTS.map(v => `
          <button type="button"
            class="zc-variant-btn ${v.value === detected ? "active" : ""}"
            data-zc-variant="${v.value}">
            ${v.label}
          </button>
        `).join("")}
      </div>
      <div class="zc-scan-meta">
        <span class="zc-exact-ok">Exacte kaartmatch gecontroleerd.</span><br>
        Scanner dacht: <strong>${clean(scan.finish) || "Onbekend"}</strong>.
        Jouw keuze is leidend voor de prijs en kaartenlijst.
      </div>
    `;

    box.querySelectorAll("[data-zc-variant]").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-zc-variant");
        ensureVariantOption(variant, value);
        variant.value = value;
        variant.dispatchEvent(new Event("change", { bubbles: true }));

        box.querySelectorAll("[data-zc-variant]").forEach(b => {
          b.classList.toggle("active", b === btn);
        });

        try {
          if (typeof window.renderDetail === "function") window.renderDetail();
        } catch (e) {}
      });
    });

    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function boot() {
    const p = new URLSearchParams(location.search);
    if (p.get("zcscan") !== "1") return;

    const q = $("q");
    const set = $("set");
    const number = $("number");
    const language = $("language");
    const variant = $("variant");

    if (!q || !set || !number || !language || !variant) return;

    const scan = {
      name: clean(p.get("name")),
      printed: clean(p.get("printed")),
      set: clean(p.get("set")),
      number: clean(p.get("number")),
      collector: clean(p.get("collector")) || clean(p.get("number")),
      language: clean(p.get("language")),
      finish: clean(p.get("finish")) || clean(p.get("variant")),
      confidence: clean(p.get("confidence"))
    };

    window.ZC_LAST_SCANNER_IMPORT = scan;
    history.replaceState({}, document.title, location.pathname + location.hash);

    await sleep(650);

    q.value = scan.name;

    if ([...language.options].some(o => o.value === scan.language)) {
      language.value = scan.language;
    }

    ensureVariantOption(variant, normalizeVariant(scan.finish));
    variant.value = normalizeVariant(scan.finish);

    // 1) Eerst naam + VOLLEDIGE collector number, zonder mogelijk fout gelezen setcode.
    set.value = "";
    number.value = scan.collector;
    await runSearch();

    if (detailHasCollector(scan.collector)) {
      renderVariantChooser(scan);
      return;
    }

    // 2) Fallback: numerator + scannerset. Alleen accepteren bij exact dezelfde denominator.
    q.value = scan.name;
    set.value = scan.set;
    number.value = numerator(scan.collector);
    await runSearch();

    if (detailHasCollector(scan.collector)) {
      renderVariantChooser(scan);
      return;
    }

    // 3) Fallback: naam + numerator zonder set. Nog steeds exact collector controleren.
    q.value = scan.name;
    set.value = "";
    number.value = numerator(scan.collector);
    await runSearch();

    if (detailHasCollector(scan.collector)) {
      renderVariantChooser(scan);
      return;
    }

    // Verkeerde kaart zoals BLW 012/083 nooit automatisch goedkeuren.
    showExactFailure(scan);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
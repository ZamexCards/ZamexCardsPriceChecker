/*
  ZamexCards Scanner -> Price Checker bridge
  v2: na scannerscan worden alle relevante kaartuitvoeringen als keuze getoond.
*/
(function(){
  const VARIANTS = [
    {value:"Standard", label:"Normaal"},
    {value:"Holo", label:"Holo"},
    {value:"Reverse Holo", label:"Reverse Holo"},
    {value:"Poké Ball", label:"Poké Ball"},
    {value:"Great Ball", label:"Great Ball"},
    {value:"Master Ball", label:"Master Ball"}
  ];

  function qs(id){ return document.getElementById(id); }

  function normalizeVariant(v){
    const x=String(v||"").toLowerCase();
    if(x.includes("master")) return "Master Ball";
    if(x.includes("great")) return "Great Ball";
    if(x.includes("poké ball") || x.includes("poke ball")) return "Poké Ball";
    if(x.includes("reverse")) return "Reverse Holo";
    if(x==="holo" || x.includes(" holo")) return "Holo";
    return "Standard";
  }

  function ensureVariantOption(select, value){
    if(!select) return false;
    let option=[...select.options].find(o=>o.value===value);
    if(!option){
      option=document.createElement("option");
      option.value=value;
      option.textContent=value;
      select.appendChild(option);
    }
    return true;
  }

  function setVariant(value){
    const variant=qs("variant");
    if(!variant) return;
    ensureVariantOption(variant,value);
    variant.value=value;
    variant.dispatchEvent(new Event("change",{bubbles:true}));
  }

  function injectStyles(){
    if(document.getElementById("zcScannerVariantStyles")) return;
    const style=document.createElement("style");
    style.id="zcScannerVariantStyles";
    style.textContent=`
      .zc-scan-variant-box{
        margin:14px 0;
        padding:16px;
        border:1px solid #2c8c47;
        border-radius:14px;
        background:linear-gradient(180deg,#082b50,#061f3d);
        color:#fff;
        box-shadow:0 12px 30px rgba(0,0,0,.18);
      }
      .zc-scan-variant-box h3{
        margin:0 0 6px;
        font-size:18px;
      }
      .zc-scan-variant-box p{
        margin:0 0 12px;
        color:#b8d0e2;
        line-height:1.45;
        font-size:14px;
      }
      .zc-scan-variant-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }
      .zc-scan-variant-btn{
        border:1px solid #31587b;
        background:#0a294c;
        color:#fff;
        border-radius:11px;
        padding:12px 9px;
        min-height:48px;
        font-weight:900;
        font-size:14px;
        cursor:pointer;
      }
      .zc-scan-variant-btn:hover{filter:brightness(1.12)}
      .zc-scan-variant-btn.active{
        border-color:#58df67;
        background:linear-gradient(135deg,#1d7c42,#2ea84b);
        box-shadow:0 0 0 2px rgba(88,223,103,.12);
      }
      .zc-scan-detected{
        margin-top:10px;
        padding:9px 11px;
        border-radius:9px;
        background:#092442;
        color:#d6e8f5;
        font-size:13px;
      }
      @media(max-width:600px){
        .zc-scan-variant-grid{grid-template-columns:1fr 1fr}
        .zc-scan-variant-btn{font-size:13px;padding:11px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function renderVariantChooser(detected){
    injectStyles();

    let box=document.getElementById("zcScannerVariantChooser");
    if(!box){
      box=document.createElement("section");
      box.id="zcScannerVariantChooser";
      box.className="zc-scan-variant-box";

      const detail=qs("detailPanel");
      const strip=qs("resultsStrip");
      const parent=(strip && strip.parentNode) || (detail && detail.parentNode);
      if(parent){
        if(detail) parent.insertBefore(box,detail);
        else parent.appendChild(box);
      }else{
        document.body.prepend(box);
      }
    }

    const current=qs("variant")?.value || normalizeVariant(detected);
    box.innerHTML=`
      <h3>Welke uitvoering heb je?</h3>
      <p>
        De basiskaart is gevonden. Kies hieronder zelf de juiste uitvoering.
        Dit voorkomt dat een Poké Ball-, Great Ball- of Master Ball-patroon
        door reflectie als gewone Reverse Holo wordt gezien.
      </p>
      <div class="zc-scan-variant-grid">
        ${VARIANTS.map(v=>`
          <button type="button"
            class="zc-scan-variant-btn ${v.value===current?"active":""}"
            data-zc-variant="${v.value}">
            ${v.label}
          </button>
        `).join("")}
      </div>
      <div class="zc-scan-detected">
        Scanner dacht: <strong>${String(detected||"Onbekend").replace(/[<>&"]/g,"")}</strong>.
        Je keuze hieronder is leidend voor de prijs en kaartenlijst.
      </div>
    `;

    box.querySelectorAll("[data-zc-variant]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const value=btn.getAttribute("data-zc-variant");
        setVariant(value);

        box.querySelectorAll("[data-zc-variant]").forEach(b=>{
          b.classList.toggle("active",b===btn);
        });

        // Herteken detail/prijs met gekozen variant.
        try{
          if(typeof window.renderDetail==="function") window.renderDetail();
        }catch(e){}

        // Zet de keuze ook zichtbaar in het gewone dropdownveld.
        const target=qs("variant");
        target?.scrollIntoView({behavior:"smooth",block:"center"});
      });
    });
  }

  async function boot(){
    const p=new URLSearchParams(location.search);
    if(p.get("zcscan")!=="1") return;

    const q=qs("q");
    const set=qs("set");
    const number=qs("number");
    const language=qs("language");
    const variant=qs("variant");

    if(!q || !set || !number || !language || !variant) return;

    const scannerFinish=p.get("finish") || p.get("variant") || "Unknown";
    const detectedVariant=normalizeVariant(scannerFinish);

    q.value=p.get("name") || "";
    set.value=p.get("set") || "";
    number.value=p.get("number") || "";

    const wantedLanguage=p.get("language");
    if([...language.options].some(o=>o.value===wantedLanguage)){
      language.value=wantedLanguage;
    }

    ensureVariantOption(variant,detectedVariant);
    variant.value=detectedVariant;

    // Bewaar scannerscan tijdelijk zodat refresh niet opnieuw hoeft te importeren.
    window.ZC_LAST_SCANNER_IMPORT={
      name:p.get("name")||"",
      printed:p.get("printed")||"",
      set:p.get("set")||"",
      number:p.get("number")||"",
      collector:p.get("collector")||"",
      language:wantedLanguage||"",
      finish:scannerFinish,
      confidence:p.get("confidence")||""
    };

    history.replaceState({},document.title,location.pathname+location.hash);

    // Wacht op initialisatie van de bestaande Price Checker.
    await new Promise(r=>setTimeout(r,550));

    if(typeof window.searchCards==="function"){
      await window.searchCards();
    }else{
      const form=qs("searchForm");
      if(form){
        form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      }
    }

    // Geef zoeken even tijd om resultaten/detail te renderen.
    await new Promise(r=>setTimeout(r,350));

    renderVariantChooser(scannerFinish);

    // De gebruiker kiest nu bewust de uitvoering.
    const chooser=document.getElementById("zcScannerVariantChooser");
    chooser?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }
})();
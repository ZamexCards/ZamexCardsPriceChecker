/*
 ZamexCards scanner -> Price Checker handoff
 Camera/scanner code is NOT involved here.
*/
(function(){
  const FAVS_KEY="zc_favs";

  function decodeTransfer(raw){
    try{
      let s=String(raw||"").replace(/-/g,"+").replace(/_/g,"/");
      while(s.length%4)s+="=";
      const binary=atob(s);
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(e){
      console.error("ZamexCards scanner import decode error",e);
      return null;
    }
  }

  function readFavs(){
    try{
      const value=JSON.parse(localStorage.getItem(FAVS_KEY)||"[]");
      return Array.isArray(value)?value:[];
    }catch(e){return[]}
  }

  function writeFavs(favs){
    localStorage.setItem(FAVS_KEY,JSON.stringify(favs));
  }

  function importScans(items){
    const favs=readFavs();
    let imported=0;

    for(const x of items){
      if(!x||!x.k||!x.i||!x.n)continue;

      const qty=Math.max(1,Number(x.q)||1);
      const existing=favs.find(f=>f.listId===x.k);

      if(existing){
        existing.quantity=Math.max(1,Number(existing.quantity)||1)+qty;
        existing.addedViaScanner=true;

        if(x.p!=null){
          existing.prices=existing.prices||{};
          if(x.cu==="EUR")existing.prices.average30Days=Number(x.p);
          existing.prices.fallbackMarket=Number(x.p);
          existing.prices.fallbackCurrency=x.cu||"EUR";
          existing.prices.fallbackLabel=x.pl||"Prijsindicatie";
          existing.prices.source=x.ps||"Scanner";
          existing.prices.isReal=true;
        }

        imported+=qty;
        continue;
      }

      favs.push({
        id:x.i,
        name:x.n,
        image:x.m||"",
        imageCandidates:x.m?[x.m]:[],
        set:x.s||"",
        setId:x.si||"",
        pokemonSetId:x.si||"",
        series:"",
        setLogo:"",
        number:x.no||"",
        rarity:x.r||"Onbekend",
        types:[],
        releaseDate:"",
        prices:{
          average30Days:(x.cu==="EUR"&&x.p!=null)?Number(x.p):null,
          fallbackMarket:x.p!=null?Number(x.p):null,
          fallbackCurrency:x.cu||"EUR",
          fallbackLabel:x.pl||"Prijsindicatie",
          source:x.ps||"Scanner",
          isReal:x.p!=null
        },
        variant:x.v||"Standard",
        language:x.l||"English",
        condition:x.c||"Near Mint",
        graded:false,
        gradingCompany:null,
        grade:null,
        listId:x.k,
        quantity:qty,
        addedViaScanner:true
      });
      imported+=qty;
    }

    writeFavs(favs);
    return imported;
  }

  function runImport(){
    const params=new URLSearchParams(location.search);
    const raw=params.get("zcimport");
    if(!raw)return;

    const items=decodeTransfer(raw);
    if(Array.isArray(items)&&items.length){
      const imported=importScans(items);

      // Refresh existing Price Checker UI if its functions are available.
      try{ if(typeof renderFavorites==="function")renderFavorites(); }catch(e){}
      try{
        if(typeof showToast==="function"){
          showToast(`${imported} gescande kaart${imported===1?"":"en"} toegevoegd aan jouw kaartenlijst.`);
        }
      }catch(e){}
    }

    // Clean the payload from the address bar after import.
    try{
      history.replaceState({},document.title,location.pathname+location.hash);
    }catch(e){}
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(runImport,50));
  }else{
    setTimeout(runImport,50);
  }
})();


/* ============================================================
   ZamexCards Set/Setcode dropdown v2
   Alleen Price Checker setlijst. Scanner/camera wordt NIET geraakt.
   ============================================================ */
(function(){
  'use strict';

  const PATCH_VERSION='zc-set-dropdown-v2-20260827';
  const EN_CACHE_KEY='zc_official_en_sets_v2';
  const REG_CACHE_PREFIX='zc_regional_sets_v2_';
  const CACHE_MS=24*60*60*1000;

  const CODE_BY_NAME={
    'scarlet violet 151':'151',
    '151':'151',
    'black bolt':'BLK',
    'white flare':'WHT',
    'scarlet violet black star promos':'SVP',
    'sword shield black star promos':'SWSH',
    'sun moon black star promos':'SM',
    'xy black star promos':'XY',
    'black white promos':'BW',
    'black white black star promos':'BW',
    'diamond pearl promos':'DP',
    'diamond pearl black star promos':'DP',
    'nintendo black star promos':'NP'
  };

  const REGION_LABEL={
    Japanese:'Japanese',
    Chinese:'Chinese',
    Korean:'Korean',
    German:'German',
    French:'French',
    Italian:'Italian',
    Spanish:'Spanish',
    Dutch:'Dutch'
  };

  let englishSets=[];
  let regionalSets=[];
  let loadingPromise=null;

  function norm(v=''){
    return String(v).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }
  function dateValue(v){
    const s=String(v||'').replace(/\//g,'-');
    const t=Date.parse(s);
    return Number.isFinite(t)?t:0;
  }
  function esc2(v=''){
    return String(v).replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function latinReadable(v=''){
    const s=String(v||'').trim();
    if(!s)return false;
    const letters=(s.match(/[A-Za-z]/g)||[]).length;
    const nonSpace=s.replace(/\s/g,'').length||1;
    return letters/nonSpace>=0.45;
  }
  function selectedLanguage(){
    return document.getElementById('language')?.value||'English';
  }
  function tcgdexLang(){
    const l=selectedLanguage();
    return {
      Japanese:'ja',
      Chinese:'zh-cn',
      Korean:'ko',
      German:'de',
      French:'fr',
      Italian:'it',
      Spanish:'es',
      Dutch:'nl'
    }[l]||'en';
  }
  function cleanEnglishCode(set){
    const nameKey=norm(set.name);
    if(CODE_BY_NAME[nameKey])return CODE_BY_NAME[nameKey];

    const id=String(set.id||'').toLowerCase();
    const promoById={
      svp:'SVP',swshp:'SWSH',smp:'SM',xyp:'XY',bwp:'BW',dpp:'DP',np:'NP'
    };
    if(promoById[id])return promoById[id];

    const raw=String(set.ptcgoCode||set.code||set.id||'').trim();
    return raw.toUpperCase();
  }
  function regionalCode(set){
    const raw=String(
      set.code||set.setCode||set.abbreviation||set.printedCode||set.id||''
    ).trim();
    return raw||String(set.id||'').trim();
  }
  function displayName(set){
    if(selectedLanguage()==='English')return String(set.name||set.id||'Unknown set');

    if(set.englishName)return set.englishName;
    if(latinReadable(set.name))return String(set.name);

    // No guessed translation: readable English fallback instead of native script.
    const region=REGION_LABEL[selectedLanguage()]||selectedLanguage();
    const code=regionalCode(set);
    return `${region} set ${code}`;
  }
  function subLabel(set){
    const d=dateValue(set.releaseDate);
    let date='Release date unknown';
    if(d){
      date=new Date(d).toLocaleDateString('nl-NL',{
        day:'2-digit',month:'2-digit',year:'numeric'
      });
    }
    const extra=String(set.series||set.serie?.name||'').trim();
    return extra?`${date} · ${extra}`:date;
  }
  function sortSets(items){
    return [...items].sort((a,b)=>{
      const da=dateValue(a.releaseDate),db=dateValue(b.releaseDate);
      if(db!==da)return db-da;
      return String(displayName(a)).localeCompare(String(displayName(b)),'en',{
        numeric:true,sensitivity:'base'
      });
    });
  }
  function readCache(key){
    try{
      const x=JSON.parse(localStorage.getItem(key)||'null');
      if(x?.at && Array.isArray(x.items) && Date.now()-x.at<CACHE_MS)return x.items;
    }catch(e){}
    return null;
  }
  function writeCache(key,items){
    try{localStorage.setItem(key,JSON.stringify({at:Date.now(),items}))}catch(e){}
  }
  async function fetchJson2(url,timeout=12000){
    const c=new AbortController();
    const t=setTimeout(()=>c.abort(),timeout);
    try{
      const r=await fetch(url,{headers:{Accept:'application/json'},signal:c.signal,cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      return await r.json();
    }finally{clearTimeout(t)}
  }

  async function loadEnglish(force=false){
    if(!force){
      const cached=readCache(EN_CACHE_KEY);
      if(cached?.length){englishSets=cached;return englishSets}
    }

    let items=[];
    try{
      const d=await fetchJson2('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=300',15000);
      items=(d.data||[]).map(s=>({
        id:String(s.id||''),
        name:String(s.name||s.id||''),
        series:String(s.series||''),
        ptcgoCode:String(s.ptcgoCode||''),
        releaseDate:String(s.releaseDate||'')
      }));
    }catch(e){}

    // Fall back to the catalog already loaded by the Price Checker.
    if(!items.length){
      try{
        if(typeof zcLoadGlobalCatalog==='function')await zcLoadGlobalCatalog(true);
        if(typeof ZC_GLOBAL_CATALOG!=='undefined'){
          items=ZC_GLOBAL_CATALOG
            .filter(e=>e.lang==='en')
            .map(e=>({
              id:e.id,name:e.name,series:e.series||'',
              ptcgoCode:e.ptcgoCode||'',releaseDate:e.releaseDate||''
            }));
        }
      }catch(e){}
    }

    // Remove duplicates by ID/name, always keep promos/specials too.
    const seen=new Map();
    for(const s of items){
      const k=String(s.id||norm(s.name));
      const old=seen.get(k);
      if(!old || (!old.releaseDate&&s.releaseDate))seen.set(k,s);
    }
    englishSets=sortSets([...seen.values()]);
    writeCache(EN_CACHE_KEY,englishSets);
    return englishSets;
  }

  async function mapLimit(items,limit,worker){
    const out=new Array(items.length);
    let next=0;
    async function run(){
      while(true){
        const i=next++;
        if(i>=items.length)return;
        try{out[i]=await worker(items[i],i)}catch(e){out[i]=items[i]}
      }
    }
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
    return out;
  }

  async function loadRegional(force=false){
    const lang=tcgdexLang();
    const key=REG_CACHE_PREFIX+lang;
    if(!force){
      const cached=readCache(key);
      if(cached?.length){regionalSets=cached;return regionalSets}
    }

    let list=[];
    try{
      const d=await fetchJson2(`https://api.tcgdex.net/v2/${lang}/sets`,15000);
      list=Array.isArray(d)?d:[];
    }catch(e){}

    if(!list.length){
      try{
        if(typeof zcLoadGlobalCatalog==='function')await zcLoadGlobalCatalog(true);
        if(typeof ZC_GLOBAL_CATALOG!=='undefined'){
          list=ZC_GLOBAL_CATALOG.filter(e=>e.lang===lang);
        }
      }catch(e){}
    }

    // TCGdex list responses can miss releaseDate.
    // Read set details in parallel so sorting is based on the real date.
    const details=await mapLimit(list.slice(0,220),8,async brief=>{
      const id=String(brief.id||'').trim();
      if(!id)return brief;
      let full=brief;
      try{
        const d=await fetchJson2(`https://api.tcgdex.net/v2/${lang}/sets/${encodeURIComponent(id)}`,9000);
        if(d?.id)full={...brief,...d};
      }catch(e){}

      // If TCGdex exposes the same regional set in English, use that readable name.
      // Otherwise do NOT invent a translation.
      if(!latinReadable(full.name)){
        try{
          const en=await fetchJson2(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(id)}`,5000);
          if(en?.name && latinReadable(en.name))full.englishName=en.name;
        }catch(e){}
      }
      return full;
    });

    const seen=new Map();
    for(const s of details){
      const k=String(s.id||norm(s.name));
      if(!k)continue;
      const old=seen.get(k);
      if(!old || (!old.releaseDate&&s.releaseDate))seen.set(k,s);
    }
    regionalSets=sortSets([...seen.values()]);
    writeCache(key,regionalSets);
    return regionalSets;
  }

  async function ensureSets(force=false){
    if(loadingPromise&&!force)return loadingPromise;
    loadingPromise=(selectedLanguage()==='English'?loadEnglish(force):loadRegional(force));
    try{return await loadingPromise}
    finally{loadingPromise=null}
  }

  function currentItems(){
    return selectedLanguage()==='English'?englishSets:regionalSets;
  }
  function itemCode(e){
    return selectedLanguage()==='English'?cleanEnglishCode(e):regionalCode(e);
  }
  function filterItems(items,value){
    const q=norm(value);
    const raw=String(value||'').trim().toUpperCase();
    if(!q&&!raw)return items;
    return items.filter(e=>{
      const code=String(itemCode(e)||'').toUpperCase();
      const name=displayName(e);
      return code.includes(raw) ||
             norm(name).includes(q) ||
             norm(e.name||'').includes(q) ||
             String(e.id||'').toUpperCase().includes(raw);
    });
  }

  function renderPatchedDropdown(){
    const box=document.getElementById('setDropdown');
    const input=document.getElementById('set');
    if(!box||!input)return;

    let items=filterItems(currentItems(),input.value).slice(0,160);
    box.innerHTML=items.length?items.map(e=>{
      const code=itemCode(e);
      return `<div class="set-option zc-v2-set-option" role="option"
          data-zc-value="${esc2(code)}" data-zc-name="${esc2(displayName(e))}">
        <div>
          <strong>${esc2(displayName(e))}</strong>
          <small>${esc2(subLabel(e))}</small>
        </div>
        <div class="set-option-code">${esc2(code)}</div>
      </div>`;
    }).join(''):'<div class="set-empty">Geen sets gevonden.</div>';

    box.classList.add('open');
    input.setAttribute('aria-expanded','true');
  }

  async function openPatchedDropdown(force=false){
    const box=document.getElementById('setDropdown');
    if(box){
      box.innerHTML='<div class="set-empty">Sets laden op releasedatum…</div>';
      box.classList.add('open');
    }
    await ensureSets(force);
    renderPatchedDropdown();
  }

  function install(){
    const input=document.getElementById('set');
    const box=document.getElementById('setDropdown');
    const language=document.getElementById('language');
    if(!input||!box||!language)return;

    // Clear the old broken catalog once after installing this patch.
    try{
      if(localStorage.getItem('zc_set_patch_version')!==PATCH_VERSION){
        localStorage.removeItem('zamexcards_global_set_catalog_v8');
        localStorage.removeItem(EN_CACHE_KEY);
        for(const l of ['ja','zh-cn','zh-tw','ko','de','fr','it','es','nl']){
          localStorage.removeItem(REG_CACHE_PREFIX+l);
        }
        localStorage.setItem('zc_set_patch_version',PATCH_VERSION);
      }
    }catch(e){}

    // Capture handlers take precedence over the old dropdown implementation.
    input.addEventListener('focus',e=>{
      e.stopImmediatePropagation();
      openPatchedDropdown(false);
    },true);
    input.addEventListener('click',e=>{
      e.stopImmediatePropagation();
      openPatchedDropdown(false);
    },true);
    input.addEventListener('input',e=>{
      e.stopImmediatePropagation();
      if(currentItems().length)renderPatchedDropdown();
      else openPatchedDropdown(false);
    },true);

    language.addEventListener('change',async()=>{
      regionalSets=[];
      englishSets=[];
      input.value='';
      await openPatchedDropdown(false);
    },true);

    box.addEventListener('click',e=>{
      const row=e.target.closest('.zc-v2-set-option');
      if(!row)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      input.value=row.dataset.zcValue||'';
      input.dataset.setName=row.dataset.zcName||'';
      box.classList.remove('open');
      input.setAttribute('aria-expanded','false');
      input.dispatchEvent(new Event('change',{bubbles:true}));
    },true);

    // Prime English data quietly so first open is fast.
    setTimeout(()=>ensureSets(false).catch(()=>{}),150);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }
})();


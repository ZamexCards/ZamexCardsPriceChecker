/*
 ZamexCards Price Checker bridge
 - scanner list import
 - set/setcode dropdown
 - fixed link to locked scanner
*/
(function(){
  const FAVS_KEY="zc_favs";

  function decodeTransfer(raw){
    try{
      let s=String(raw||"").replace(/-/g,"+").replace(/_/g,"/");
      while(s.length%4)s+="=";
      const bin=atob(s), bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(e){return null}
  }
  function readFavs(){
    try{const v=JSON.parse(localStorage.getItem(FAVS_KEY)||"[]");return Array.isArray(v)?v:[]}
    catch(e){return[]}
  }
  function importScans(items){
    const favs=readFavs();
    for(const x of items){
      if(!x?.k||!x?.i||!x?.n)continue;
      const qty=Math.max(1,Number(x.q)||1);
      const old=favs.find(f=>f.listId===x.k);
      if(old){
        old.quantity=Math.max(1,Number(old.quantity)||1)+qty;
        old.condition=x.c||old.condition||"Near Mint";
        old.addedViaScanner=true;
        if(x.p!=null){
          old.prices=old.prices||{};
          if(x.cu==="EUR")old.prices.average30Days=Number(x.p);
          old.prices.fallbackMarket=Number(x.p);
          old.prices.fallbackCurrency=x.cu||"EUR";
          old.prices.fallbackLabel=x.pl||"Prijsindicatie";
          old.prices.source=x.ps||"Scanner";
          old.prices.isReal=true;
        }
      }else{
        favs.push({
          id:x.i,name:x.n,image:x.m||"",imageCandidates:x.m?[x.m]:[],
          set:x.s||"",setId:x.si||"",pokemonSetId:x.si||"",series:"",setLogo:"",
          number:x.no||"",rarity:x.r||"Onbekend",types:[],releaseDate:"",
          prices:{
            average30Days:(x.cu==="EUR"&&x.p!=null)?Number(x.p):null,
            fallbackMarket:x.p!=null?Number(x.p):null,
            fallbackCurrency:x.cu||"EUR",fallbackLabel:x.pl||"Prijsindicatie",
            source:x.ps||"Scanner",isReal:x.p!=null
          },
          variant:x.v||"Standard",language:x.l||"English",condition:x.c||"Near Mint",
          graded:false,gradingCompany:null,grade:null,listId:x.k,quantity:qty,addedViaScanner:true
        });
      }
    }
    localStorage.setItem(FAVS_KEY,JSON.stringify(favs));
  }
  function runImport(){
    const p=new URLSearchParams(location.search), raw=p.get("zcimport");
    if(!raw)return;
    const items=decodeTransfer(raw);
    if(Array.isArray(items)&&items.length){
      importScans(items);
      try{if(typeof renderFavorites==="function")renderFavorites()}catch(e){}
      try{if(typeof showToast==="function")showToast("Gescande kaart(en) toegevoegd aan jouw kaartenlijst.")}catch(e){}
    }
    try{history.replaceState({},document.title,location.pathname+location.hash)}catch(e){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(runImport,50));
  else setTimeout(runImport,50);
})();

/* Price Checker Scan kaart -> locked scanner */
(function(){
  const SCANNER_URL="https://zamex-cards-price-checker.vercel.app/scanner-v4.html";
  function install(){
    const b=document.getElementById("scanBtn");
    if(!b)return;
    b.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      location.href=SCANNER_URL;
    },true);
    b.title="Open de vaste ZamexCards AI Scanner";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();

/* Set/setcode dropdown - newest release first */
(function(){
  const EN_KEY="zc_sets_en_v3", REG_PREFIX="zc_sets_reg_v3_", DAY=86400000;
  const CODE_NAMES={
    "scarlet violet 151":"151","black bolt":"BLK","white flare":"WHT",
    "scarlet violet black star promos":"SVP","sword shield black star promos":"SWSH",
    "sun moon black star promos":"SM","xy black star promos":"XY",
    "black white promos":"BW","black white black star promos":"BW"
  };
  let sets=[],loading=null;
  const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const lang=()=>document.getElementById("language")?.value||"English";
  const tcgLang=()=>({Japanese:"ja",Chinese:"zh-cn",Korean:"ko",German:"de",French:"fr",Italian:"it",Spanish:"es",Dutch:"nl"}[lang()]||"en");
  const dateVal=s=>{const n=Date.parse(String(s||"").replace(/\//g,"-"));return Number.isFinite(n)?n:0};
  const latin=s=>{s=String(s||"");const l=(s.match(/[A-Za-z]/g)||[]).length;return l/(s.replace(/\s/g,"").length||1)>.42};
  const cacheRead=k=>{try{const x=JSON.parse(localStorage.getItem(k)||"null");return x&&Date.now()-x.at<DAY?x.items:null}catch(e){return null}};
  const cacheWrite=(k,v)=>{try{localStorage.setItem(k,JSON.stringify({at:Date.now(),items:v}))}catch(e){}};
  async function json(url,timeout=10000){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
    try{const r=await fetch(url,{signal:c.signal,headers:{Accept:"application/json"}});if(!r.ok)throw 0;return await r.json()}
    finally{clearTimeout(t)}
  }
  function enCode(s){
    const nk=norm(s.name);if(CODE_NAMES[nk])return CODE_NAMES[nk];
    const id=String(s.id||"").toLowerCase();
    const pm={svp:"SVP",swshp:"SWSH",smp:"SM",xyp:"XY",bwp:"BW"};
    if(pm[id])return pm[id];
    return String(s.ptcgoCode||s.code||s.id||"").toUpperCase();
  }
  function regCode(s){return String(s.code||s.setCode||s.abbreviation||s.id||"")}
  function showName(s){
    if(lang()==="English")return String(s.name||s.id||"Unknown set");
    if(s.englishName)return s.englishName;
    if(latin(s.name))return String(s.name);
    return `${lang()} set ${regCode(s)}`;
  }
  function code(s){return lang()==="English"?enCode(s):regCode(s)}
  function sort(v){return [...v].sort((a,b)=>dateVal(b.releaseDate)-dateVal(a.releaseDate)||showName(a).localeCompare(showName(b),"en"))}
  async function mapLimit(items,limit,fn){
    let i=0,out=new Array(items.length);
    async function worker(){while(true){const n=i++;if(n>=items.length)return;try{out[n]=await fn(items[n])}catch(e){out[n]=items[n]}}}
    await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;
  }
  async function loadEnglish(){
    const c=cacheRead(EN_KEY);if(c?.length)return c;
    let v=[];
    try{
      const d=await json("https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=300",15000);
      v=(d.data||[]).map(s=>({id:s.id,name:s.name,series:s.series,ptcgoCode:s.ptcgoCode,releaseDate:s.releaseDate}));
    }catch(e){}
    if(!v.length){
      try{
        const a=await json("https://api.tcgdex.net/v2/en/sets",15000);
        v=await mapLimit(a.slice(0,240),8,async s=>({...s,...await json(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(s.id)}`,7000)}));
      }catch(e){}
    }
    v=sort(v);cacheWrite(EN_KEY,v);return v;
  }
  async function loadRegional(){
    const l=tcgLang(),key=REG_PREFIX+l,c=cacheRead(key);if(c?.length)return c;
    let a=[];
    try{a=await json(`https://api.tcgdex.net/v2/${l}/sets`,15000)}catch(e){}
    a=await mapLimit(a.slice(0,240),8,async s=>{
      let f=s;
      try{f={...s,...await json(`https://api.tcgdex.net/v2/${l}/sets/${encodeURIComponent(s.id)}`,7000)}}catch(e){}
      if(!latin(f.name)){
        try{const en=await json(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(s.id)}`,5000);if(en?.name&&latin(en.name))f.englishName=en.name}catch(e){}
      }
      return f;
    });
    a=sort(a);cacheWrite(key,a);return a;
  }
  async function ensure(){
    if(loading)return loading;
    loading=(lang()==="English"?loadEnglish():loadRegional());
    try{sets=await loading;return sets}finally{loading=null}
  }
  function render(){
    const box=document.getElementById("setDropdown"),inp=document.getElementById("set");if(!box||!inp)return;
    const q=norm(inp.value),raw=String(inp.value||"").toUpperCase();
    const list=sets.filter(s=>!q||norm(showName(s)).includes(q)||norm(s.name).includes(q)||String(code(s)).toUpperCase().includes(raw)).slice(0,160);
    box.innerHTML=list.map(s=>`<div class="set-option zc-new-set" data-code="${String(code(s)).replace(/"/g,"&quot;")}"><div><strong>${showName(s)}</strong><small>${s.releaseDate||"Release date unknown"}${s.series?` · ${s.series}`:""}</small></div><div class="set-option-code">${code(s)}</div></div>`).join("")||'<div class="set-empty">Geen sets gevonden.</div>';
    box.classList.add("open");
  }
  async function open(){const b=document.getElementById("setDropdown");if(b){b.innerHTML='<div class="set-empty">Sets laden…</div>';b.classList.add("open")}await ensure();render()}
  function install(){
    const inp=document.getElementById("set"),box=document.getElementById("setDropdown"),la=document.getElementById("language");if(!inp||!box||!la)return;
    ["focus","click"].forEach(ev=>inp.addEventListener(ev,e=>{e.stopImmediatePropagation();open()},true));
    inp.addEventListener("input",e=>{e.stopImmediatePropagation();sets.length?render():open()},true);
    la.addEventListener("change",()=>{sets=[];inp.value="";open()},true);
    box.addEventListener("click",e=>{
      const r=e.target.closest(".zc-new-set");if(!r)return;
      e.preventDefault();e.stopImmediatePropagation();inp.value=r.dataset.code||"";box.classList.remove("open");inp.dispatchEvent(new Event("change",{bubbles:true}));
    },true);
    setTimeout(()=>ensure().catch(()=>{}),100);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();

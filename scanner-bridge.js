/*
 ZamexCards scanner list handoff.
 Scanner is on Vercel; Price Checker is on GitHub Pages.
*/
(function(){
  const KEY="zc_favs";

  function decodePayload(s){
    try{
      s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
      while(s.length%4)s+="=";
      const binary=atob(s);
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(e){return null}
  }

  function getFavs(){
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||"[]");
      return Array.isArray(x)?x:[];
    }catch(e){return[]}
  }

  function mergeImport(items){
    const favs=getFavs();

    for(const x of items){
      if(!x||!x.k||!x.i||!x.n)continue;
      const qty=Math.max(1,Number(x.q)||1);
      const old=favs.find(f=>f.listId===x.k);

      if(old){
        old.quantity=Math.max(1,Number(old.quantity)||1)+qty;
        if(x.p!=null){
          old.prices=old.prices||{};
          old.prices.average30Days=x.cu==="EUR"?Number(x.p):old.prices.average30Days;
          old.prices.fallbackMarket=Number(x.p);
          old.prices.fallbackCurrency=x.cu||"EUR";
          old.prices.fallbackLabel=x.pl||"Prijsindicatie";
          old.prices.source=x.ps||"Scanner";
          old.prices.isReal=true;
        }
        old.addedViaScanner=true;
        continue;
      }

      favs.push({
        id:x.i,name:x.n,image:x.m||"",imageCandidates:x.m?[x.m]:[],
        set:x.s||"",setId:x.si||"",pokemonSetId:x.si||"",series:"",
        setLogo:"",number:x.no||"",rarity:x.r||"Onbekend",types:[],releaseDate:"",
        prices:{
          average30Days:(x.cu==="EUR"&&x.p!=null)?Number(x.p):null,
          fallbackMarket:x.p!=null?Number(x.p):null,
          fallbackCurrency:x.cu||"EUR",
          fallbackLabel:x.pl||"Prijsindicatie",
          source:x.ps||"Scanner",
          isReal:x.p!=null
        },
        variant:x.v||"Standard",language:x.l||"English",condition:x.c||"Near Mint",
        graded:false,gradingCompany:null,grade:null,listId:x.k,quantity:qty,addedViaScanner:true
      });
    }

    localStorage.setItem(KEY,JSON.stringify(favs));
    return favs
  }

  function importFromUrl(){
    const p=new URLSearchParams(location.search);
    const raw=p.get("zcimport");
    if(!raw)return;

    const items=decodePayload(raw);
    if(Array.isArray(items)&&items.length){
      mergeImport(items);
      try{if(typeof renderFavorites==="function")renderFavorites()}catch(e){}
      try{
        if(typeof showToast==="function"){
          const total=items.reduce((s,x)=>s+Math.max(1,Number(x?.q)||1),0);
          showToast(`${total} gescande kaart${total===1?"":"en"} toegevoegd aan jouw kaartenlijst.`)
        }
      }catch(e){}
    }

    history.replaceState({},document.title,location.pathname+location.hash)
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(importFromUrl,0))
  }else{
    setTimeout(importFromUrl,0)
  }
})();
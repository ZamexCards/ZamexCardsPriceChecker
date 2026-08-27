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
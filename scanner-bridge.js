/*
  ZamexCards Scanner -> Price Checker bridge
  Plaats dit bestand in dezelfde map als index.html en voeg vóór </body> toe:
  <script src="scanner-bridge.js"></script>
*/
(function(){
  function qs(id){return document.getElementById(id)}
  function normalizeVariant(v){
    const x=String(v||"").toLowerCase();
    if(x.includes("master"))return "Master Ball";
    if(x.includes("great"))return "Great Ball";
    if(x.includes("poké ball")||x.includes("poke ball"))return "Poké Ball";
    if(x.includes("reverse"))return "Reverse Holo";
    if(x==="holo"||x.includes(" holo"))return "Holo";
    return "Standard";
  }
  async function boot(){
    const p=new URLSearchParams(location.search);
    if(p.get("zcscan")!=="1")return;

    const q=qs("q"),set=qs("set"),number=qs("number"),language=qs("language"),variant=qs("variant");
    if(!q||!set||!number||!language||!variant)return;

    q.value=p.get("name")||"";
    set.value=p.get("set")||"";
    number.value=p.get("number")||"";
    if([...language.options].some(o=>o.value===p.get("language"))) language.value=p.get("language");
    const wantedVariant=normalizeVariant(p.get("variant")||p.get("finish"));
    if([...variant.options].some(o=>o.value===wantedVariant))variant.value=wantedVariant;

    // Clear the query string so refreshing the page does not repeat the scanner import.
    history.replaceState({},document.title,location.pathname+location.hash);

    // Let the Price Checker initialize its catalog first.
    await new Promise(r=>setTimeout(r,450));

    if(typeof window.searchCards==="function"){
      await window.searchCards();
    }else{
      const form=qs("searchForm");
      if(form)form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
    }

    // Scroll to results after the automatic lookup.
    setTimeout(()=>{
      const target=qs("resultsStrip")||qs("detailPanel");
      target?.scrollIntoView({behavior:"smooth",block:"start"});
    },300);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
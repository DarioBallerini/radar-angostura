// Mejoras de UX comunes a las tres direcciones (maqueta)
(function(){
const fmtK=n=>n>=1000?Math.round(n/1000)+"k":n;
const tope=()=>{const v=+document.getElementById("pMax").value;return v>0?v:null};
// 1) presets de tope al lado del campo de precio
const pm=document.querySelector(".pmax");
if(pm&&!document.querySelector(".presets")){const d=document.createElement("div");d.className="presets";
 d.innerHTML=[150000,200000,250000].map(v=>`<button type="button" data-v="${v}">${fmtK(v)}</button>`).join("");
 pm.after(d);d.querySelectorAll("button").forEach(b=>b.onclick=()=>{const i=document.getElementById("pMax");i.value=b.dataset.v;i.dispatchEvent(new Event("input"));mark()});}
function mark(){const t=tope();document.querySelectorAll(".presets button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.v===t))}
// 2) medidor "cuánto de mi tope" en tarjetas y tabla
function meters(){const t=tope();if(!t)return;
 document.querySelectorAll(".hc").forEach(c=>{if(c.querySelector(".tope"))return;const p=c.querySelector(".hc-p");if(!p)return;const v=+p.textContent.replace(/\D/g,"");if(!v)return;
  const pct=Math.min(100,Math.round(v/t*100));const m=document.createElement("div");m.className="tope";m.innerHTML=`<i style="width:${pct}%"></i><span>${pct}% de tu tope · te sobran USD ${(t-v).toLocaleString("es-AR")}</span>`;c.querySelector(".hc-f")?.before(m)});
 document.querySelectorAll("#tbl tbody tr").forEach(r=>{const td=r.children[1];if(!td||td.querySelector(".tbar"))return;const v=+td.textContent.replace(/\D/g,"");if(!v)return;const pct=Math.min(100,v/t*100);const s=document.createElement("i");s.className="tbar";s.style.width=pct+"%";td.appendChild(s)})}
// 3) barras en el ranking de barrios
function bars(){const L=[...document.querySelectorAll(".panel.ranking .mini li a")];if(!L.length||L[0].querySelector(".rb"))return;
 const vals=L.map(a=>+a.querySelector(".num").textContent.replace(/[^\d]/g,"")||0);const mx=Math.max(...vals);
 L.forEach((a,i)=>{const b=document.createElement("i");b.className="rb";b.style.width=(vals[i]/mx*100)+"%";a.prepend(b)});
 const n=document.querySelector(".panel.ranking > p.note");if(n)n.textContent=n.textContent.replace(/ Sin ubicar en el mapa:.*$/,"").replace(" Tocá un barrio del mapa para ver su ficha.","");}
// 4) filtros de Casas en mobile: Ordenar a la vista + botón "Filtros"
function mfilters(){const bar=document.querySelector("#v-casas .bar");if(!bar||bar.querySelector(".fbtn"))return;
 const b=document.createElement("button");b.type="button";b.className="fbtn";b.innerHTML=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtros <b>2</b>`;
 b.onclick=()=>bar.classList.toggle("open");bar.prepend(b)}
const obs=new MutationObserver(()=>{meters();bars();mark()});
obs.observe(document.body,{subtree:true,childList:true});
mfilters();mark();
})();

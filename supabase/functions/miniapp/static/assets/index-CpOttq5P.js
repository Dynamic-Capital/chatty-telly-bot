(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const a of t.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function c(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(e){if(e.ep)return;e.ep=!0;const t=c(e);fetch(e.href,t)}})();var l;const o=(l=window.Telegram)==null?void 0:l.WebApp;o&&o.ready();const u=(o==null?void 0:o.initData)||"",n=document.getElementById("app");if(n){n.innerHTML=`
    <form id="deposit" class="space-y-2">
      <label class="block">
        <span class="block mb-1">Amount</span>
        <input name="amount" type="number" min="1" required class="border p-2 w-full" />
      </label>
      <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">Deposit</button>
      <div id="status" class="text-sm mt-2"></div>
    </form>
  `;const i=n.querySelector("#deposit"),r=n.querySelector("#status");i.addEventListener("submit",async c=>{c.preventDefault(),r.textContent="Processing...";const s=Number(i.elements.namedItem("amount").value);try{const e=await fetch(`${window.location.origin}/miniapp-deposit`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData:u,amount:s})}),t=await e.json();e.ok&&t.ok?(r.textContent="Deposit created!",setTimeout(()=>o==null?void 0:o.close(),1500)):(r.textContent=t.error||"Failed to create deposit",setTimeout(()=>o==null?void 0:o.close(),3e3))}catch{r.textContent="Network error",setTimeout(()=>o==null?void 0:o.close(),3e3)}})}

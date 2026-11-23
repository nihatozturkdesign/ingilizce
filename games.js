/* v2: Oyunlar, hikâyeler, XP / rozetler, ilk açılış
   Ana script'teki yardımcıları ($, esc, S, save, render, speak, today, toast...) çalışma anında kullanır. */
"use strict";

/* ================== XP / SEVİYE / ROZET ================== */
function levelInfo(xp){
  const L = APP_DATA.LEVELS; let i = 0;
  while(i+1 < L.length && xp >= L[i+1][0]) i++;
  const cur = L[i], next = L[i+1];
  const pct = next ? Math.round(100*(xp-cur[0])/(next[0]-cur[0])) : 100;
  return {idx:i, name:cur[1], next: next ? next[1] : null, toNext: next ? next[0]-xp : 0, pct};
}
function addXP(n){
  if(!S.xp) S.xp = 0;
  const before = levelInfo(S.xp).idx;
  S.xp += n;
  const after = levelInfo(S.xp);
  if(after.idx > before) setTimeout(()=>toast("🎉 Seviye atladın: "+after.name+"!"), 900);
  checkBadges(); save();
}
function streak(){
  let d = today(); if(!isActive(d)) d = addDays(d,-1);
  let count = 0, miss = 0, guard = 0;
  while(guard++ < 400){
    if(isActive(d)){ count++; miss = 0; }
    else { miss++; if(miss >= 2) break; }
    d = addDays(d,-1);
  }
  return count;
}
function award(id){
  if(!S.badges) S.badges = {};
  if(S.badges[id]) return;
  S.badges[id] = today();
  const b = APP_DATA.BADGES.find(x=>x[0]===id);
  if(b) setTimeout(()=>toast("🏆 Yeni rozet: "+b[1]+" "+b[2]), 400);
}
function checkBadges(){
  const learned = S.cards.filter(c=>c.status!=="new").length;
  if(learned>=1) award("first_card");
  if(learned>=50) award("cards_50");
  if(learned>=100) award("cards_100");
  if(learned>=200) award("cards_200");
  const st = streak(); if(st>=7) award("streak_7"); if(st>=30) award("streak_30");
  const t=today(); const mon=addDays(t,-((parse(t).getDay()+6)%7)); let act=0; for(let i=0;i<7;i++) if(isActive(addDays(mon,i))) act++;
  if(act>=5) award("week_5");
  if(S.writings.length>=1) award("first_write");
  if(S.writings.length>=10) award("write_10");
  if(S.errors.length>=10) award("errors_10");
  const read = Object.keys(S.stories||{}).length;
  if(read>=1) award("story_1");
  if(read>=APP_DATA.STORIES.length) award("story_all");
  if(S.efset.length) award("efset");
  if(levelInfo(S.xp||0).idx>=3) award("level_usta");
}
function xpBar(){
  const L = levelInfo(S.xp||0), st = streak();
  return `<div class="card" style="padding:12px 16px">
    <div class="row"><b>🪵 ${esc(L.name)}</b><span class="sub">${S.xp||0} XP</span><span class="sp"></span><b>🔥 ${st} gün</b></div>
    <div class="progress" style="margin-top:8px"><div style="width:${L.pct}%"></div></div>
    <div class="hint" style="margin-top:4px">${L.next ? `${esc(L.next)} seviyesine ${L.toNext} XP kaldı` : "En üst seviyedesin!"}</div></div>`;
}
function badgesView(){
  const B = APP_DATA.BADGES; const got = S.badges||{};
  return `<div class="card"><h3>🏆 Rozetler (${Object.keys(got).length}/${B.length})</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin-top:8px">
    ${B.map(([id,ic,name,desc])=>`<div style="text-align:center;padding:8px 4px;border-radius:12px;background:var(--bg);${got[id]?"":"opacity:.35;filter:grayscale(1)"}" title="${esc(desc)}">
      <div style="font-size:28px">${ic}</div><div style="font-size:12px;font-weight:700">${esc(name)}</div><div style="font-size:11px;color:var(--mute)">${esc(desc)}</div></div>`).join("")}
    </div></div>`;
}

/* ================== YARDIMCI ================== */
const shuffle = a => { a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const pick = (a,n) => shuffle(a).slice(0,n);
const norm = s => String(s).toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9' ]/g," ").replace(/\s+/g," ").trim();
function wordDiff(expected, got){
  const E = norm(expected).split(" "), Gw = norm(got).split(" ").filter(Boolean);
  // LCS
  const m=E.length, n=Gw.length, dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--) for(let j=n-1;j>=0;j--) dp[i][j] = E[i]===Gw[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  const ok = new Set(); let i=0,j=0;
  while(i<m && j<n){ if(E[i]===Gw[j]){ ok.add(i); i++; j++; } else if(dp[i+1][j]>=dp[i][j+1]) i++; else j++; }
  const html = expected.split(/\s+/).map((w,k)=>`<span style="padding:1px 3px;border-radius:5px;${ok.has(k)?"background:var(--ok2);color:var(--ok)":"background:var(--warn2);color:var(--warn);font-weight:700"}">${esc(w)}</span>`).join(" ");
  return {score: m ? ok.size/m : 0, html};
}

/* ================== OYUNLAR ================== */
const GAMES = [
  {id:"quiz", ic:"🧠", name:"Kelime Testi", desc:"Kartlarından 10 soru. Yanlış yaptıkların yeniden tekrara girer."},
  {id:"verbs", ic:"⚡", name:"Fiil Avı", desc:"60 saniyede kaç düzensiz fiilin geçmiş halini yazabilirsin?"},
  {id:"build", ic:"🧩", name:"Cümle Kur", desc:"Karışık kelimeleri doğru sıraya diz. Türkçedeki 'fiil sonda' alışkanlığını kırar."},
  {id:"article", ic:"🅰️", name:"a / an / the", desc:"Boşluğa doğru article'ı seç."},
  {id:"dict", ic:"🎧", name:"Dikte", desc:"Cümleyi dinle ve yaz. Dinleme becerisi için en etkili oyun."},
  {id:"say", ic:"🗣️", name:"Sesli Söyle", desc:"Cümleyi söyle, telefon ne anladığını göstersin."},
  {id:"pairs", ic:"👂", name:"Ses Ayırt", desc:"think mi sink mi? Türklerin zorlandığı sesleri ayırt et."}
];
let G = null;
function startGame(id){
  const D2 = APP_DATA;
  if(id==="quiz"){
    let pool = S.cards.filter(c=>c.status!=="new");
    if(pool.length < 8) pool = S.cards.slice().sort((a,b)=>(a.order||0)-(b.order||0)).slice(0,40);
    const qs = pick(pool, Math.min(10,pool.length)).map((c,i)=>{
      const rev = i%2===1;
      const others = pick(S.cards.filter(x=>x.id!==c.id && x.tr!==c.tr), 3);
      const opts = shuffle([c].concat(others));
      return {c, rev, opts:opts.map(o=>rev?o.en:o.tr), ans:opts.indexOf(c)};
    });
    G = {id, qs, i:0, score:0, picked:null};
  }
  if(id==="verbs"){ G = {id, list:shuffle(D2.IRREGULAR), i:0, score:0, left:60, wrong:[], last:null, started:false}; }
  if(id==="build"){
    const qs = pick(D2.SENTENCES, 8).map(([en,tr])=>({en,tr, words: en.replace(/[.?!]$/,"").split(" ")}));
    qs.forEach(q=>{ q.pool = shuffle(q.words.map((w,k)=>({w,k}))); if(q.pool.every((x,k)=>x.k===k)) q.pool.reverse(); q.ans=[]; q.checked=null; });
    G = {id, qs, i:0, score:0};
  }
  if(id==="article"){ G = {id, qs:pick(D2.ARTICLES,10), i:0, score:0, picked:null}; }
  if(id==="dict"){ G = {id, qs:pick(D2.SENTENCES,6), i:0, score:0, res:null}; }
  if(id==="say"){
    const talk = (talkText(prog().month||1)).split(/(?<=[.!?])\s+/).filter(s=>s.split(" ").length>=3);
    const pool = talk.concat(D2.SENTENCES.map(s=>s[0]));
    G = {id, qs:pick(pool,6), i:0, score:0, res:null, listening:false};
  }
  if(id==="pairs"){
    const qs = pick(D2.PAIRS,10).map(p=>({p, target: Math.random()<.5?0:1}));
    G = {id, qs, i:0, score:0, picked:null};
  }
  render(); window.scrollTo(0,0);
  if(id==="dict") setTimeout(()=>speak(G.qs[0][0], .8),300);
  if(id==="pairs") setTimeout(()=>speak(G.qs[0].p[G.qs[0].target], .8),300);
}
function endGame(total){
  const perfect = G.score===total && total>=5;
  if(perfect) award("game_perfect");
  if(G.id==="verbs" && G.score>=15) award("verbs_15");
  addXP(G.score*2 + 5);
  if(!S.games) S.games = {};
  const g = S.games[G.id] || {played:0, best:0};
  g.played++; g.best = Math.max(g.best, G.score); S.games[G.id] = g;
  dayLog().listen = dayLog().listen; // aktiviteyi bozmadan
  dayLog().game = true; save();
  G.done = {total, perfect};
}
function gameHeader(total){
  const g = GAMES.find(x=>x.id===G.id);
  const pct = total ? Math.round(100*G.i/total) : 0;
  return `<div class="row"><button class="btn sm ghost" data-g="quit">✕</button><b class="sp">${g.ic} ${esc(g.name)}</b><span class="pill acc">${G.score} puan</span></div>
  <div class="progress" style="margin:8px 0 4px"><div style="width:${pct}%"></div></div>`;
}
function doneView(){
  const g = GAMES.find(x=>x.id===G.id); const d = G.done;
  return `<div class="card" style="text-align:center;padding:28px 16px"><div style="font-size:52px">${d.perfect?"🎯":G.score>=d.total*0.7?"🎉":"💪"}</div>
    <h2>${G.score} / ${d.total}</h2><p class="sub">+${G.score*2+5} XP · En iyi: ${(S.games[G.id]||{}).best||G.score}</p>
    <p>${d.perfect?"Kusursuz! Rozet kazandın.":G.score>=d.total*0.7?"Çok iyi gidiyorsun!":"Her deneme bir antrenman. Tekrar dene!"}</p>
    ${G.wrong&&G.wrong.length?`<div class="verbs" style="text-align:left;margin-top:10px"><b>Tekrar et:</b> ${G.wrong.map(v=>esc(v[0]+" → "+v[1])).join(" · ")}</div>`:""}
    <div class="row" style="justify-content:center;margin-top:14px"><button class="btn acc" data-g="again" data-id="${g.id}">Tekrar oyna</button><button class="btn" data-g="quit">Oyunlar</button></div></div>`;
}
function vGame(){
  if(G.done) return gameHeaderDone() + doneView();
  const D2 = APP_DATA;
  if(G.id==="quiz"){
    const q = G.qs[G.i], total = G.qs.length;
    return gameHeader(total) + `<div class="card flash" style="min-height:0">
      <div class="hint">${q.rev?"İngilizcesi hangisi?":"Türkçesi hangisi?"}</div>
      <div class="en" style="margin:8px 0">${esc(q.rev?q.c.tr:q.c.en)}</div>
      ${!q.rev?`<div><button class="btn sm" data-say="${esc(q.c.en)}">🔊</button></div>`:""}
      <div style="display:grid;gap:8px;margin-top:14px">${q.opts.map((o,k)=>{
        let st=""; if(G.picked!==null){ if(k===q.ans) st="background:var(--ok2);border-color:var(--ok);color:var(--ok)"; else if(k===G.picked) st="background:var(--warn2);border-color:var(--warn);color:var(--warn)"; }
        return `<button class="btn full" style="${st}" data-g="pick" data-k="${k}" ${G.picked!==null?"disabled":""}>${esc(o)}</button>`; }).join("")}</div>
      ${G.picked!==null?`<button class="btn pri full" style="margin-top:12px" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`:""}</div>`;
  }
  if(G.id==="verbs"){
    if(!G.started) return gameHeader(0) + `<div class="card" style="text-align:center"><div style="font-size:44px">⚡</div><h2>Fiil Avı</h2><p class="sub">Fiilin geçmiş halini yaz, Enter'a bas. 60 saniyen var!</p><p class="hint">Örnek: make → <b>made</b></p><button class="btn acc" data-g="vstart">Başla</button></div>`;
    const v = G.list[G.i % G.list.length];
    return gameHeader(0) + `<div class="card" style="text-align:center">
      <div class="big" id="vTime" style="color:${G.left<=10?"var(--warn)":"var(--ink)"}">${G.left}</div>
      <div class="hint">${esc(v[2])}</div><div class="en" style="font-size:34px;font-weight:700;margin:6px 0">${esc(v[0])} → ?</div>
      <input id="vIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="geçmiş hali..." style="text-align:center;font-size:20px">
      <button class="btn pri full" style="margin-top:8px" data-g="vcheck">Kontrol ✓</button>
      ${G.last?`<p style="margin-top:10px;color:${G.last.ok?"var(--ok)":"var(--warn)"};font-weight:700">${G.last.ok?"✓ Doğru!":"✗ Doğrusu: "+esc(G.last.v[0])+" → "+esc(G.last.v[1])}</p>`:""}
    </div>`;
  }
  if(G.id==="build"){
    const q = G.qs[G.i], total = G.qs.length;
    return gameHeader(total) + `<div class="card">
      <div class="hint">Bu cümleyi İngilizce kur:</div><h3 style="margin:4px 0 12px">“${esc(q.tr)}”</h3>
      <div style="min-height:54px;border:2px dashed var(--line);border-radius:12px;padding:8px;display:flex;flex-wrap:wrap;gap:6px;${q.checked===true?"border-color:var(--ok);background:var(--ok2)":q.checked===false?"border-color:var(--warn);background:var(--warn2)":""}">
        ${q.ans.map((x,k)=>`<button class="btn sm" data-g="unput" data-k="${k}" ${q.checked!==null?"disabled":""}>${esc(x.w)}</button>`).join("") || `<span class="hint">Aşağıdaki kelimelere sırayla dokun</span>`}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${q.pool.map((x,k)=>`<button class="btn sm" style="background:var(--acc2)" data-g="put" data-k="${k}" ${q.checked!==null?"disabled":""}>${esc(x.w)}</button>`).join("")}</div>
      ${q.checked===false?`<p style="margin-top:10px"><b>Doğrusu:</b> ${esc(q.en)}</p>`:""}
      ${q.checked===true?`<p style="margin-top:10px;color:var(--ok);font-weight:700">✓ Mükemmel!</p>`:""}
      <div class="row" style="margin-top:12px">${q.checked===null
        ? `<button class="btn pri" data-g="bcheck" ${q.pool.length?"disabled":""}>Kontrol et</button><button class="btn ghost sm" data-g="breset">Sıfırla</button>`
        : `<button class="btn sm" data-say="${esc(q.en)}">🔊 Dinle</button><span class="sp"></span><button class="btn pri" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`}</div></div>`;
  }
  if(G.id==="article"){
    const q = G.qs[G.i], total = G.qs.length; const opts = q[1].includes("/") ? [q[1], "the / a", "a / a", "the / The"] : ["a","an","the","–"];
    const ans = q[1].includes("/") ? 0 : ["a","an","the","–"].indexOf(q[1].toLowerCase());
    const optsShown = q[1].includes("/") ? shuffleOnce(q, opts) : opts;
    const ansIdx = q[1].includes("/") ? optsShown.indexOf(q[1]) : ans;
    return gameHeader(total) + `<div class="card">
      <div class="hint">Boşluğa ne gelmeli? (– = hiçbir şey)</div>
      <h2 style="margin:8px 0 14px">${esc(q[0]).replace(/___/g,'<span style="border-bottom:3px solid var(--acc);padding:0 14px">&nbsp;</span>')}</h2>
      <div class="rate">${optsShown.map((o,k)=>{ let st=""; if(G.picked!==null){ if(k===ansIdx) st="background:var(--ok2);border-color:var(--ok);color:var(--ok)"; else if(k===G.picked) st="background:var(--warn2);border-color:var(--warn);color:var(--warn)"; }
        return `<button style="${st}" data-g="apick" data-k="${k}" data-ans="${ansIdx}" ${G.picked!==null?"disabled":""}>${esc(o)}</button>`; }).join("")}</div>
      ${G.picked!==null?`<p class="${G.picked===ansIdx?"":"warn"}" style="margin-top:12px">${G.picked===ansIdx?"✓ ":"✗ "}${esc(q[2])}</p><button class="btn pri full" style="margin-top:10px" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`:""}</div>`;
  }
  if(G.id==="dict"){
    const q = G.qs[G.i], total = G.qs.length;
    return gameHeader(total) + `<div class="card">
      <div class="row wrap"><button class="btn acc" data-say="${esc(q[0])}">🔊 Dinle</button><button class="btn" data-g="dslow">🐢 Yavaş</button><span class="hint">İstediğin kadar dinleyebilirsin</span></div>
      <label>Duyduğunu yaz</label><textarea id="dIn" style="min-height:70px" autocapitalize="off" spellcheck="false" ${G.res?"disabled":""}>${esc(G.res?G.res.typed:"")}</textarea>
      ${G.res?`<div style="margin-top:10px;line-height:2">${G.res.html}</div><p class="hint">Türkçesi: ${esc(q[1])}</p>
        <p><b>${Math.round(G.res.score*100)}%</b> doğru ${G.res.score===1?"🎉":""}</p>
        <button class="btn pri full" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`
      : `<button class="btn pri full" style="margin-top:10px" data-g="dcheck">Kontrol et</button>`}</div>`;
  }
  if(G.id==="say"){
    const q = G.qs[G.i], total = G.qs.length; const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return gameHeader(total) + `<div class="card">
      <div class="hint">Bu cümleyi yüksek sesle söyle:</div><h2 style="margin:6px 0">${esc(q)}</h2>
      <div class="row wrap"><button class="btn sm" data-say="${esc(q)}">🔊 Önce dinle</button><button class="btn sm" data-sayslow="${esc(q)}">🐢 Yavaş</button></div>
      ${SR ? `<button class="rec ${G.listening?"on":""}" data-g="listen" style="background:${G.listening?"var(--warn)":"var(--acc)"}">${G.listening?"■":"🎤"}</button><p class="hint" style="text-align:center">${G.listening?"Dinliyorum... konuş":"Mikrofona bas ve söyle"}</p>`
        : `<p class="warn" style="margin-top:12px">Bu tarayıcı konuşma tanımayı desteklemiyor (Android'de Chrome ile çalışır). Yine de cümleyi sesli söyle, sonra 'Söyledim'e bas.</p>`}
      ${G.res?`<div style="margin-top:6px;line-height:2">${G.res.html}</div><p class="hint">Telefonun duyduğu: “${esc(G.res.heard)}”</p><p><b>${Math.round(G.res.score*100)}%</b> anlaşıldı</p>`:""}
      <div class="row" style="margin-top:10px">${!SR&&!G.res?`<button class="btn" data-g="saidok">Söyledim ✓</button>`:""}${G.res?`<button class="btn ghost sm" data-g="sayretry">Tekrar dene</button>`:""}<span class="sp"></span>${G.res||!SR?`<button class="btn pri" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`:""}</div>
      <p class="hint" style="margin-top:8px">Not: Kırmızı kelimeleri telefon anlayamadı. Onları kelime kartında 🔊 ile dinleyip tekrar dene.</p></div>`;
  }
  if(G.id==="pairs"){
    const q = G.qs[G.i], total = G.qs.length;
    return gameHeader(total) + `<div class="card" style="text-align:center">
      <div class="hint">Hangisini duydun?</div>
      <button class="btn acc" style="margin:12px auto" data-g="preplay">🔊 Tekrar dinle</button>
      <div class="rate" style="grid-template-columns:1fr 1fr">${q.p.slice(0,2).map((w,k)=>{ let st=""; if(G.picked!==null){ if(k===q.target) st="background:var(--ok2);border-color:var(--ok);color:var(--ok)"; else if(k===G.picked) st="background:var(--warn2);border-color:var(--warn);color:var(--warn)"; }
        return `<button style="font-size:22px;padding:18px 4px;${st}" data-g="ppick" data-k="${k}" ${G.picked!==null?"disabled":""}>${esc(w)}</button>`; }).join("")}</div>
      ${G.picked!==null?`<p class="hint" style="margin-top:12px">💡 ${esc(q.p[2])}</p><div class="row" style="justify-content:center"><button class="btn sm" data-say="${esc(q.p[0])}">🔊 ${esc(q.p[0])}</button><button class="btn sm" data-say="${esc(q.p[1])}">🔊 ${esc(q.p[1])}</button></div>
        <button class="btn pri full" style="margin-top:12px" data-g="next">${G.i+1<total?"Sonraki →":"Bitir"}</button>`:""}
      <p class="hint" style="margin-top:12px">Ses telefonunun İngilizce sesiyle çalınır. Çok benzer geliyorsa normal: kulağın zamanla alışacak.</p></div>`;
  }
  return "";
}
const _sh = new WeakMap();
function shuffleOnce(key, arr){ if(!_sh.has(key)) _sh.set(key, shuffle(arr)); return _sh.get(key); }
function gameHeaderDone(){ const g = GAMES.find(x=>x.id===G.id); return `<div class="row"><button class="btn sm ghost" data-g="quit">✕</button><b class="sp">${g.ic} ${esc(g.name)}</b></div>`; }

let verbTimer = null;
function verbTick(){
  clearInterval(verbTimer);
  verbTimer = setInterval(()=>{
    if(!G || G.id!=="verbs"){ clearInterval(verbTimer); return; }
    G.left--; const el=$("#vTime"); if(el){ el.textContent=G.left; if(G.left<=10) el.style.color="var(--warn)"; }
    if(G.left<=0){ clearInterval(verbTimer); endGame(G.score); render(); }
  },1000);
}
function verbCheck(){
  const el = $("#vIn"); if(!el) return; const val = norm(el.value); if(!val) return;
  const v = G.list[G.i % G.list.length]; const ok = v[1].split("/").map(s=>norm(s)).includes(val);
  if(ok) G.score++; else G.wrong.push(v);
  G.last = {ok, v}; G.i++; render(); const n=$("#vIn"); if(n) n.focus();
}
let recog = null;
function sayListen(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR) return;
  if(G.listening && recog){ try{ recog.stop(); }catch(e){} return; }
  recog = new SR(); recog.lang = S.settings.accent; recog.interimResults = false; recog.maxAlternatives = 3;
  recog.onresult = e => {
    const q = G.qs[G.i]; let best = null;
    for(const alt of e.results[0]){ const r = wordDiff(q, alt.transcript); if(!best || r.score>best.score) best = Object.assign(r,{heard:alt.transcript}); }
    if(G.res && G.res.score>=0.8) G.score--;
    G.res = best; if(best.score>=0.8) G.score++; G.listening=false; render();
  };
  recog.onerror = e => { G.listening=false; render(); toast(e.error==="not-allowed"?"Mikrofon izni gerekli":"Duyamadım, tekrar dene"); };
  recog.onend = () => { if(G.listening){ G.listening=false; render(); } };
  try{ recog.start(); G.listening = true; render(); }catch(e){ toast("Başlatılamadı"); }
}

document.addEventListener("click", e=>{
  const b = e.target.closest("[data-g]"); if(!b) return;
  const a = b.dataset.g, k = +b.dataset.k;
  switch(a){
    case "start": startGame(b.dataset.id); return;
    case "again": startGame(b.dataset.id); return;
    case "quit": clearInterval(verbTimer); try{ recog&&recog.stop(); }catch(e){} G=null; render(); return;
    case "pick": { const q=G.qs[G.i]; G.picked=k; if(k===q.ans) G.score++; else if(q.c.status!=="new"){ q.c.due=today(); save(); } speak(q.c.en); render(); return; }
    case "apick": { G.picked=k; if(k===+b.dataset.ans) G.score++; render(); return; }
    case "ppick": { const q=G.qs[G.i]; G.picked=k; if(k===q.target) G.score++; render(); return; }
    case "preplay": { const q=G.qs[G.i]; speak(q.p[q.target], .8); return; }
    case "next": {
      const total = G.qs.length; G.i++; G.picked=null; G.res=null;
      if(G.i>=total){ endGame(total); }
      render(); window.scrollTo(0,0);
      if(!G.done && G.id==="dict") setTimeout(()=>speak(G.qs[G.i][0], .8),250);
      if(!G.done && G.id==="pairs") setTimeout(()=>{ const q=G.qs[G.i]; speak(q.p[q.target], .8); },250);
      return; }
    case "vstart": G.started=true; render(); verbTick(); setTimeout(()=>$("#vIn")&&$("#vIn").focus(),50); return;
    case "vcheck": verbCheck(); return;
    case "put": { const q=G.qs[G.i]; q.ans.push(q.pool.splice(k,1)[0]); render(); return; }
    case "unput": { const q=G.qs[G.i]; q.pool.push(q.ans.splice(k,1)[0]); render(); return; }
    case "breset": { const q=G.qs[G.i]; q.pool = shuffle(q.pool.concat(q.ans)); q.ans=[]; render(); return; }
    case "bcheck": { const q=G.qs[G.i]; const ok = norm(q.ans.map(x=>x.w).join(" "))===norm(q.words.join(" ")); q.checked=ok; if(ok) G.score++; speak(q.en); render(); return; }
    case "dslow": speak(G.qs[G.i][0], .6); return;
    case "dcheck": { const typed=$("#dIn").value; if(!typed.trim()){ toast("Önce yaz"); return; } const r=wordDiff(G.qs[G.i][0], typed); G.res=Object.assign(r,{typed}); if(r.score>=0.9) G.score++; render(); return; }
    case "listen": sayListen(); return;
    case "sayretry": { if(G.res && G.res.score>=0.8) G.score--; G.res=null; render(); return; }
    case "saidok": G.score++; G.res={html:"",heard:"(sesli söylendi)",score:1}; render(); return;
    case "story": openStory(b.dataset.id); return;
    case "closestory": ST=null; render(); return;
    case "readall": { const s=APP_DATA.STORIES.find(x=>x.id===ST.id); speak(s.paras.join(" "), Math.max(.6,S.settings.rate-.1)); return; }
    case "readp": { const s=APP_DATA.STORIES.find(x=>x.id===ST.id); speak(s.paras[k], Math.max(.6,S.settings.rate-.1)); return; }
    case "word": { ST.word = {w:b.dataset.w, sent:b.dataset.s}; renderWordBar(); speak(b.dataset.w); return; }
    case "wordcard": { const w=ST.word; editCardId="new"; view="cards"; ST.prefill = w; render(); setTimeout(()=>{ $("#f_en").value=w.w; $("#f_ex").value=w.sent; const gl=APP_DATA.STORIES.find(x=>x.id===ST.id).gloss.find(g=>norm(g[0])===norm(w.w)); if(gl) $("#f_tr").value=gl[1]; $("#f_tr").focus(); },30); return; }
    case "sq": { const s=APP_DATA.STORIES.find(x=>x.id===ST.id); ST.ans[+b.dataset.q]=k; render(); return; }
    case "sfinish": { const s=APP_DATA.STORIES.find(x=>x.id===ST.id); const sc=s.qs.filter((q,i)=>ST.ans[i]===q[2]).length;
      if(!S.stories) S.stories={}; const first=!S.stories[s.id]; S.stories[s.id]={date:today(),score:sc}; ST.result=sc; dayLog().story=true; addXP(first?15+sc*3:sc*2); render(); return; }
    case "talkedit": TE = true; render(); return;
    case "talksave": { const m=+b.dataset.m; if(!S.talkOverride) S.talkOverride={}; S.talkOverride[m]=$("#talkEditIn").value.trim(); TE=false; save(); render(); toast("Metnin kaydedildi ✓"); return; }
    case "talkreset": { const m=+b.dataset.m; if(S.talkOverride) delete S.talkOverride[m]; TE=false; save(); render(); return; }
    case "share": { copyText(`İngilizce çalışmak için ücretsiz bir uygulama kullanıyorum: kelime kartları, oyunlar, hikâyeler, gramer ve günlük program. İnternetsiz de çalışıyor. Telefonuna ana ekran uygulaması olarak ekleyebilirsin: ${location.href.split("#")[0]}`); return; }
    case "onboard": {
      const n=$("#ob_name").value.trim(); if(!n){ toast("Adını yaz"); return; }
      S.settings.name=n; S.settings.start=$("#ob_start").value||today(); S.settings.newPerDay=+$("#ob_new").value||5;
      const intro=$("#ob_intro").value.trim(); if(intro){ if(!S.talkOverride) S.talkOverride={}; S.talkOverride[1]=intro; }
      S.profile=Object.assign(S.profile||{}, {onboarded:true}); save(); view="today"; render(); toast("Hoş geldin "+n+"! 🎉"); return; }
  }
});
document.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.id==="vIn"){ e.preventDefault(); verbCheck(); } });

/* ================== HİKÂYELER ================== */
let ST = null, TE = false;
function openStory(id){ ST = {id, ans:{}, result:null, word:null}; view="play"; render(); window.scrollTo(0,0); }
function vStory(){
  const s = APP_DATA.STORIES.find(x=>x.id===ST.id);
  const wordify = (p, pi) => p.split(/(\s+)/).map(tok=>{ if(/^\s+$/.test(tok)) return tok;
    const clean = tok.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g,""); if(!clean) return esc(tok);
    const sent = (p.match(new RegExp("[^.!?]*\\b"+clean.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b[^.!?]*[.!?]"))||[p])[0].trim();
    return tok.replace(clean, `<span class="w" data-g="word" data-w="${esc(clean)}" data-s="${esc(sent)}">${esc(clean)}</span>`); }).join("");
  const done = S.stories && S.stories[s.id];
  return `<div class="row"><button class="btn sm ghost" data-g="closestory">← Hikâyeler</button><span class="sp"></span><span class="pill">${s.level}</span></div>
  <h1 style="margin-top:10px">${esc(s.title)}</h1>
  <div class="row wrap" style="margin:6px 0 4px"><button class="btn acc sm" data-g="readall">🔊 Tümünü dinle</button><button class="btn ghost sm" data-act="stopsay">⏹ Durdur</button></div>
  <p class="hint">Bilmediğin kelimeye dokun → anlamını gör, dinle, karta ekle. İlk okumada sözlüğe bakmadan anlamaya çalış.</p>
  <div class="card story">${s.paras.map((p,i)=>`<p>${wordify(p,i)} <button class="btn sm ghost" data-g="readp" data-k="${i}" aria-label="Paragrafı dinle">🔊</button></p>`).join("")}</div>
  <details class="card"><summary><span class="chev">›</span>📒 Sözlükçe (${s.gloss.length} kelime)</summary><div class="list" style="margin-top:6px">${s.gloss.map(([w,t])=>`<div class="it"><button class="btn sm ghost" data-say="${esc(w)}">🔊</button><div class="t"><b>${esc(w)}</b><span class="sub">${esc(t)}</span></div></div>`).join("")}</div></details>
  <div class="card"><h3>❓ Anladın mı?</h3>${s.qs.map((q,qi)=>`<p style="margin-top:12px"><b>${qi+1}. ${esc(q[0])}</b></p><div style="display:grid;gap:6px">${q[1].map((o,k)=>{
      let st=""; const a=ST.ans[qi]; if(ST.result!==null){ if(k===q[2]) st="background:var(--ok2);border-color:var(--ok);color:var(--ok)"; else if(a===k) st="background:var(--warn2);border-color:var(--warn);color:var(--warn)"; } else if(a===k) st="background:var(--acc2);border-color:var(--acc)";
      return `<button class="btn full" style="justify-content:flex-start;${st}" data-g="sq" data-q="${qi}" data-k="${k}" ${ST.result!==null?"disabled":""}>${esc(o)}</button>`; }).join("")}</div>`).join("")}
    ${ST.result===null ? `<button class="btn pri full" style="margin-top:14px" data-g="sfinish" ${Object.keys(ST.ans).length<s.qs.length?"disabled":""}>Cevapları kontrol et</button>`
      : `<p style="margin-top:14px;font-weight:700">${ST.result}/${s.qs.length} doğru ${ST.result===s.qs.length?"🎉":""}</p><p class="hint">Sonraki adım: hikâyeyi bir kez de 🔊 ile dinleyerek oku, sonra en sevdiğin paragrafı sesli oku ve kaydet.</p>`}
    ${done && ST.result===null ? `<p class="hint" style="margin-top:8px">Daha önce okudun (${done.score}/${s.qs.length}).</p>`:""}
  </div><div id="wordBar"></div>`;
}
function renderWordBar(){
  const el = $("#wordBar"); if(!el || !ST || !ST.word) return;
  const s = APP_DATA.STORIES.find(x=>x.id===ST.id); const w = ST.word;
  const gl = s.gloss.find(g=>norm(g[0])===norm(w.w)) || s.gloss.find(g=>norm(g[0]).split(" ").includes(norm(w.w)));
  const card = S.cards.find(c=>norm(c.en.split(/[–\/]/)[0])===norm(w.w));
  const tr = gl ? gl[1] : card ? card.tr : null;
  el.innerHTML = `<div style="position:fixed;left:12px;right:12px;bottom:calc(76px + var(--safe-b));z-index:15;max-width:616px;margin:0 auto" class="card">
    <div class="row"><b style="font-size:20px">${esc(w.w)}</b><button class="btn sm ghost" data-say="${esc(w.w)}">🔊</button><span class="sp"></span><button class="btn sm ghost" onclick="this.closest('#wordBar').innerHTML=''">✕</button></div>
    <p>${tr?esc(tr):`<span class="hint">Bu kelime sözlükçede yok.</span> <a href="https://dictionary.cambridge.org/dictionary/english-turkish/${encodeURIComponent(w.w.toLowerCase())}" target="_blank" rel="noopener">Sözlükte aç ↗</a>`}</p>
    ${card?`<p class="hint">✓ Bu kelime zaten kartlarında var.</p>`:`<button class="btn acc sm" data-g="wordcard">＋ Karta ekle</button>`}</div>`;
}

/* ================== OYNA SEKMESİ ================== */
function vPlay(){
  if(ST) return vStory();
  if(G) return vGame();
  const p = prog(); const wk = p.before?1:p.week;
  const rec = APP_DATA.STORIES.find(s=>s.week===((wk-1)%APP_DATA.STORIES.length)+1);
  return `<h1>Oyna</h1><p class="sub">Öğrenmenin eğlenceli kısmı. Her oyun XP kazandırır.</p>
  ${xpBar()}
  <h2>🎮 Oyunlar</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${GAMES.map(g=>{ const st=(S.games||{})[g.id];
    return `<button class="card" style="margin:0;text-align:left;cursor:pointer;font:inherit;color:inherit" data-g="start" data-id="${g.id}">
      <div style="font-size:30px">${g.ic}</div><b>${esc(g.name)}</b><div class="hint" style="margin-top:4px">${esc(g.desc)}</div>
      ${st?`<div class="pill ok" style="margin-top:6px">En iyi: ${st.best}</div>`:""}</button>`; }).join("")}</div>
  <h2>📖 Hikâyeler</h2>
  <p class="sub">Kısa A2 hikâyeleri: dinle, oku, dokunduğun kelimeyi karta ekle. Bu haftanın hikâyesi: <b>${esc(rec.title)}</b></p>
  <div class="card list">${APP_DATA.STORIES.map(s=>{ const d=S.stories&&S.stories[s.id];
    return `<div class="it"><div class="t"><b>${esc(s.title)}</b><span class="sub">${s.level} · ${s.paras.join(" ").split(" ").length} kelime${s.id===rec.id?" · bu hafta":""}</span></div>
      ${d?`<span class="pill ok">✓ ${d.score}/${s.qs.length}</span>`:""}<button class="btn sm ${s.id===rec.id&&!d?"acc":""}" data-g="story" data-id="${s.id}">Oku</button></div>`; }).join("")}</div>`;
}

/* ================== İLK AÇILIŞ ================== */
function vOnboard(){
  return `<div style="text-align:center;margin-top:20px"><div style="font-size:56px">👋</div><h1>Hoş geldin!</h1>
  <p class="sub">Günde 20 dakikayla İngilizce: kelime kartları, oyunlar, hikâyeler, gramer ve günlük program. Tamamen ücretsiz, internetsiz de çalışır.</p></div>
  <div class="card">
    <label>Adın</label><input id="ob_name" placeholder="Adın" value="">
    <label>Ne zaman başlıyorsun?</label><input id="ob_start" type="date" value="${today()}">
    <label>Günde kaç yeni kelime?</label><select id="ob_new"><option value="3">3: çok yoğunum</option><option value="5" selected>5: önerilen</option><option value="8">8: hızlı gitmek istiyorum</option></select>
    <label>Kendini 3–5 cümleyle tanıt (isteğe bağlı)</label>
    <textarea id="ob_intro" style="min-height:90px" placeholder="Hello, I'm ... I work as ... I love ... because ..."></textarea>
    <p class="hint">Bu metin 1. ayın sunum metnin olur: her gün dinleyip tekrar edeceksin. Boş bırakırsan örnek metin kullanılır, sonra düzenleyebilirsin.</p>
    <button class="btn acc full" style="margin-top:12px" data-g="onboard">Başlayalım →</button>
  </div>
  <div class="card"><h3>Nasıl çalışır?</h3><ul class="steps"><li>☕ Sabah 5–10 dk: kelime kartları (kendi hafıza kodunla)</li><li>🎧 Gün içinde: kulaklıkla dinleme</li><li>🌙 Akşam 10–15 dk: günün görevi</li><li>🎮 İstediğin zaman: oyunlar ve hikâyeler</li></ul><p class="hint">Haftada 5 gün yeterli. Verilerin sadece bu telefonda kalır.</p></div>`;
}

/* Sunum metni: kullanıcının düzenlediği ya da varsayılan */
function talkText(m){
  m = Math.max(1, Math.min(6, m||1));
  if(S.talkOverride && S.talkOverride[m]) return S.talkOverride[m];
  const t = APP_DATA.TALKS.find(x=>x.month===m).text;
  return t.replace(/\bNihat\b/g, S.settings.name || "Nihat");
}

/* Bugün ekranı için bonus öneri */
function bonusCard(){
  const wd = parse(today()).getDay();
  const pickId = ["story","build","pairs","article","dict","verbs","say"][wd];
  const p = prog(); const wk = p.before?1:p.week;
  const story = APP_DATA.STORIES.find(s=>s.week===((wk-1)%APP_DATA.STORIES.length)+1);
  const playedToday = dayLog().game || dayLog().story;
  if(pickId==="story"){
    return `<div class="card task ${playedToday?"done":""}"><div class="ic">📖</div><div class="body"><h3>Bonus (5 dk): Hikâye</h3>
      <div class="sub">Bu haftanın hikâyesi: <b>${esc(story.title)}</b>. Dinle, oku, 3 soruyu cevapla.</div>
      <button class="btn sm" style="margin-top:8px" data-g="story" data-id="${story.id}">Oku</button></div></div>`;
  }
  const g = GAMES.find(x=>x.id===pickId);
  return `<div class="card task ${playedToday?"done":""}"><div class="ic">${g.ic}</div><div class="body"><h3>Bonus (5 dk): ${esc(g.name)}</h3>
    <div class="sub">${esc(g.desc)}</div>
    <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-g="start" data-id="${g.id}" onclick="view='play'">Oyna</button><button class="btn sm ghost" data-g="story" data-id="${story.id}">📖 ${esc(story.title)}</button></div></div></div>`;
}

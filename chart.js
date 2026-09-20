(function (w) {
  function teh() {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit"
    });
    const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { h: +p.hour, min: +p.minute, sec: +p.second, day: p.year + "-" + p.month + "-" + p.day };
  }
  function slot() {
    const t = teh();
    return t.min - (t.min % 10);
  }
  function blockId() {
    const t = teh();
    return t.day + "-" + String(t.h).padStart(2, "0") + String(slot()).padStart(2, "0");
  }
  function elapsedMin() {
    const t = teh();
    return (t.min % 10) + t.sec / 60;
  }
  function goalOf(st) {
    const g = parseInt(st && st.goal, 10);
    return Number.isFinite(g) && g > 0 ? g : 40;
  }
  function targetAt(min, goal) {
    return goal * Math.min(1, Math.max(0, min / 10));
  }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    s = String(s || "taha");
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function aryaSeries(goal, elapsed, block) {
    goal = goalOf({ goal: goal });
    const rng = mulberry32(hashStr(block || "b"));
    const kind = (rng() * 6) | 0;
    const ph = rng() * 8;
    function k(m) {
      if (kind === 0) return m < 3.5 ? 0.55 + m * 0.12 : 1.05 + 0.18 * Math.sin(m);
      if (kind === 1) return 1.22 - m * 0.03 + 0.08 * Math.sin(m * 0.7);
      if (kind === 2) return 1.07 + 0.28 * Math.sin((m + ph) / 2.2);
      if (kind === 3) return m < 6 ? 0.58 + m * 0.06 : 0.9 + (m - 6) * 0.12;
      if (kind === 4) return 1.18 - 0.4 * Math.exp(-((m - 5) * (m - 5)) / 4);
      return 1.07 + 0.22 * Math.sin((m + ph) / 1.8) - 0.1 * Math.sin(m);
    }
    const maxT = Math.max(0, Math.min(10, elapsed));
    const pts = [];
    let v = 0;
    for (let m = 0; m <= maxT + 0.001; m += 0.25) {
      const gold = targetAt(m, goal);
      const target = gold * k(m);
      v = m === 0 ? target : v + (target - v) * 0.4;
      pts.push({ min: m, score: Math.max(0, Math.round(v)) });
    }
    if (!pts.length) pts.push({ min: 0, score: 0 });
    let sg = 0, sa = 0;
    pts.forEach((p) => {
      const gold = targetAt(p.min, goal);
      if (gold > 0.2) { sg += gold; sa += p.score; }
    });
    const scale = sg && sa ? (1.07 * sg) / sa : 1;
    return pts.map((p) => ({ min: p.min, score: Math.max(0, Math.round(p.score * scale)) }));
  }
  function analyze(score, history, goal, arya) {
    goal = goalOf({ goal: goal });
    const el = elapsedMin();
    const exp = targetAt(el, goal);
    const aryaNow = arya && arya.length ? arya[arya.length - 1].score : Math.round(exp * 1.07);
    const vs = score - aryaNow;
    const left = Math.max(0, goal - score);
    const rm = Math.max(0, 10 - el);
    let mood, cls;
    if (score >= goal) {
      mood = "ده دقیقه مال توئه. طاها جا موند. پادشاه همین اسلاتی.";
      cls = "ahead";
    } else if (vs >= 3) {
      mood = "از طاها جلویی · " + Math.round(vs) + " امتیاز. فشار را نگه دار.";
      cls = "ahead";
    } else if (vs <= -3) {
      mood = "طاها جلو زد · " + Math.round(-vs) + " عقب. بجنب ردش کن.";
      cls = "behind";
    } else {
      mood = "گردن‌به‌گردن با طاها. این ده دقیقه هنوز زنده است.";
      cls = "ok";
    }
    return { el, exp, vs, left, rm, mood, cls, score, history: history || [], goal, arya: arya || [], aryaNow };
  }
  function drawChart(canvas, A) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 170;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 28, padR = 10, padT = 12, padB = 22;
    const aryaMax = (A.arya || []).reduce((m, p) => Math.max(m, p.score), 0);
    const maxY = Math.max(A.goal, A.score, aryaMax, 8);
    const maxX = 10;
    function xOf(m) { return padL + (Math.max(0, Math.min(maxX, m)) / maxX) * (w - padL - padR); }
    function yOf(v) { return h - padB - (Math.max(0, Math.min(maxY, v)) / maxY) * (h - padT - padB); }
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    [0, A.goal / 2, A.goal].forEach((v) => {
      ctx.beginPath(); ctx.moveTo(padL, yOf(v)); ctx.lineTo(w - padR, yOf(v)); ctx.stroke();
    });
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "12px Tahoma";
    ctx.fillText(String(A.goal), 4, yOf(A.goal) + 4);
    ctx.fillText("۰", xOf(0), h - 6);
    ctx.fillText("۱۰د", xOf(10) - 22, h - 6);
    ctx.strokeStyle = "rgba(253,224,71,.95)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    ctx.lineTo(xOf(10), yOf(A.goal));
    ctx.stroke();
    ctx.setLineDash([]);
    function line(pts, color, lastMin, lastScore, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let s = false;
      (pts || []).forEach((pt) => {
        const x = xOf(pt.min), y = yOf(pt.score);
        if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
      });
      ctx.lineTo(xOf(lastMin), yOf(lastScore));
      ctx.stroke();
    }
    line(A.arya, "#fb7185", A.el, A.aryaNow, 3.6);
    line(A.history, "#67e8f9", A.el, A.score, 3.2);
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.score), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.aryaNow), 6, 0, Math.PI * 2); ctx.fill();
  }
  w.drawMission = function (st, ids) {
    const score = +st.score || 0;
    const goal = goalOf(st);
    const el = elapsedMin();
    const arya = aryaSeries(goal, el, st.block || blockId());
    const A = analyze(score, st.history, goal, arya);
    const n = document.getElementById(ids.n);
    const tag = document.getElementById(ids.tag);
    const h = document.getElementById(ids.h);
    const s = document.getElementById(ids.s);
    if (n) n.textContent = score;
    if (tag) {
      tag.className = "tag " + A.cls;
      tag.textContent = A.vs >= 3 ? "جلوی طاها" : A.vs <= -3 ? "طاها جلوست" : "گردن‌به‌گردن";
    }
    if (h) h.textContent = A.mood;
    if (s) s.textContent = "علی " + score + " · طاها " + A.aryaNow + " · هدف ۱۰د " + A.goal + " · طلایی " + Math.round(A.exp);
    drawChart(document.getElementById(ids.chart), A);
    return A;
  };
  w.missionMath = { teh, elapsedMin, targetAt, analyze, goalOf, aryaSeries, blockId, slot };
})(window);

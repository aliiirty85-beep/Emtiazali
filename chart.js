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
  function blockStartHour() {
    const t = teh();
    return t.h - (t.h % 2);
  }
  function elapsedMin() {
    const t = teh();
    const s = blockStartHour();
    return (t.h - s) * 60 + t.min + t.sec / 60;
  }
  function goalOf(st) {
    const g = parseInt(st && st.goal, 10);
    return Number.isFinite(g) && g > 0 ? g : 250;
  }
  function targetAt(min, goal) {
    return goal * Math.min(1, Math.max(0, min / 120));
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
  function lerp(a, b, t) { t = Math.max(0, Math.min(1, t)); return a + (b - a) * (t * t * (3 - 2 * t)); }
  function aryaSeries(goal, elapsed, block, seed) {
    goal = goalOf({ goal: goal });
    const rng = mulberry32(hashStr(String(block || "b") + "|" + String(seed || block || "b")));
    const kind = (rng() * 6) | 0;
    const a = 0.15 + rng() * 0.12;
    const b = 18 + rng() * 20;
    const c = 55 + rng() * 30;
    function k(m) {
      const g = 1;
      if (kind === 0) {
        return (m < 40 ? 0.55 + m / 40 * 0.4 : 0.95 + 0.2 * Math.sin((m - 40) / 35)) + 0.06;
      }
      if (kind === 1) {
        return (m < 25 ? 1.28 - m / 25 * 0.15 : 1.05 - 0.18 * Math.max(0, Math.sin((m - 50) / 22))) + 0.04;
      }
      if (kind === 2) {
        return 1.06 + 0.22 * Math.sin(m / 28) * Math.sin(m / 70);
      }
      if (kind === 3) {
        return m < 70 ? 0.62 + m / 70 * 0.2 : 0.82 + (m - 70) / 50 * 0.45;
      }
      if (kind === 4) {
        const dip = Math.exp(-((m - c) * (m - c)) / (2 * 14 * 14));
        return 1.12 - 0.35 * dip;
      }
      return 1.06 + 0.24 * Math.sin((m + b) / 32) - 0.12 * Math.sin((m + b) / 19);
    }
    const maxT = Math.max(0, Math.min(120, elapsed));
    const pts = [];
    let v = 0;
    for (let m = 0; m <= maxT + 0.01; m += 2) {
      const gold = targetAt(m, goal);
      let mul = k(m);
      mul = 0.4 + 0.85 * (mul - 0.4);
      const target = gold * mul;
      v = m === 0 ? target : v + (target - v) * 0.34;
      pts.push({ min: m, score: Math.max(0, Math.round(v)) });
    }
    if (!pts.length) pts.push({ min: 0, score: 0 });
    let sg = 0, sa = 0;
    pts.forEach((p) => {
      const gold = targetAt(p.min, goal);
      if (gold > 1) { sg += gold; sa += p.score; }
    });
    const scale = sg && sa ? (1.07 * sg) / sa : 1;
    return pts.map((p) => ({ min: p.min, score: Math.max(0, Math.round(p.score * scale)) }));
  }
  function analyze(score, history, goal, arya) {
    goal = goalOf({ goal: goal });
    const t = teh();
    const start = blockStartHour();
    const el = elapsedMin();
    const exp = targetAt(el, goal);
    const gap = score - exp;
    const left = Math.max(0, goal - score);
    const rm = Math.max(0, 120 - el);
    const need = rm > 0.2 ? left / rm : left;
    const aryaNow = arya && arya.length ? arya[arya.length - 1].score : Math.round(exp * 1.06);
    const vs = score - aryaNow;
    let mood, cls;
    if (score >= goal) {
      mood = "پادشاه افسانه‌ای. طاها هم داره می‌دوه ولی تاج مال توئه.";
      cls = "ahead";
    } else if (vs >= 8) {
      mood = "از طاها جلویی. " + Math.round(vs) + " امتیاز. نگهش دار.";
      cls = "ahead";
    } else if (vs <= -8) {
      mood = "طاها جلو زد. " + Math.round(-vs) + " امتیاز عقب. بجنب ردش کن.";
      cls = "behind";
    } else if (gap >= -8) {
      mood = "نزدیک طاها و روی خط طلایی. رقابت زنده است.";
      cls = "ok";
    } else {
      mood = "عقب از تابع و طاها. حدود " + need.toFixed(1) + " امتیاز در دقیقه تا پادشاه (" + goal + ").";
      cls = "behind";
    }
    return { t, start, el, exp, gap, left, rm, need, mood, cls, score, history: history || [], goal, arya: arya || [], aryaNow, vs };
  }
  function drawChart(canvas, A) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 28, padR = 10, padT = 12, padB = 22;
    const aryaMax = (A.arya || []).reduce((m, p) => Math.max(m, p.score), 0);
    const maxY = Math.max(A.goal, A.score, aryaMax, 10);
    const maxX = 120;
    function xOf(m) { return padL + (Math.max(0, Math.min(maxX, m)) / maxX) * (w - padL - padR); }
    function yOf(v) { return h - padB - (Math.max(0, Math.min(maxY, v)) / maxY) * (h - padT - padB); }
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 1;
    [0, A.goal / 2, A.goal].forEach((v) => {
      ctx.beginPath(); ctx.moveTo(padL, yOf(v)); ctx.lineTo(w - padR, yOf(v)); ctx.stroke();
    });
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "12px Tahoma";
    ctx.fillText(String(A.goal), 4, yOf(A.goal) - 2);
    ctx.fillText("۰د", xOf(0), h - 6);
    ctx.fillText("۱۲۰د", xOf(120) - 26, h - 6);
    ctx.strokeStyle = "rgba(253,224,71,.9)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    ctx.lineTo(xOf(120), yOf(A.goal));
    ctx.stroke();
    ctx.setLineDash([]);
    function line(pts, color, lastMin, lastScore, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let s = false;
      (pts || []).forEach((pt) => {
        const x = xOf(pt.min), y = yOf(pt.score);
        if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
      });
      ctx.lineTo(xOf(lastMin), yOf(lastScore));
      ctx.stroke();
    }
    line(A.arya, "#fb7185", A.el, A.aryaNow, 3.4);
    line(A.history, "#67e8f9", A.el, A.score, 3);
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.score), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.aryaNow), 6, 0, Math.PI * 2); ctx.fill();
  }
  w.drawMission = function (st, ids) {
    const score = +st.score || 0;
    const goal = goalOf(st);
    const el = elapsedMin();
    const arya = aryaSeries(goal, el, st.block, st.seed || st.block);
    const A = analyze(score, st.history, goal, arya);
    const n = document.getElementById(ids.n);
    const tag = document.getElementById(ids.tag);
    const h = document.getElementById(ids.h);
    const s = document.getElementById(ids.s);
    if (n) n.textContent = score;
    if (tag) {
      tag.className = "tag " + A.cls;
      tag.textContent = A.vs >= 8 ? "جلوی طاها" : A.vs <= -8 ? "طاها جلوست" : "رقابت نزدیک";
    }
    if (h) h.textContent = A.mood;
    if (s) s.textContent = "علی " + score + " · طاها " + A.aryaNow + " · هدف " + A.goal + " · طلایی " + Math.round(A.exp);
    drawChart(document.getElementById(ids.chart), A);
    return A;
  };
  w.missionMath = { teh, blockStartHour, elapsedMin, targetAt, analyze, goalOf, aryaSeries };
})(window);

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
    if (t.h < 8 || t.h >= 24) return null;
    return t.h - (t.h % 2);
  }
  function elapsedMin() {
    const t = teh();
    const s = blockStartHour();
    if (s == null) return 0;
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
    s = String(s || "arya");
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function aryaSeries(goal, elapsed, block) {
    goal = goalOf({ goal: goal });
    const rng = mulberry32(hashStr(block || "b"));
    const pts = [];
    let wobble = 0;
    const maxT = Math.max(0, Math.min(120, elapsed));
    for (let m = 0; m <= maxT + 0.01; m += 1.5) {
      wobble += (rng() - 0.47) * 0.035;
      wobble *= 0.9;
      const base = targetAt(m, goal) * 1.06;
      const wave = Math.sin(m / 11 + 0.7) * goal * 0.028;
      const dip = Math.sin(m / 23) * goal * 0.02;
      const noise = (rng() - 0.5) * goal * 0.022;
      let v = base + wave - dip + noise + wobble * goal;
      v = Math.max(0, Math.round(v));
      pts.push({ min: m, score: v });
    }
    if (!pts.length) pts.push({ min: 0, score: 0 });
    return pts;
  }
  function analyze(score, history, goal, arya) {
    goal = goalOf({ goal: goal });
    const t = teh();
    const start = blockStartHour();
    const el = elapsedMin();
    const exp = targetAt(el, goal);
    const gap = score - exp;
    const left = Math.max(0, goal - score);
    const rm = start == null ? 0 : Math.max(0, 120 - el);
    const need = rm > 0.2 ? left / rm : left;
    const aryaNow = arya && arya.length ? arya[arya.length - 1].score : Math.round(exp * 1.06);
    const vs = score - aryaNow;
    let mood, cls;
    if (start == null) {
      mood = "خارج از ماموریت روزانه (۸ صبح تا ۱۲ شب).";
      cls = "ok";
    } else if (score >= goal) {
      mood = "پادشاه افسانه‌ای. آریا هم داره می‌دوه ولی تاج مال توئه.";
      cls = "ahead";
    } else if (vs >= 8) {
      mood = "از آریا جلویی. " + Math.round(vs) + " امتیاز. نگهش دار.";
      cls = "ahead";
    } else if (vs <= -8) {
      mood = "آریا جلو زد. " + Math.round(-vs) + " امتیاز عقب. بجنب ردش کن.";
      cls = "behind";
    } else if (gap >= -8) {
      mood = "نزدیک آریا و روی خط طلایی. رقابت زنده است.";
      cls = "ok";
    } else {
      mood = "عقب از تابع و آریا. حدود " + need.toFixed(1) + " امتیاز در دقیقه تا پادشاه (" + goal + ").";
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
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "11px Tahoma";
    ctx.fillText(String(A.goal), 4, yOf(A.goal) - 2);
    ctx.fillText("۰د", xOf(0), h - 6);
    ctx.fillText("۱۲۰د", xOf(120) - 24, h - 6);
    ctx.strokeStyle = "rgba(253,224,71,.9)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    ctx.lineTo(xOf(120), yOf(A.goal));
    ctx.stroke();
    ctx.setLineDash([]);
    function line(pts, color, lastMin, lastScore) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let s = false;
      (pts || []).forEach((pt) => {
        const x = xOf(pt.min), y = yOf(pt.score);
        if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
      });
      ctx.lineTo(xOf(lastMin), yOf(lastScore));
      ctx.stroke();
    }
    line(A.arya, "#fb7185", A.el, A.aryaNow);
    line(A.history, "#67e8f9", A.el, A.score);
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.score), 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fb7185";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.aryaNow), 5, 0, Math.PI * 2); ctx.fill();
  }
  w.drawMission = function (st, ids) {
    const score = +st.score || 0;
    const goal = goalOf(st);
    const el = elapsedMin();
    const arya = st.arya && st.arya.length ? st.arya : aryaSeries(goal, el, st.block);
    const A = analyze(score, st.history, goal, arya);
    const n = document.getElementById(ids.n);
    const tag = document.getElementById(ids.tag);
    const h = document.getElementById(ids.h);
    const s = document.getElementById(ids.s);
    if (n) n.textContent = score;
    if (tag) {
      tag.className = "tag " + A.cls;
      tag.textContent = A.vs >= 8 ? "جلوی آریا" : A.vs <= -8 ? "آریا جلوست" : "رقابت نزدیک";
    }
    if (h) h.textContent = A.mood;
    if (s) s.textContent = A.start == null ? "۸ صبح ماموریت بعدی." : ("علی " + score + " · آریا " + A.aryaNow + " · هدف پادشاه " + A.goal + " · طلایی الان " + Math.round(A.exp));
    drawChart(document.getElementById(ids.chart), A);
    return A;
  };
  w.missionMath = { teh, blockStartHour, elapsedMin, targetAt, analyze, goalOf, aryaSeries };
})(window);

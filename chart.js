(function (w) {
  function teh() {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
    return {
      h: d.getHours(),
      min: d.getMinutes(),
      sec: d.getSeconds(),
      day: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
    };
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
  function analyze(score, history, goal) {
    goal = goalOf({ goal: goal });
    const t = teh();
    const start = blockStartHour();
    const el = elapsedMin();
    const exp = targetAt(el, goal);
    const gap = score - exp;
    const left = Math.max(0, goal - score);
    const rm = start == null ? 0 : Math.max(0, 120 - el);
    const need = rm > 0.2 ? left / rm : left;
    let mood, cls;
    if (start == null) {
      mood = "خارج از ماموریت روزانه (۸ صبح تا ۱۲ شب).";
      cls = "ok";
    } else if (score >= goal) {
      mood = "پادشاه افسانه‌ای. به هدف " + goal + " رسیدی. تابع را گرفتی.";
      cls = "ahead";
    } else if (gap >= 8) {
      mood = "جلوی تابع. " + Math.round(gap) + " جلو از خط طلایی. هدف پادشاه: " + goal + ".";
      cls = "ahead";
    } else if (gap >= -8) {
      mood = "همراه تابع. مانده " + left + " تا پادشاه (" + goal + ") در " + Math.round(rm) + " دقیقه.";
      cls = "ok";
    } else {
      mood = "عقب از تابع. " + Math.round(-gap) + " کم. برای پادشاه حدود " + need.toFixed(1) + " امتیاز در دقیقه تا " + goal + ".";
      cls = "behind";
    }
    return { t, start, el, exp, gap, left, rm, need, mood, cls, score, history: history || [], goal };
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
    const maxY = Math.max(A.goal, A.score, 10);
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
    ctx.fillText("۶۰", xOf(60) - 8, h - 6);
    ctx.fillText("۱۲۰د", xOf(120) - 24, h - 6);
    ctx.strokeStyle = "rgba(253,224,71,.85)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    ctx.lineTo(xOf(120), yOf(A.goal));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    let started = false;
    (A.history || []).forEach((pt) => {
      const x = xOf(pt.min), y = yOf(pt.score);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.lineTo(xOf(A.el), yOf(A.score));
    ctx.stroke();
    ctx.fillStyle = "#fde047";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.score), 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(xOf(A.el), yOf(A.exp), 4, 0, Math.PI * 2); ctx.fill();
  }
  w.drawMission = function (st, ids) {
    const score = +st.score || 0;
    const A = analyze(score, st.history, st.goal);
    const n = document.getElementById(ids.n);
    const tag = document.getElementById(ids.tag);
    const h = document.getElementById(ids.h);
    const s = document.getElementById(ids.s);
    if (n) n.textContent = score;
    if (tag) {
      tag.className = "tag " + A.cls;
      tag.textContent = A.cls === "behind" ? "عقب از تابع" : A.cls === "ahead" ? "پادشاه / جلو" : "همراه تابع";
    }
    if (h) h.textContent = A.mood;
    if (s) s.textContent = A.start == null ? "۸ صبح ماموریت بعدی." : ("تابع الان " + Math.round(A.exp) + " · علی " + score + " · هدف پادشاه این بلوک: " + A.goal + " · " + Math.round(A.rm) + " دقیقه مانده");
    drawChart(document.getElementById(ids.chart), A);
    return A;
  };
  w.missionMath = { teh, blockStartHour, elapsedMin, targetAt, analyze, goalOf };
})(window);

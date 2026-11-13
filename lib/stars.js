/** Twinkling starfield on a canvas, with an optional golden-confetti burst. */
export function startStars(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;
  let stars = [];
  let sparks = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
      drift: 0.01 + Math.random() * 0.03,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = reducedMotion ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.speed + s.phase));
      ctx.fillStyle = `rgba(244, 236, 220, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (!reducedMotion) {
        s.y -= s.drift;
        if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
      }
    }
    sparks = sparks.filter((p) => p.life > 0);
    for (const p of sparks) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life -= 1;
      ctx.fillStyle = `rgba(232, 184, 102, ${Math.max(p.life / p.max, 0).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reducedMotion || sparks.length) requestAnimationFrame(draw);
  }

  function burst(n = 140) {
    for (let i = 0; i < n; i++) {
      const max = 140 + Math.random() * 120;
      sparks.push({
        x: Math.random() * w, y: -10 - Math.random() * h * 0.4,
        vx: (Math.random() - 0.5) * 1.2, vy: 0.6 + Math.random() * 1.6,
        r: Math.random() * 2 + 0.8, life: max, max,
      });
    }
    if (reducedMotion) requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
  return { burst };
}

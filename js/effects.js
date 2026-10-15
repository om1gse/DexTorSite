/* Визуальные эффекты главной страницы.
   Все цвета — из UI-кита DexTor; при prefers-reduced-motion эффекты отключаются. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var KIT = {
    edge: '#3B384B',      // Рамка поля
    edgeHot: '#5A5A6E',   // Будущий этап
    node: '#5A5A6E',
    nodeHot: '#A6A6BC',   // Второстепенный текст
    progress: '#E7E7EC',  // Прогресс
    green: '#3DDC97',     // Зелёный основной
    greenLight: '#7AF0BE' // Зелёный светлый
  };

  /* ---------- «Расшифровка» текста ---------- */
  var GLYPHS = { upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower: 'abcdefghjkmnpqrstuvwxyz', digit: '0123456789' };
  function pick(s) { return s.charAt(Math.floor(Math.random() * s.length)); }
  function glyphFor(ch) {
    if (/[0-9]/.test(ch)) return pick(GLYPHS.digit);
    if (ch !== ch.toLowerCase()) return pick(GLYPHS.upper);
    if (ch !== ch.toUpperCase()) return pick(GLYPHS.lower);
    return ch; // пробелы, пунктуация
  }

  function scramble(el, duration) {
    if (reduce || !el) return;
    duration = duration || 900;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var items = [], n, total = 0;
    while ((n = walker.nextNode())) { items.push({ node: n, text: n.nodeValue, start: total }); total += n.nodeValue.length; }
    if (!total) return;
    var token = {};
    el.__scramble = token;
    var t0 = performance.now();
    function frame(now) {
      if (el.__scramble !== token) return;
      var p = (now - t0) / duration, done = true;
      items.forEach(function (it) {
        if (!it.node.isConnected) return;
        var out = '';
        for (var i = 0; i < it.text.length; i++) {
          var k = it.start + i;
          // порог «расшифровки»: слева направо + немного случайности
          var thr = (k / total) * 0.65 + ((k * 9301 + 49297) % 233) / 233 * 0.35;
          var ch = it.text.charAt(i);
          if (p >= thr || /\s/.test(ch)) out += ch; else { out += glyphFor(ch); done = false; }
        }
        if (it.node.nodeValue !== out) it.node.nodeValue = out;
      });
      if (done) items.forEach(function (it) { it.node.nodeValue = it.text; });
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Живая сеть Tor на всю страницу ----------
     Закреплённый фон за контентом из нескольких слоёв:
     сиреневый свет и сетка (CSS) → объёмная сеть на холсте → зерно и виньетка.
     Узлы лежат на разной глубине: дальние мельче, тусклее и медленнее едут при прокрутке.
     Сеть живёт сама: по экрану бродят источники света, по узлам идут Tor-цепочки
     (3–4 хопа), регулярно расходятся волны-сканеры, узлы мерцают.
     Курсор лишь слегка добавляет свет и раздвигает узлы. Под текстом сеть притушена. */
  var QUIET_ZONES = [
    '.header-inner', '.hero-copy', '.section-head', '.rm-teaser-head', '.stack', '.stats-grid',
    '.tour-steps', '.tour-caption', '.security-grid > div:first-child', '.statement .container',
    '.faq-aside', '.foot-grid', '.foot-bottom', '.rp-hero .container', '.phase-aside', '.cta-card'
  ].join(',');
  var NO_PULSE = 'a, button, input, textarea, select, summary, label, [role="button"], .app-window, .panel, .feature, .rm-card';

  // Мягкое пятно света для аддитивного свечения (рисуется один раз)
  function glowSprite(inner, outer) {
    var c = document.createElement('canvas'), s = 128, g = c.getContext('2d');
    c.width = c.height = s;
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, inner); grd.addColorStop(0.25, outer); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    return c;
  }

  function pageNetwork() {
    var bg = document.createElement('div');
    bg.className = 'page-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<div class="bg-aura"></div><div class="bg-grid"></div><canvas></canvas><div class="bg-grain"></div>';
    document.body.prepend(bg);
    var canvas = bg.querySelector('canvas');
    var ctx = canvas.getContext('2d');

    var GLOW_GREEN = glowSprite('rgba(122,240,190,0.95)', 'rgba(61,220,151,0.4)');
    var GLOW_WHITE = glowSprite('rgba(231,231,236,0.8)', 'rgba(166,166,188,0.22)');
    var GLOW_LILAC = glowSprite('rgba(214,196,255,0.55)', 'rgba(214,196,255,0.16)');

    var LINK = 180, WARP_R = 180, WARP = 14, FALLOFF = 90, QUIET = 0.22, DENSITY = 6400;
    var LIGHT_R = 340, MOUSE_R = 200, MOUSE_K = 0.4; // мышь — лишь небольшая добавка
    var PULSE_SPEED = 0.5, PULSE_BAND = 90;
    var vw = 0, vh = 0, docH = 0, nodes = [], packets = [], pulses = [], zones = [], lights = [];
    var mouse = { cx: -1e4, cy: -1e4, ex: -1e4, ey: -1e4 };
    var raf = 0, lastSpawn = 0, lastZones = 0, nextPulse = 0, lastSy = window.scrollY;

    // блуждающие источники света: плавные фигуры Лиссажу, у каждого свой ритм
    for (var li = 0; li < 3; li++) {
      lights.push({ ax: 0.000071 + li * 0.000023, ay: 0.000097 - li * 0.000019,
                    px: Math.random() * 6.28, py: Math.random() * 6.28, x: 0, y: 0 });
    }

    function layerH(par) { return vh + Math.max(0, docH - vh) * par; }
    function makeNode() {
      var z = Math.pow(Math.random(), 0.8), a = Math.random() * Math.PI * 2, s = 0.05 + Math.random() * 0.14;
      var par = 0.3 + 0.7 * z;
      return { x: Math.random() * vw, y: Math.random() * layerH(par), z: z, par: par,
               vx: Math.cos(a) * s * (0.5 + z), vy: Math.sin(a) * s * (0.5 + z),
               r: 0.6 + z * 1.8, tw: Math.random() * 6.28, ts: 0.6 + Math.random() * 1.6,
               flash: 0, lit: 0, light: 0, f: 1, ox: 0, oy: 0, sx: 0, sy: 0 };
    }

    function measureZones() {
      var sy = window.scrollY;
      zones = [];
      document.querySelectorAll(QUIET_ZONES).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width && r.height) zones.push({ x1: r.left, y1: r.top + sy, x2: r.right, y2: r.bottom + sy });
      });
      lastZones = performance.now();
    }

    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var oldH = docH, oldVh = vh;
      vw = window.innerWidth; vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      docH = document.documentElement.scrollHeight;
      // узлы растягиваются вместе со своим слоем, чтобы не сбиваться в кучу
      if (oldH) nodes.forEach(function (n) {
        var before = oldVh + Math.max(0, oldH - oldVh) * n.par;
        n.y *= layerH(n.par) / Math.max(before, 1);
        if (n.x > vw) n.x = Math.random() * vw;
      });
      var count = Math.round(Math.min(2400, vw * layerH(0.65) / DENSITY));
      while (nodes.length < count) nodes.push(makeNode());
      nodes.length = count;
      nodes.sort(function (a, b) { return a.z - b.z; }); // дальние рисуются первыми
      measureZones();
    }

    // 1 — свободное место, QUIET — под текстом, плавный переход на расстоянии FALLOFF
    function openness(x, y, sz) {
      var f = 1;
      for (var i = 0; i < sz.length; i++) {
        var z = sz[i];
        var dx = Math.max(z.x1 - x, 0, x - z.x2), dy = Math.max(z.y1 - y, 0, y - z.y2);
        if (dx > FALLOFF || dy > FALLOFF) continue;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < FALLOFF) f = Math.min(f, QUIET + (1 - QUIET) * (d / FALLOFF));
      }
      return f;
    }

    // освещённость точки: блуждающие источники + немного от курсора
    function lightAt(x, y) {
      var best = 0, i, dx, dy, d2, k;
      for (i = 0; i < lights.length; i++) {
        dx = x - lights[i].x; dy = y - lights[i].y; d2 = dx * dx + dy * dy;
        if (d2 < LIGHT_R * LIGHT_R) { k = 1 - Math.sqrt(d2) / LIGHT_R; k *= k; if (k > best) best = k; }
      }
      dx = x - mouse.cx; dy = y - mouse.cy; d2 = dx * dx + dy * dy;
      if (d2 < MOUSE_R * MOUSE_R) { k = 1 - Math.sqrt(d2) / MOUSE_R; k = k * k * MOUSE_K; best = Math.min(1, best + k); }
      return best;
    }

    function sdist(a, b) { var dx = a.sx - b.sx, dy = a.sy - b.sy; return Math.sqrt(dx * dx + dy * dy); }

    function spawnPacket(visible, now) {
      var pool = visible.filter(function (n) { return n.z > 0.35 && n.f > 0.55; });
      if (pool.length < 4) return;
      var path = [pool[Math.floor(Math.random() * pool.length)]];
      var hops = 3 + (Math.random() < 0.5 ? 1 : 0); // guard → middle → exit (+ иногда ещё один)
      for (var h = 0; h < hops; h++) {
        var cur = path[path.length - 1];
        var options = pool.filter(function (m) {
          var d = sdist(cur, m);
          return path.indexOf(m) < 0 && Math.abs(m.z - cur.z) < 0.34 && d < LINK * 1.2 && d > 50;
        });
        if (!options.length) break;
        path.push(options[Math.floor(Math.random() * options.length)]);
      }
      if (path.length < 3) return;
      path[0].flash = 1;
      packets.push({ path: path, seg: 0, t: 0, trail: [], born: now, end: 0, speed: 2.4 + Math.random() * 1.6 });
    }

    function addPulse(x, y, now, k) {
      pulses.push({ x: x, y: y, t0: now, r: 0, max: Math.hypot(vw, vh) * (0.45 + 0.3 * k), k: k });
    }

    function draw(now, animate) {
      var sy = window.scrollY, dScroll = sy - lastSy;
      lastSy = sy;
      ctx.clearRect(0, 0, vw, vh);
      if (now - lastZones > 1200) measureZones(); // раскрытые FAQ, смена языка и т. п.

      // свет и сетка под курсором (CSS-слои), с инерцией
      if (mouse.cx < -1000 || mouse.ex < -1000) { mouse.ex = mouse.cx; mouse.ey = mouse.cy; }
      else { mouse.ex += (mouse.cx - mouse.ex) * 0.12; mouse.ey += (mouse.cy - mouse.ey) * 0.12; }
      bg.style.setProperty('--cx', mouse.ex.toFixed(1) + 'px');
      bg.style.setProperty('--cy', mouse.ey.toFixed(1) + 'px');
      bg.style.setProperty('--gy', (-(sy * 0.18) % 72).toFixed(1) + 'px');

      lights.forEach(function (l) {
        l.x = vw * (0.5 + 0.46 * Math.sin(now * l.ax + l.px));
        l.y = vh * (0.5 + 0.44 * Math.sin(now * l.ay + l.py));
      });

      var sz = [], i, j, a, b, d, n;
      for (i = 0; i < zones.length; i++) {
        var zz = zones[i];
        if (zz.y2 - sy > -LINK && zz.y1 - sy < vh + LINK) sz.push({ x1: zz.x1, y1: zz.y1 - sy, x2: zz.x2, y2: zz.y2 - sy });
      }

      // волны-сканеры
      for (i = pulses.length - 1; i >= 0; i--) {
        pulses[i].r = (now - pulses[i].t0) * PULSE_SPEED;
        if (pulses[i].r > pulses[i].max) pulses.splice(i, 1);
      }

      var visible = [], m = { x: mouse.cx, y: mouse.cy };
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var lh = layerH(n.par);
        if (animate) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -20) n.x = vw + 20; else if (n.x > vw + 20) n.x = -20;
          if (n.y < -20) n.y = lh + 20; else if (n.y > lh + 20) n.y = -20;
          n.flash *= 0.955; n.lit *= 0.94;
        }
        var bx = n.x, by = n.y - sy * n.par;
        if (by < -LINK || by > vh + LINK) continue;
        // лёгкая линза у курсора
        var tx = 0, ty = 0, dx = bx - m.x, dy = by - m.y, d2 = dx * dx + dy * dy;
        if (d2 < WARP_R * WARP_R && d2 > 1) {
          d = Math.sqrt(d2);
          var k = 1 - d / WARP_R; k = k * k * WARP * (0.3 + n.z);
          tx = dx / d * k; ty = dy / d * k;
        }
        n.ox += (tx - n.ox) * 0.1; n.oy += (ty - n.oy) * 0.1;
        n.sx = bx + n.ox; n.sy = by + n.oy;
        for (j = 0; j < pulses.length; j++) {
          var p0 = pulses[j], pd = Math.abs(Math.hypot(n.sx - p0.x, n.sy - p0.y) - p0.r);
          if (pd < PULSE_BAND) n.lit = Math.max(n.lit, (1 - pd / PULSE_BAND) * (1 - p0.r / p0.max) * p0.k);
        }
        n.light = lightAt(n.sx, n.sy);
        n.f = openness(n.sx, n.sy, sz);
        visible.push(n);
      }

      // ореолы блуждающих источников
      ctx.globalCompositeOperation = 'lighter';
      lights.forEach(function (l) {
        ctx.globalAlpha = 0.16;
        ctx.drawImage(GLOW_LILAC, l.x - LIGHT_R * 1.3, l.y - LIGHT_R * 1.3, LIGHT_R * 2.6, LIGHT_R * 2.6);
      });
      ctx.globalCompositeOperation = 'source-over';

      // кольца волн: широкий мягкий ореол + тонкий фронт
      pulses.forEach(function (p) {
        var fade = 1 - p.r / p.max;
        ctx.strokeStyle = KIT.nodeHot;
        ctx.lineWidth = 10; ctx.globalAlpha = 0.035 * fade * p.k;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.2; ctx.globalAlpha = 0.28 * fade * p.k;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        if (p.r > 22) {
          ctx.lineWidth = 1; ctx.globalAlpha = 0.09 * fade * p.k;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 22, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // связи — только между узлами близкой глубины
      for (i = 0; i < visible.length; i++) {
        a = visible[i];
        for (j = i + 1; j < visible.length; j++) {
          b = visible[j];
          if (b.z - a.z > 0.34) break; // массив отсортирован по глубине
          var zm = (a.z + b.z) / 2, L = LINK * (0.65 + 0.45 * zm);
          if (Math.abs(a.sy - b.sy) >= L || Math.abs(a.sx - b.sx) >= L) continue;
          d = sdist(a, b);
          if (d >= L) continue;
          var f = Math.min(a.f, b.f), near = 1 - d / L;
          var lit = Math.min(a.lit, b.lit), lv = (a.light + b.light) / 2;
          var lvl = Math.max(lit, lv) + zm * 0.15;
          ctx.lineWidth = 0.5 + zm * 0.8 + lit * 0.6;
          ctx.strokeStyle = lit > 0.25 ? KIT.progress : lvl > 0.45 ? KIT.nodeHot : lvl > 0.18 ? KIT.edgeHot : KIT.edge;
          ctx.globalAlpha = Math.min(1, near * (0.3 + 0.7 * zm) * (1 + lv * 1.4) + lit * near * 0.8) * f;
          ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
        }
      }

      // узлы: мерцание + свет источников
      ctx.lineWidth = 1.5;
      visible.forEach(function (n) {
        var tw = 0.7 + 0.3 * Math.sin(now * 0.0015 * n.ts + n.tw);
        var lv = Math.max(n.light, n.lit);
        if (n.z > 0.86) { // ближний слой — мягкое боке
          ctx.globalAlpha = (0.14 + n.light * 0.2) * n.f;
          ctx.drawImage(GLOW_LILAC, n.sx - 16, n.sy - 16, 32, 32);
        }
        ctx.globalAlpha = Math.min(1, (0.35 + 0.6 * n.z) * tw + lv * 0.7) * n.f;
        ctx.fillStyle = lv > 0.5 ? KIT.progress : lv > 0.15 ? KIT.nodeHot : KIT.node;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, n.r + lv * 1.1, 0, Math.PI * 2); ctx.fill();
        if (n.flash > 0.03) {
          ctx.globalAlpha = n.flash * 0.9 * n.f;
          ctx.strokeStyle = KIT.green;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, n.r + (1 - n.flash) * 36, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // свечение: узлы под волной и светом, вспышки хопов
      ctx.globalCompositeOperation = 'lighter';
      visible.forEach(function (n) {
        var lv = Math.max(n.lit, n.light * 0.7);
        if (lv > 0.2 && n.z > 0.3) {
          var s = 8 + 18 * n.z * lv;
          ctx.globalAlpha = lv * 0.6 * n.f;
          ctx.drawImage(GLOW_WHITE, n.sx - s, n.sy - s, s * 2, s * 2);
        }
        if (n.flash > 0.1) {
          var g = 10 + 26 * n.flash;
          ctx.globalAlpha = n.flash * 0.7 * n.f;
          ctx.drawImage(GLOW_GREEN, n.sx - g, n.sy - g, g * 2, g * 2);
        }
      });
      ctx.globalCompositeOperation = 'source-over';

      // Tor-цепочки
      for (i = packets.length - 1; i >= 0; i--) {
        var p = packets[i], path = p.path, last = path.length - 1;
        if (path.some(function (q) { return q.sy < -LINK * 1.5 || q.sy > vh + LINK * 1.5; })) { packets.splice(i, 1); continue; }
        var fadeIn = Math.min(1, (now - p.born) / 300);
        var fadeOut = p.end ? 1 - (now - p.end) / 900 : 1;
        if (fadeOut <= 0) { packets.splice(i, 1); continue; }
        var pf = Math.max(0.35, Math.min(path[0].f, path[last].f, path[Math.min(p.seg + 1, last)].f)) * fadeIn * fadeOut;

        // сама цепочка: пройденные хопы ярче
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = KIT.green;
        for (j = 0; j < last; j++) {
          ctx.globalAlpha = (j < p.seg || p.end ? 0.55 : j === p.seg ? 0.32 : 0.12) * pf;
          ctx.beginPath(); ctx.moveTo(path[j].sx, path[j].sy); ctx.lineTo(path[j + 1].sx, path[j + 1].sy); ctx.stroke();
        }

        a = path[p.seg]; b = path[Math.min(p.seg + 1, last)];
        if (animate && !p.end) {
          p.t += p.speed / Math.max(sdist(a, b), 1);
          if (p.t >= 1) {
            b.flash = 1; b.lit = Math.max(b.lit, 0.5); p.seg++; p.t = 0;
            if (p.seg >= last) { p.end = now; p.seg = last; b.lit = 1; addPulse(b.sx, b.sy, now, 0.35); }
            a = path[p.seg]; b = path[Math.min(p.seg + 1, last)];
          }
        }
        var x = a.sx + (b.sx - a.sx) * p.t, y = a.sy + (b.sy - a.sy) * p.t;
        for (j = 0; j < p.trail.length; j++) p.trail[j][1] -= dScroll * a.par; // след едет вместе со слоем при прокрутке
        if (!p.end) { p.trail.push([x, y]); if (p.trail.length > 30) p.trail.shift(); }
        else if (p.trail.length) p.trail.splice(0, 2);

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 2.2;
        for (j = 1; j < p.trail.length; j++) {
          ctx.globalAlpha = Math.pow(j / p.trail.length, 1.5) * 0.9 * pf;
          ctx.beginPath(); ctx.moveTo(p.trail[j - 1][0], p.trail[j - 1][1]); ctx.lineTo(p.trail[j][0], p.trail[j][1]); ctx.stroke();
        }
        if (!p.end) {
          ctx.globalAlpha = pf;
          ctx.drawImage(GLOW_GREEN, x - 22, y - 22, 44, 44);
          ctx.fillStyle = KIT.greenLight;
          ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      if (animate) {
        // частота цепочек растёт с площадью экрана
        var maxPackets = Math.max(4, Math.round(vw * vh / 85000));
        if (now - lastSpawn > 260 && packets.length < maxPackets) { spawnPacket(visible, now); lastSpawn = now; }
        if (now > nextPulse) { // волна из-под одного из источников света или из свободного места
          if (Math.random() < 0.5) { var l = lights[Math.floor(Math.random() * lights.length)]; addPulse(l.x, l.y, now, 1); }
          else {
            var open = visible.filter(function (q) { return q.f > 0.9 && q.z > 0.5; });
            if (open.length) { var src = open[Math.floor(Math.random() * open.length)]; addPulse(src.sx, src.sy, now, 1); }
          }
          nextPulse = now + 2600 + Math.random() * 2200;
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) { draw(now, true); raf = requestAnimationFrame(loop); }
    function start() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    resize();
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (Math.abs(document.documentElement.scrollHeight - docH) > 40) resize();
      }).observe(document.body);
    }

    if (reduce) { // статичная картинка, перерисовываем только при прокрутке
      var pending = false;
      var still = function () { pending = false; draw(performance.now(), false); };
      window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(still); } }, { passive: true });
      window.addEventListener('resize', still);
      still();
      return;
    }

    window.addEventListener('pointermove', function (e) { mouse.cx = e.clientX; mouse.cy = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.cx = mouse.cy = -1e4; });
    // клик по пустому месту запускает небольшую волну
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest(NO_PULSE))) return;
      addPulse(e.clientX, e.clientY, performance.now(), 0.6);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    nextPulse = performance.now() + 700;
    start();
  }

  /* ---------- 3D-наклон окна продукта ---------- */
  function heroTilt() {
    var hero = document.querySelector('.hero');
    var win = document.querySelector('.hero-visual .app-window');
    var card = document.querySelector('.float-card');
    if (!hero || !win || reduce || !finePointer) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function render() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      win.style.transform = 'perspective(1600px) rotateY(' + (-7 + cx * 9).toFixed(2) + 'deg) rotateX(' + (3 - cy * 7).toFixed(2) + 'deg)';
      if (card) card.style.transform = 'translate3d(' + (cx * -22).toFixed(1) + 'px,' + (cy * -16).toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(render); else raf = 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(render); }
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick();
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    win.classList.add('tilt');
    render();
  }

  /* ---------- Подсветка рамок карточек за курсором ---------- */
  function spotlight(zoneSel, cardSel) {
    if (!finePointer) return;
    document.querySelectorAll(zoneSel).forEach(function (zone) {
      var cards = Array.prototype.slice.call(zone.querySelectorAll(cardSel));
      cards.forEach(function (c) { c.classList.add('spot'); });
      zone.classList.add('spot-zone');
      zone.addEventListener('pointermove', function (e) {
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          c.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
    });
  }

  /* ---------- Сканирование модулей в панели безопасности ---------- */
  function securityScan() {
    var panel = document.querySelector('.security .panel');
    if (!panel || reduce || !('IntersectionObserver' in window)) return;
    var rows = Array.prototype.slice.call(panel.querySelectorAll('.row'));
    rows.forEach(function (row) {
      var spin = document.createElement('span');
      spin.className = 'spin';
      spin.setAttribute('aria-hidden', 'true');
      row.querySelector('.status').prepend(spin);
    });
    panel.classList.add('scan');
    var title = panel.querySelector('.panel-title h4');
    var CHECKING = { en: 'Checking modules…', ru: 'Проверяем модули…' };
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      // Пока идёт проверка, заголовок не должен заранее говорить «всё активно»
      var finalTitle = title.innerHTML;
      var checking = CHECKING[document.documentElement.lang] || CHECKING.en;
      title.textContent = checking;
      rows.forEach(function (row, i) {
        setTimeout(function () { row.classList.add('checking'); }, 300 + i * 650);
        setTimeout(function () { row.classList.remove('checking'); row.classList.add('ok'); }, 900 + i * 650);
      });
      setTimeout(function () {
        if (title.textContent === checking) title.innerHTML = finalTitle; // язык не меняли во время проверки
        panel.classList.remove('scan'); panel.classList.add('scanned');
      }, 1100 + rows.length * 650);
    }, { threshold: 0.45 });
    io.observe(panel);
  }

  /* ---------- Орбиты: прорисовка дуг при прокрутке ---------- */
  function orbits() {
    var svg = document.querySelector('.arcs');
    if (!svg) return;
    if (reduce || !('IntersectionObserver' in window)) { svg.classList.add('in'); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { svg.classList.add('in'); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(svg);
  }

  /* ---------- Публичный API для main.js ---------- */
  window.DexFX = {
    heroIntro: function () { scramble(document.querySelector('.hero .display'), 1100); },
    onReveal: function (el) { if (el.classList.contains('eyebrow')) scramble(el, 700); }
  };

  pageNetwork();
  heroTilt();
  spotlight('.features', '.feature');
  spotlight('.rm-cards', '.rm-card');
  securityScan();
  orbits();
})();

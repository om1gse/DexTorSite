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
     Один закреплённый холст за контентом; узлы живут в координатах документа,
     поэтому при прокрутке сеть непрерывно перетекает из блока в блок.
     Под текстовыми блоками сеть плавно гаснет — она заполняет только пустые места. */
  var QUIET_ZONES = [
    '.header-inner', '.hero-copy', '.section-head', '.rm-teaser-head', '.stack', '.stats-grid',
    '.tour-steps', '.tour-caption', '.security-grid > div:first-child', '.statement .container',
    '.faq-aside', '.foot-grid', '.foot-bottom', '.rp-hero .container', '.phase-aside', '.cta-card'
  ].join(',');

  function pageNetwork() {
    var canvas = document.createElement('canvas');
    canvas.className = 'page-net';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    var ctx = canvas.getContext('2d');

    var LINK = 155, HOT = 180, FALLOFF = 80, QUIET = 0.1, DENSITY = 10500;
    var vw = 0, vh = 0, docH = 0, nodes = [], packets = [], zones = [];
    var mouse = { cx: -1e4, cy: -1e4 };
    var raf = 0, lastSpawn = 0, lastZones = 0;

    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
    function makeNode(yMin, yMax) {
      var a = Math.random() * Math.PI * 2, s = 0.05 + Math.random() * 0.12;
      return { x: Math.random() * vw, y: yMin + Math.random() * (yMax - yMin), vx: Math.cos(a) * s, vy: Math.sin(a) * s,
               r: 1 + Math.random() * 1.3, flash: 0, f: 1 };
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
      vw = window.innerWidth; vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var newH = document.documentElement.scrollHeight;
      var count = Math.round(Math.min(1800, (vw * newH) / DENSITY));
      if (newH > docH && nodes.length) { // страница выросла — досеять узлы в новую часть
        while (nodes.length < count) nodes.push(makeNode(docH, newH));
      }
      docH = newH;
      while (nodes.length < count) nodes.push(makeNode(0, docH));
      nodes.length = count;
      nodes.forEach(function (n) { if (n.x > vw) n.x = Math.random() * vw; if (n.y > docH) n.y = Math.random() * docH; });
      measureZones();
    }

    // 1 — свободное место, QUIET — под текстом, плавный переход на расстоянии FALLOFF
    function openness(n) {
      var f = 1;
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        var dx = Math.max(z.x1 - n.x, 0, n.x - z.x2), dy = Math.max(z.y1 - n.y, 0, n.y - z.y2);
        if (dx > FALLOFF || dy > FALLOFF) continue;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < FALLOFF) f = Math.min(f, QUIET + (1 - QUIET) * (d / FALLOFF));
      }
      return f;
    }

    function spawn(visible) {
      if (visible.length < 4) return;
      var first = visible[Math.floor(Math.random() * visible.length)];
      if (first.f < 0.6) return; // пакеты стартуют только на свободных участках
      var path = [first];
      for (var h = 0; h < 3; h++) {
        var cur = path[path.length - 1];
        var options = visible.filter(function (m) { return path.indexOf(m) < 0 && m.f > 0.4 && dist(cur, m) < LINK; });
        if (!options.length) break;
        path.push(options[Math.floor(Math.random() * options.length)]);
      }
      if (path.length < 3) return;
      first.flash = 1;
      packets.push({ path: path, seg: 0, t: 0, trail: [] });
    }

    function draw(now, animate) {
      var sy = window.scrollY;
      var top = sy - LINK, bottom = sy + vh + LINK;
      var m = { x: mouse.cx, y: mouse.cy + sy }; // курсор в координатах документа
      ctx.clearRect(0, 0, vw, vh);
      if (now - lastZones > 1200) measureZones(); // раскрытые FAQ, смена языка и т. п.

      var visible = [], i, j, a, b, d;
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (animate) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -20) n.x = vw + 20; else if (n.x > vw + 20) n.x = -20;
          if (n.y < -20) n.y = docH + 20; else if (n.y > docH + 20) n.y = -20;
          n.flash *= 0.95;
        }
        if (n.y > top && n.y < bottom) { n.f = openness(n); visible.push(n); }
      }

      // связи
      ctx.lineWidth = 1;
      for (i = 0; i < visible.length; i++) {
        a = visible[i];
        for (j = i + 1; j < visible.length; j++) {
          b = visible[j];
          if (Math.abs(a.y - b.y) >= LINK) continue;
          d = dist(a, b);
          if (d >= LINK) continue;
          var f = Math.min(a.f, b.f);
          var mx = (a.x + b.x) / 2 - m.x, my = (a.y + b.y) / 2 - m.y;
          var hot = mx * mx + my * my < HOT * HOT;
          ctx.globalAlpha = (1 - d / LINK) * (hot ? 0.95 : 0.7) * f;
          ctx.strokeStyle = hot ? KIT.edgeHot : KIT.edge;
          ctx.beginPath(); ctx.moveTo(a.x, a.y - sy); ctx.lineTo(b.x, b.y - sy); ctx.stroke();
        }
      }

      // узлы
      visible.forEach(function (n) {
        var hot = dist(n, m) < HOT;
        ctx.globalAlpha = (hot ? 1 : 0.85) * n.f;
        ctx.fillStyle = hot ? KIT.nodeHot : KIT.node;
        ctx.beginPath(); ctx.arc(n.x, n.y - sy, n.r + (hot ? 0.6 : 0), 0, Math.PI * 2); ctx.fill();
        if (n.flash > 0.03) {
          ctx.globalAlpha = n.flash * 0.8 * n.f;
          ctx.strokeStyle = KIT.green;
          ctx.beginPath(); ctx.arc(n.x, n.y - sy, n.r + (1 - n.flash) * 16, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // пакеты
      if (animate) {
        for (i = packets.length - 1; i >= 0; i--) {
          var p = packets[i];
          a = p.path[p.seg]; b = p.path[p.seg + 1];
          p.t += 1.9 / Math.max(dist(a, b), 1);
          if (p.t >= 1) {
            b.flash = 1; p.seg++; p.t = 0;
            if (p.seg >= p.path.length - 1) { packets.splice(i, 1); continue; }
            a = p.path[p.seg]; b = p.path[p.seg + 1];
          }
          var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
          var pf = Math.min(a.f, b.f);
          p.trail.push([x, y]);
          if (p.trail.length > 16) p.trail.shift();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = KIT.green;
          for (j = 1; j < p.trail.length; j++) {
            ctx.globalAlpha = (j / p.trail.length) * 0.7 * pf;
            ctx.beginPath(); ctx.moveTo(p.trail[j - 1][0], p.trail[j - 1][1] - sy); ctx.lineTo(p.trail[j][0], p.trail[j][1] - sy); ctx.stroke();
          }
          ctx.globalAlpha = pf;
          ctx.fillStyle = KIT.greenLight;
          ctx.beginPath(); ctx.arc(x, y - sy, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        // частота пакетов растёт с площадью экрана
        var maxPackets = Math.max(3, Math.round(vw * vh / 180000));
        if (now - lastSpawn > 650 && packets.length < maxPackets) { spawn(visible); lastSpawn = now; }
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
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
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

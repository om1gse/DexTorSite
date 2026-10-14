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

  /* ---------- Живая сеть Tor в hero ---------- */
  function torNetwork(canvas) {
    var host = canvas.parentElement;
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, nodes = [], packets = [];
    var mouse = { x: -1e4, y: -1e4 };
    var LINK = 150, HOT = 180;
    var raf = 0, visible = true, lastSpawn = 0;

    function makeNode() {
      var a = Math.random() * Math.PI * 2, s = 0.05 + Math.random() * 0.12;
      return { x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1 + Math.random() * 1.3, flash: 0 };
    }
    function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, Math.max(26, (W * H) / 16000)));
      while (nodes.length < count) nodes.push(makeNode());
      nodes.length = count;
      nodes.forEach(function (n) { n.x = Math.min(n.x, W); n.y = Math.min(n.y, H); });
    }

    // Пакет идёт по цепочке из 3 узлов — как маршрут в Tor
    function spawn() {
      var first = nodes[Math.floor(Math.random() * nodes.length)];
      var path = [first];
      for (var h = 0; h < 3; h++) {
        var cur = path[path.length - 1];
        var options = nodes.filter(function (m) { return path.indexOf(m) < 0 && dist(cur, m) < LINK; });
        if (!options.length) break;
        path.push(options[Math.floor(Math.random() * options.length)]);
      }
      if (path.length < 3) return;
      first.flash = 1;
      packets.push({ path: path, seg: 0, t: 0, trail: [] });
    }

    function draw(now, animate) {
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b, d;

      if (animate) {
        nodes.forEach(function (n) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
          if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
          n.flash *= 0.95;
        });
      }

      // связи
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j];
          d = dist(a, b);
          if (d >= LINK) continue;
          var mx = (a.x + b.x) / 2 - mouse.x, my = (a.y + b.y) / 2 - mouse.y;
          var hot = mx * mx + my * my < HOT * HOT;
          ctx.globalAlpha = (1 - d / LINK) * (hot ? 0.9 : 0.55);
          ctx.strokeStyle = hot ? KIT.edgeHot : KIT.edge;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      // узлы
      nodes.forEach(function (n) {
        var hot = dist(n, mouse) < HOT;
        ctx.globalAlpha = hot ? 1 : 0.85;
        ctx.fillStyle = hot ? KIT.nodeHot : KIT.node;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (hot ? 0.6 : 0), 0, Math.PI * 2); ctx.fill();
        if (n.flash > 0.03) {
          ctx.globalAlpha = n.flash * 0.8;
          ctx.strokeStyle = KIT.green;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + (1 - n.flash) * 16, 0, Math.PI * 2); ctx.stroke();
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
          p.trail.push([x, y]);
          if (p.trail.length > 16) p.trail.shift();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = KIT.green;
          for (j = 1; j < p.trail.length; j++) {
            ctx.globalAlpha = (j / p.trail.length) * 0.7;
            ctx.beginPath(); ctx.moveTo(p.trail[j - 1][0], p.trail[j - 1][1]); ctx.lineTo(p.trail[j][0], p.trail[j][1]); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = KIT.greenLight;
          ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        if (now - lastSpawn > 650 && packets.length < 7) { spawn(); lastSpawn = now; }
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      draw(now, true);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    resize();
    if (reduce) { draw(0, false); window.addEventListener('resize', function () { resize(); draw(0, false); }); return; }

    window.addEventListener('resize', resize);
    host.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () { mouse.x = mouse.y = -1e4; });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(host);
    }
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

  var canvas = document.querySelector('.hero .net');
  if (canvas) torNetwork(canvas);
  heroTilt();
  spotlight('.features', '.feature');
  spotlight('.rm-cards', '.rm-card');
  securityScan();
  orbits();
})();

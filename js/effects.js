/* Визуальные эффекты главной страницы.
   Все цвета — из UI-кита DexTor; при prefers-reduced-motion эффекты отключаются. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

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

  /* ---------- Туман на всю страницу (WebGL) ----------
     Дымка медленно течёт сама. Курсор рассеивает её, но через пару секунд
     просвет затягивается обратно — «без следов». Внутри тумана висят узлы Tor:
     мягкие источники света, между которыми изредка пробегает зелёный импульс
     (guard → middle → exit). В просветах едва проступает шифротекст.
     Весь фон — один холст: виньетка считается в шейдере, без лишних слоёв поверх.
     Цвета: фон #0E0F13, сиреневый --lilac, серый #A6A6BC, зелёный #3DDC97. */
  var FOG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FOG_FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes; uniform float uTime, uScroll, uScrollPx, uDensity, uClearR;',
    'uniform vec3 uTrail[24]; uniform vec3 uLights[4]; uniform vec3 uPacket;',
    'uniform sampler2D uGlyphs;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    '  for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    'void main(){',
    '  vec2 frag=gl_FragCoord.xy; vec2 uv=frag/uRes.y; float t=uTime;',
    // курсор: просвет + лёгкое расталкивание дымки
    '  float clear=0.; vec2 push=vec2(0.);',
    '  for(int i=0;i<24;i++){vec2 d=frag-uTrail[i].xy;float g=uTrail[i].z*exp(-dot(d,d)/(uClearR*uClearR));',
    '    clear+=g; push+=d/uRes.y*g;}',
    '  clear=clamp(clear,0.,1.);',
    '  vec2 p=uv*1.1-vec2(0.,uScroll)-push*.5;',
    // доменное искажение даёт клубящиеся, текучие формы
    '  vec2 q=vec2(fbm(p+vec2(0.,t*.035)),fbm(p+vec2(5.2,1.3)-t*.028));',
    '  float f=fbm(p+3.2*q+vec2(1.7,9.2)+t*.05);',
    '  float fog=smoothstep(.32,.95,f)*.85+f*.15;',
    '  fog*=(1.-clear*.92)*uDensity;',
    '  vec3 bg=vec3(.0549,.0588,.0745);',
    '  vec3 lilac=vec3(.839,.769,1.); vec3 grey=vec3(.651,.651,.737); vec3 green=vec3(.239,.863,.592);',
    '  vec3 tint=mix(grey,lilac,clamp(q.y*1.8-.4,0.,1.));',
    '  vec3 col=bg+tint*fog*.105;',
    // узлы Tor подсвечивают туман изнутри
    '  for(int i=0;i<4;i++){vec2 d=(frag-uLights[i].xy)/uRes.y;float li=uLights[i].z*exp(-dot(d,d)/.05);',
    '    col+=tint*fog*li*.34+lilac*li*.01;}',
    // зелёный импульс между узлами
    '  vec2 dp=(frag-uPacket.xy)/uRes.y;float pd=dot(dp,dp);',
    '  col+=green*uPacket.z*(exp(-pd/.00012)*.5+exp(-pd/.01)*fog*.55);',
    // шифротекст: проявляется в основном там, где прошла мышь
    '  float g=texture2D(uGlyphs,fract(vec2(frag.x,frag.y-uScrollPx)/512.)).a;',
    '  col+=grey*g*(clear*.075+(1.-smoothstep(0.,.35,fog))*.012);',
    // виньетка (раньше была отдельным CSS-слоем — лишний слой давал артефакты при прокрутке)
    '  vec2 vn=(frag/uRes-vec2(.5,.6))/vec2(1.2,.9);',
    '  col=mix(col,vec3(.0235,.0275,.0392),clamp((length(vn)-.55)/.45,0.,1.)*.72);',
    '  col+=(hash(frag+fract(t))-.5)/255.;', // дизеринг против полос на градиентах
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function pageFog() {
    var bg = document.createElement('div');
    bg.className = 'page-bg';
    bg.setAttribute('aria-hidden', 'true');
    bg.innerHTML = '<canvas></canvas>';
    document.body.prepend(bg);
    var canvas = bg.querySelector('canvas');
    // alpha: true — непрозрачный растянутый холст Chrome в Windows выносит в аппаратный оверлей,
    // и при прокрутке часть экрана перестаёт перерисовываться (полосы со старыми кадрами)
    var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, depth: false, powerPreference: 'low-power' });
    if (!gl) { bg.classList.add('no-gl'); return; }

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = shader(gl.VERTEX_SHADER, FOG_VERT), fs = shader(gl.FRAGMENT_SHADER, FOG_FRAG);
    var prog = gl.createProgram();
    if (vs && fs) { gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); }
    if (!vs || !fs || !gl.getProgramParameter(prog, gl.LINK_STATUS)) { bg.classList.add('no-gl'); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRes', 'uTime', 'uScroll', 'uScrollPx', 'uDensity', 'uClearR', 'uTrail', 'uLights', 'uPacket', 'uGlyphs']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    // слой шифротекста: hex-символы, часть которых время от времени меняется
    var gc = document.createElement('canvas'), g2 = gc.getContext('2d');
    gc.width = gc.height = 512;
    var COLS = 64, ROWS = 32, cells = [], HEX = '0123456789abcdef';
    for (var ci = 0; ci < COLS * ROWS; ci++) cells.push(Math.random() < 0.55 ? HEX.charAt(Math.floor(Math.random() * 16)) : ' ');
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.uGlyphs, 0);
    function paintGlyphs() {
      g2.clearRect(0, 0, 512, 512);
      g2.fillStyle = '#fff';
      g2.font = '7px ui-monospace, Consolas, monospace';
      g2.textBaseline = 'top';
      for (var i = 0; i < cells.length; i++) {
        if (cells[i] !== ' ') g2.fillText(cells[i], (i % COLS) * 8 + 1, Math.floor(i / COLS) * 16 + 4);
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gc);
    }
    paintGlyphs();

    var SCALE = finePointer ? 0.38 : 0.28; // туман мягкий — считаем в пониженном разрешении
    var vw = 0, vh = 0, raf = 0, t0 = performance.now();
    var trail = [], trailBuf = new Float32Array(24 * 3), lightBuf = new Float32Array(4 * 3);
    var mouse = { x: -1e4, y: -1e4, lastX: -1e4, lastY: -1e4, lastT: 0 };

    // узлы Tor: медленно плавают по экрану, у каждого свой ритм
    var lights = [];
    for (var li = 0; li < 4; li++) {
      lights.push({ ax: 0.000045 + li * 0.000013, ay: 0.000061 - li * 0.000009,
                    px: Math.random() * 6.28, py: Math.random() * 6.28, x: 0, y: 0, flash: 0 });
    }
    var packet = null, nextPacket = t0 + 2500;

    function resize() {
      vw = window.innerWidth; vh = window.innerHeight;
      canvas.width = Math.max(1, Math.round(vw * SCALE)); canvas.height = Math.max(1, Math.round(vh * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    // координаты экрана → пиксели холста (ось Y в WebGL снизу вверх)
    function toGL(x, y) { return [x * SCALE, (vh - y) * SCALE]; }
    function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

    function frame(now, animate) {
      var t = (now - t0) / 1000, sy = window.scrollY, i;

      // след курсора: каждый просвет живёт ~2.5 с и затягивается
      for (i = 0; i < 24; i++) {
        var pt = trail[i];
        var s = 0;
        if (pt) { var age = (now - pt.t) / 2600; s = age < 1 ? Math.pow(1 - age, 1.6) * Math.min(1, (now - pt.t) / 120 + 0.3) : 0; }
        var c = pt ? toGL(pt.x, pt.y) : [-1e4, -1e4];
        trailBuf[i * 3] = c[0]; trailBuf[i * 3 + 1] = c[1]; trailBuf[i * 3 + 2] = s * 0.55;
      }

      lights.forEach(function (l, k) {
        l.x = vw * (0.5 + 0.45 * Math.sin(now * l.ax + l.px));
        l.y = vh * (0.5 + 0.42 * Math.sin(now * l.ay + l.py));
        l.flash *= 0.97;
        var c = toGL(l.x, l.y);
        lightBuf[k * 3] = c[0]; lightBuf[k * 3 + 1] = c[1];
        lightBuf[k * 3 + 2] = 0.55 + 0.15 * Math.sin(t * 0.5 + k * 1.7) + l.flash * 0.7;
      });

      // импульс: проходит три хопа и гаснет; следующий — через несколько секунд
      var pk = [-1e4, -1e4, 0];
      if (animate) {
        if (!packet && now > nextPacket) {
          var order = [0, 1, 2, 3].sort(function () { return Math.random() - 0.5; });
          packet = { path: order.slice(0, 3), seg: 0, start: now };
          lights[packet.path[0]].flash = 1;
        }
        if (packet) {
          var a = lights[packet.path[packet.seg]], b = lights[packet.path[packet.seg + 1]];
          var dur = Math.max(900, Math.hypot(b.x - a.x, b.y - a.y) * 2.4);
          var k2 = (now - packet.start) / dur;
          if (k2 >= 1) {
            b.flash = 1; packet.seg++; packet.start = now;
            if (packet.seg >= packet.path.length - 1) { packet = null; nextPacket = now + 4500 + Math.random() * 4000; }
          } else {
            var e = ease(k2), c2 = toGL(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
            pk = [c2[0], c2[1], Math.sin(Math.PI * Math.min(1, k2 * 1.15)) * 0.6 + 0.4];
          }
        }
      }

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uScroll, sy / vh * 0.35);
      gl.uniform1f(U.uScrollPx, sy * 0.5 * SCALE);
      gl.uniform1f(U.uDensity, 1 - 0.22 * Math.min(1, sy / (vh * 1.5))); // в hero дымка гуще
      gl.uniform1f(U.uClearR, 120 * SCALE);
      gl.uniform3fv(U.uTrail, trailBuf);
      gl.uniform3fv(U.uLights, lightBuf);
      gl.uniform3f(U.uPacket, pk[0], pk[1], pk[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var lastGlyphs = 0, lastDraw = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      // туман медленный: 30 кадров в секунду хватает, а видеокарта остаётся свободной для прокрутки
      if (now - lastDraw < 30) return;
      lastDraw = now;
      if (now - lastGlyphs > 450) { // шифротекст понемногу «перешифровывается»
        for (var i = 0; i < 40; i++) {
          var n = Math.floor(Math.random() * cells.length);
          cells[n] = Math.random() < 0.55 ? HEX.charAt(Math.floor(Math.random() * 16)) : ' ';
        }
        paintGlyphs(); lastGlyphs = now;
      }
      frame(now, true);
    }
    function start() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    resize();
    window.addEventListener('resize', resize);

    // ?fogdebug=1 — красная рамка вокруг холста и размеры окна/холста (временная диагностика)
    if (/[?&]fogdebug=1(&|$)/.test(location.search)) {
      canvas.style.outline = '3px solid red'; canvas.style.outlineOffset = '-3px';
      var dbg = document.createElement('pre');
      dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px;font:12px/1.4 monospace;color:#fff;background:rgba(200,0,0,.85);pointer-events:none';
      document.body.appendChild(dbg);
      var report = function () {
        var r = canvas.getBoundingClientRect(), br = bg.getBoundingClientRect(), vv = window.visualViewport;
        var ri = gl.getExtension('WEBGL_debug_renderer_info');
        dbg.textContent = [
          'inner ' + innerWidth + 'x' + innerHeight + ' | client ' + document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight +
            (vv ? ' | vv ' + Math.round(vv.width) + 'x' + Math.round(vv.height) + ' @' + vv.scale : '') + ' | dpr ' + devicePixelRatio,
          'bg ' + Math.round(br.top) + '..' + Math.round(br.bottom) + ' | canvas ' + Math.round(r.top) + '..' + Math.round(r.bottom) +
            ' | buffer ' + canvas.width + 'x' + canvas.height + ' | drawing ' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight,
          ri ? gl.getParameter(ri.UNMASKED_RENDERER_WEBGL) : '',
          navigator.userAgent
        ].join('\n');
      };
      report(); setInterval(report, 1000);
    }

    if (reduce) { // неподвижная дымка, перерисовываем только при прокрутке и ресайзе
      var pending = false;
      var still = function () { pending = false; frame(t0 + 20000, false); };
      window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(still); } }, { passive: true });
      window.addEventListener('resize', still);
      still();
      return;
    }

    window.addEventListener('pointermove', function (e) {
      var now = performance.now();
      var dx = e.clientX - mouse.lastX, dy = e.clientY - mouse.lastY;
      if (dx * dx + dy * dy < 196 && now - mouse.lastT < 80) return; // точки следа не чаще ~14 px / 80 мс
      mouse.lastX = e.clientX; mouse.lastY = e.clientY; mouse.lastT = now;
      trail.push({ x: e.clientX, y: e.clientY, t: now });
      if (trail.length > 24) trail.shift();
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    start();
  }

  /* ---------- Параллакс плашки «Образ проверен» (окно продукта остаётся плоским) ---------- */
  function heroParallax() {
    var hero = document.querySelector('.hero');
    var card = document.querySelector('.float-card');
    if (!hero || !card || reduce || !finePointer) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function render() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      card.style.transform = 'translate3d(' + (cx * -22).toFixed(1) + 'px,' + (cy * -16).toFixed(1) + 'px,0)';
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

  if (!/[?&]fog=0(&|$)/.test(location.search)) pageFog(); // ?fog=0 — отключить туман для диагностики
  heroParallax();
  spotlight('.features', '.feature');
  spotlight('.rm-cards', '.rm-card');
  securityScan();
  orbits();
})();

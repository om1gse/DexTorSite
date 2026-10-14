(function () {
  'use strict';

  var I18N = window.DEXTOR_I18N;
  var DEFAULT_LANG = I18N.defaultLang || 'en';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var page = document.body.classList.contains('page-roadmap') ? 'roadmap' : 'index';
  var lang = DEFAULT_LANG;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- Шапка ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  var burger = document.querySelector('.burger');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  document.querySelectorAll('.mobile-menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1100) setMenu(false); });

  /* ---------- Появление при прокрутке ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Счётчики ---------- */
  function formatNum(v, decimals) {
    var s = v.toFixed(decimals);
    return lang === 'ru' ? s.replace('.', ',') : s;
  }
  function renderStat(el, v) {
    el.textContent = formatNum(v, +(el.dataset.decimals || 0)) + (el.dataset.suffix || '');
  }
  var stats = document.querySelectorAll('[data-count]');
  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    if (reduceMotion || target === 0) { renderStat(el, target); el.dataset.done = '1'; return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      renderStat(el, target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else el.dataset.done = '1';
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { animateCount(e.target); so.unobserve(e.target); } });
    }, { threshold: 0.5 });
    stats.forEach(function (el) { so.observe(el); });
  }

  /* ---------- Тур по шагам мастера (главная) ---------- */
  var tour = document.querySelector('.tour');
  if (tour) {
    var steps = Array.prototype.slice.call(tour.querySelectorAll('.tour-step'));
    var screens = Array.prototype.slice.call(tour.querySelectorAll('.tour-screens img'));
    var tourIndexEl = document.getElementById('tour-index');
    var TOUR_MS = 6000;
    var current = 0, timer = null, userStopped = reduceMotion, tourVisible = false;
    tour.style.setProperty('--tour-ms', TOUR_MS + 'ms');
    if (userStopped) tour.classList.add('stopped');

    var showStep = function (i) {
      current = (i + steps.length) % steps.length;
      steps.forEach(function (s, k) {
        s.setAttribute('aria-selected', String(k === current));
        s.setAttribute('tabindex', k === current ? '0' : '-1');
        s.classList.toggle('done', k < current);
        // перезапуск анимации полосы
        var bar = s.querySelector('.bar i');
        bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
      });
      screens.forEach(function (img, k) {
        img.classList.toggle('active', k === current);
        if (Math.abs(k - current) <= 1) img.loading = 'eager';
      });
      tourIndexEl.textContent = current + 1;
      schedule();
    };
    var schedule = function () {
      clearTimeout(timer);
      if (userStopped || !tourVisible || tour.classList.contains('paused')) return;
      timer = setTimeout(function () { showStep(current + 1); }, TOUR_MS);
    };
    var stopAuto = function () { userStopped = true; tour.classList.add('stopped'); };
    steps.forEach(function (s, k) {
      s.addEventListener('click', function () { stopAuto(); showStep(k); });
      s.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = current + 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = current - 1;
        if (next !== null) { e.preventDefault(); stopAuto(); showStep(next); steps[current].focus(); }
      });
    });
    tour.addEventListener('pointerenter', function () { tour.classList.add('paused'); clearTimeout(timer); });
    tour.addEventListener('pointerleave', function () { tour.classList.remove('paused'); showStep(current); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        tourVisible = entries[0].isIntersecting;
        if (tourVisible) showStep(current); else clearTimeout(timer);
      }, { threshold: 0.35 }).observe(tour);
    }
    showStep(0);
  }

  /* ---------- Страница roadmap: активная фаза, прогресс линии ---------- */
  if (page === 'roadmap') {
    var phases = Array.prototype.slice.call(document.querySelectorAll('.phase'));
    var phasesBox = document.querySelector('.phases-inner');
    var railFill = document.querySelector('.rail-fill');
    var pillsBox = document.querySelector('.pills');
    var pills = Array.prototype.slice.call(document.querySelectorAll('.pill'));
    var gRows = Array.prototype.slice.call(document.querySelectorAll('.g-row'));
    var activePhase = -1;
    var ticking = false;

    var setActive = function (n) {
      if (n === activePhase) return;
      activePhase = n;
      phases.forEach(function (p, k) {
        p.classList.toggle('is-active', k + 1 === n);
        p.classList.toggle('reached', k + 1 <= n);
      });
      pills.forEach(function (p, k) {
        var on = k + 1 === n;
        p.classList.toggle('is-active', on);
        if (on) p.setAttribute('aria-current', 'step'); else p.removeAttribute('aria-current');
        if (on && pillsBox.scrollWidth > pillsBox.clientWidth) {
          pillsBox.scrollTo({ left: p.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
      gRows.forEach(function (r, k) { r.classList.toggle('is-active', k + 1 === n); });
    };

    var update = function () {
      ticking = false;
      var focusLine = window.innerHeight * 0.42;
      var n = 0;
      phases.forEach(function (p, k) { if (p.getBoundingClientRect().top <= focusLine) n = k + 1; });
      setActive(n);
      var box = phasesBox.getBoundingClientRect();
      var progress = (focusLine - box.top) / box.height;
      railFill.style.transform = 'scaleY(' + Math.max(0, Math.min(1, progress)) + ')';
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Язык ---------- */
  var nodes = document.querySelectorAll('[data-i18n]');
  var originals = new Map();
  nodes.forEach(function (n) { originals.set(n, n.innerHTML); });
  var altNodes = document.querySelectorAll('[data-i18n-alt]');
  altNodes.forEach(function (n) { originals.set(n, n.getAttribute('alt')); });
  var originalTitle = document.title;

  function setLang(next) {
    lang = (next && I18N[next]) || next === DEFAULT_LANG ? next : DEFAULT_LANG;
    var dict = lang === DEFAULT_LANG ? null : I18N[lang];
    document.documentElement.lang = lang;
    nodes.forEach(function (n) {
      var key = n.getAttribute('data-i18n');
      n.innerHTML = (dict && dict[key] !== undefined) ? dict[key] : originals.get(n);
    });
    altNodes.forEach(function (n) {
      var key = n.getAttribute('data-i18n-alt');
      n.setAttribute('alt', (dict && dict[key]) ? dict[key] : originals.get(n));
    });
    var titles = I18N.titles && I18N.titles[lang];
    document.title = (dict && titles && titles[page]) || originalTitle;
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    stats.forEach(function (el) { if (el.dataset.done) renderStat(el, parseFloat(el.dataset.count)); });
    store('dextor-lang', lang);
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang); });
  });

  setLang(store('dextor-lang') || DEFAULT_LANG);
})();

(function () {
  'use strict';

  var I18N = window.DEXTOR_I18N;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = 'ru';

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

  /* ---------- Подсветка карточек за курсором ---------- */
  document.querySelectorAll('.feature').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- Счётчики ---------- */
  function formatNum(v, decimals) {
    var s = v.toFixed(decimals);
    return lang === 'ru' ? s.replace('.', ',') : s;
  }
  function renderStat(el, v) {
    var d = +(el.dataset.decimals || 0);
    el.textContent = formatNum(v, d) + (el.dataset.suffix || '');
  }
  var stats = document.querySelectorAll('[data-count]');
  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    if (reduceMotion || target === 0) { renderStat(el, target); el.dataset.done = '1'; return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      renderStat(el, target * eased);
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

  /* ---------- Тур по шагам мастера ---------- */
  var tour = document.querySelector('.tour');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.tour-step'));
  var screens = Array.prototype.slice.call(document.querySelectorAll('.tour-screens img'));
  var tourIndexEl = document.getElementById('tour-index');
  var TOUR_MS = 6000;
  var current = 0, timer = null, userStopped = reduceMotion, tourVisible = false;
  tour.style.setProperty('--tour-ms', TOUR_MS + 'ms');
  if (userStopped) tour.classList.add('stopped');

  function showStep(i) {
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
  }
  function schedule() {
    clearTimeout(timer);
    if (userStopped || !tourVisible || tour.classList.contains('paused')) return;
    timer = setTimeout(function () { showStep(current + 1); }, TOUR_MS);
  }
  steps.forEach(function (s, k) {
    s.addEventListener('click', function () { userStopped = true; tour.classList.add('stopped'); showStep(k); });
    s.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = current + 1;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = current - 1;
      if (next !== null) {
        e.preventDefault(); userStopped = true; tour.classList.add('stopped');
        showStep(next); steps[current].focus();
      }
    });
  });
  tour.addEventListener('pointerenter', function () { tour.classList.add('paused'); clearTimeout(timer); });
  tour.addEventListener('pointerleave', function () {
    tour.classList.remove('paused');
    // полоса продолжит с того же места; перезапускаем отсчёт для простоты
    showStep(current);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      tourVisible = entries[0].isIntersecting;
      if (tourVisible) showStep(current); else clearTimeout(timer);
    }, { threshold: 0.35 }).observe(tour);
  }
  showStep(0);

  /* ---------- Roadmap ---------- */
  var tabsEl = document.getElementById('roadmap-tabs');
  var panel = document.getElementById('phase-panel');
  var phNum = document.getElementById('ph-num');
  var phTitle = document.getElementById('ph-title');
  var phMonths = document.getElementById('ph-months');
  var phList = document.getElementById('ph-list');
  var phPrev = document.getElementById('ph-prev');
  var phNext = document.getElementById('ph-next');
  var phase = 0;
  phPrev.addEventListener('click', function () { if (phase > 0) selectPhase(phase - 1, true); });
  phNext.addEventListener('click', function () { if (phase < I18N.roadmap[lang].length - 1) selectPhase(phase + 1, true); });

  function phaseWord() { return (I18N[lang] && I18N[lang].phase) || 'Phase'; }

  function renderTabs() {
    var data = I18N.roadmap[lang];
    tabsEl.innerHTML = '';
    data.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'phase-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'phase-panel');
      b.innerHTML = '<span class="dot">' + (i + 1) + '</span><span><span class="pt"></span><br><span class="pm"></span></span>';
      b.querySelector('.pt').textContent = phaseWord() + ' ' + (i + 1);
      b.querySelector('.pm').textContent = p.m;
      b.addEventListener('click', function () { selectPhase(i, true); });
      b.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (phase + 1) % data.length;
        if (e.key === 'ArrowLeft') n = (phase - 1 + data.length) % data.length;
        if (n !== null) { e.preventDefault(); selectPhase(n, true); tabsEl.children[n].focus(); }
      });
      tabsEl.appendChild(b);
    });
    selectPhase(phase, false);
  }

  function selectPhase(i, animate) {
    var p = I18N.roadmap[lang][i];
    phase = i;
    Array.prototype.forEach.call(tabsEl.children, function (t, k) {
      t.setAttribute('aria-selected', String(k === i));
      t.setAttribute('tabindex', k === i ? '0' : '-1');
    });
    phNum.textContent = phaseWord() + ' ' + String(i + 1).padStart(2, '0');
    phTitle.textContent = p.t;
    phMonths.textContent = p.m;
    phList.innerHTML = '';
    p.items.forEach(function (txt) {
      var li = document.createElement('li');
      li.textContent = txt;
      phList.appendChild(li);
    });
    phPrev.disabled = i === 0;
    phNext.disabled = i === I18N.roadmap[lang].length - 1;
    if (animate && !reduceMotion) {
      panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      var tab = tabsEl.children[i];
      if (tab && tabsEl.scrollWidth > tabsEl.clientWidth) {
        tabsEl.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' });
      }
    }
  }

  /* ---------- Язык ---------- */
  var nodes = document.querySelectorAll('[data-i18n]');
  var originals = new Map();
  nodes.forEach(function (n) { originals.set(n, n.innerHTML); });
  var altNodes = document.querySelectorAll('[data-i18n-alt]');
  altNodes.forEach(function (n) { originals.set(n, n.getAttribute('alt')); });
  var originalTitle = document.title;

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'ru';
    document.documentElement.lang = lang;
    var dict = I18N[lang] || {};
    nodes.forEach(function (n) {
      var key = n.getAttribute('data-i18n');
      n.innerHTML = (lang !== 'ru' && dict[key] !== undefined) ? dict[key] : originals.get(n);
    });
    altNodes.forEach(function (n) {
      var key = n.getAttribute('data-i18n-alt');
      n.setAttribute('alt', (lang !== 'ru' && dict[key]) ? dict[key] : originals.get(n));
    });
    document.title = lang === 'en' ? 'DexTor OS — secure Web3 access from USB' : originalTitle;
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    stats.forEach(function (el) { if (el.dataset.done) renderStat(el, parseFloat(el.dataset.count)); });
    renderTabs();
    store('dextor-lang', lang);
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang); });
  });

  var saved = store('dextor-lang');
  var initial = saved || ((navigator.language || '').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en');
  setLang(initial);
})();

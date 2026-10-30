/* Berimbau · interações. Tudo que é real (Resy, pedidos, Tripleseat, telefone, mapas) sai daqui para o sistema oficial. */
(function () {
  'use strict';
  var root = document.documentElement, BB = window.BB, pt = BB.lang === 'pt';
  var T = function (en, p) { return pt ? p : en; };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- Horário real de Nova York ---------- */
  var SCHED = {
    a: { 0: [[660, 1290]], 1: [[1020, 1320]], 2: [[1020, 1320]], 3: [[1020, 1320]], 4: [[1020, 1320]], 5: [[1020, 1350]], 6: [[660, 1350]] },
    b: { 0: [[690, 960], [1020, 1290]], 1: [[690, 900], [960, 1320]], 2: [[690, 900], [960, 1320]], 3: [[690, 900], [960, 1320]], 4: [[690, 900], [960, 1320]], 5: [[690, 900], [960, 1350]], 6: [[690, 960], [1020, 1350]] }
  };
  var DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function nyNow() {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { d: DAY[o.weekday], m: (+o.hour % 24) * 60 + (+o.minute), iso: o.year + '-' + o.month + '-' + o.day };
  }
  function fmt(m) {
    var h = Math.floor(m / 60), mi = m % 60;
    if (pt) return h + 'h' + (mi ? String(mi).padStart(2, '0') : '');
    var ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
    return h12 + (mi ? ':' + String(mi).padStart(2, '0') : '') + ap;
  }
  function state(side, now) {
    now = now || nyNow();
    var today = SCHED[side][now.d];
    for (var i = 0; i < today.length; i++) {
      if (now.m >= today[i][0] && now.m < today[i][1]) {
        var social = side === 'b' && now.d >= 1 && now.d <= 5 && now.m >= 960 && now.m < 1140;
        return { open: true, until: today[i][1], social: social, text: social ? T('Social Hour until ', 'Social Hour até ') + fmt(1140) : T('Open until ', 'Aberto até ') + fmt(today[i][1]) };
      }
    }
    for (var j = 0; j < today.length; j++) if (now.m < today[j][0]) return { open: false, text: (j ? T('Back at ', 'Volta às ') : T('Opens at ', 'Abre às ')) + fmt(today[j][0]) };
    var nd = (now.d + 1) % 7;
    return { open: false, text: T('Closed. Opens tomorrow ', 'Fechado. Abre amanhã às ') + fmt(SCHED[side][nd][0][0]) };
  }
  function tick() {
    var now = nyNow(), a = state('a', now), b = state('b', now), el = $('[data-now-text]');
    if (el) { var sd = root.dataset.side; el.textContent = innerWidth < 760 ? BB.sides[sd].name + ': ' + (sd === 'a' ? a : b).text : 'West Village: ' + a.text + '  ·  36th Street: ' + b.text; }
    $$('[data-status]').forEach(function (s) {
      var st = s.dataset.status === 'a' ? a : b;
      s.classList.toggle('is-open', st.open);
      s.querySelector('span').textContent = st.text;
    });
    $$('.hours tr').forEach(function (r) { r.classList.toggle('today', +r.dataset.d === now.d); });
    var clock = $('[data-clock]');
    if (clock) {
      var on = now.d >= 1 && now.d <= 5 && now.m >= 960 && now.m < 1140;
      clock.classList.toggle('is-on', on);
      var c = $('[data-clock-state]');
      if (on) c.textContent = T('On now, until 7PM', 'Rolando agora, até 19h');
      else if (now.d >= 1 && now.d <= 5 && now.m < 960) c.textContent = T('Today at 4PM', 'Hoje às 16h');
      else c.textContent = T('Mon–Fri, 4PM–7PM', 'Seg–sex, 16h–19h');
    }
  }
  tick(); setInterval(tick, 30000);
  $$('[data-until]').forEach(function (e) { if (nyNow().iso > e.dataset.until) e.hidden = true; });

  /* ---------- Lado do disco ---------- */
  function setSide(k, persist) {
    root.dataset.side = k;
    if (persist !== false) store.set('bb-side', k);
    var call = $('[data-call]'); if (call) call.href = 'tel:' + BB.sides[k].tel;
    $$('[role=tab][data-setside]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.setside === k); });
    document.dispatchEvent(new CustomEvent('bb:side', { detail: k })); tick();
  }
  setSide(root.dataset.side, false);
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-setside]');
    if (s) { store.set('bb-side', s.dataset.setside); if (s.tagName === 'BUTTON') setSide(s.dataset.setside); }
    if (e.target.closest('[data-flip]')) { setSide(root.dataset.side === 'a' ? 'b' : 'a'); pluck(.8); }
  });

  /* ---------- Diálogos reais ---------- */
  var dBook = $('#dlg-book'), dOrder = $('#dlg-order'), dLead = $('#dlg-lead'), dReel = $('#dlg-reel');
  function open(d) { if (d.open) return; d.showModal(); if (lenis) lenis.stop(); }
  $$('dialog').forEach(function (d) {
    d.addEventListener('close', function () { if (lenis) lenis.start(); if (d === dReel) $('[data-reel-frame]').src = 'about:blank'; });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close();
    var b = e.target.closest('[data-book]');
    if (b) {
      var k = b.dataset.book || root.dataset.side;
      var r = dBook.querySelector('input[value="' + k + '"]'); r.checked = true; barNote();
      open(dBook);
    }
    if (e.target.closest('[data-order]')) open(dOrder);
    if (e.target.closest('[data-lead]')) { var f = $('[data-lead-frame]'); if (f.getAttribute('src') === 'about:blank') f.src = BB.lead; open(dLead); }
    var rl = e.target.closest('[data-reel]');
    if (rl) { $('[data-reel-frame]').src = 'https://www.instagram.com/' + rl.dataset.reel + '/embed'; open(dReel); }
  });
  function barNote() { var n = $('[data-bar-note]'); var v = (new FormData($('[data-book-form]'))).get('side'); n.hidden = v !== 'b'; }
  function today() { return nyNow().iso; }
  function resyUrl(side, date, seats) { return BB.sides[side].resy + '?date=' + date + '&seats=' + seats; }
  $$('input[type=date]').forEach(function (i) { i.min = today(); i.value = today(); });
  var bf = $('[data-book-form]');
  bf.addEventListener('change', barNote);
  bf.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(bf), s = d.get('side');
    window.open(resyUrl(s, d.get('date'), d.get('seats')), '_blank', 'noopener');
    store.set('bb-side', s); dBook.close();
  });
  $$('[data-inline-book]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(f);
      window.open(resyUrl(f.dataset.inlineBook, d.get('date'), d.get('seats')), '_blank', 'noopener');
    });
  });
  $$('[data-map-load]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.closest('[data-map]'), f = document.createElement('iframe');
      f.src = m.dataset.map; f.title = T('Map', 'Mapa'); f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
      m.replaceChildren(f);
    });
  });
  /* A newsletter oficial não tem endpoint público: encaminha para o e-mail real do restaurante. */
  $$('[data-news]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = f.querySelector('input'), msg = f.querySelector('[data-news-msg]');
      if (!inp.checkValidity()) { msg.textContent = T('Please enter a valid email.', 'Digite um e-mail válido.'); return; }
      msg.textContent = T('Opening your email app to confirm…', 'Abrindo seu e-mail para confirmar…');
      location.href = 'mailto:info@berimbaurestaurant.com?subject=' + encodeURIComponent('Newsletter');
    });
  });

  /* Menu mobile */
  var bg = $('[data-burger]'), dr = $('[data-drawer]');
  bg.addEventListener('click', function () { var o = dr.hidden; dr.hidden = !o; bg.setAttribute('aria-expanded', o); root.style.overflow = o ? 'hidden' : ''; });

  /* ---------- Som: berimbau sintetizado (Karplus-Strong) ---------- */
  var ctx = null, soundOn = false, bufs = {};
  function ks(freq, dur) {
    var sr = ctx.sampleRate, n = Math.floor(sr * dur), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), p = Math.floor(sr / freq), r = new Float32Array(p), i;
    for (i = 0; i < p; i++) r[i] = Math.random() * 2 - 1;
    for (i = 0; i < n; i++) { var k = i % p, nx = (k + 1) % p; d[i] = r[k]; r[k] = (r[k] + r[nx]) * .4985; }
    return b;
  }
  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      ctx = new AC(); bufs.dom = ks(131, 1.6); bufs.dim = ks(147, 1.2); bufs.tch = ks(196, .14);
      ctx.master = ctx.createGain(); ctx.master.gain.value = .5;
      var f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 720; f.Q.value = 2.2; f.gain.value = 11;
      f.connect(ctx.master); ctx.master.connect(ctx.destination); ctx.bus = f;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function play(kind, rate) {
    if (!ctx) return;
    var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = bufs[kind]; s.playbackRate.value = rate || 1;
    g.gain.value = kind === 'tch' ? .55 : 1; s.connect(g); g.connect(ctx.bus); s.start();
  }
  function pluck(strength) { if (soundOn) play('dom', .9 + strength * .25); }
  var sb = $('[data-sound]');
  function setSound(v) { soundOn = v; sb.setAttribute('aria-pressed', v); if (v) { ensure(); play('dim'); } }
  sb.addEventListener('click', function () { setSound(!soundOn); });

  /* ---------- Corda: equação de onda 1D ---------- */
  function Corda(cv, opts) {
    var c = cv.getContext('2d'), N = opts.n || 96, y = new Float32Array(N), v = new Float32Array(N), w = 1, h = 1, dpr = 1, self = this, vertical = !!opts.vertical;
    function size() { var r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; }
    size(); addEventListener('resize', size);
    this.size = size;
    this.hit = function (t, amp, width) {
      var i0 = Math.round(t * (N - 1)), wd = width || 7;
      for (var i = 1; i < N - 1; i++) y[i] += amp * Math.exp(-((i - i0) * (i - i0)) / (2 * wd * wd));
    };
    this.step = function () {
      for (var sub = 0; sub < 3; sub++) {
        for (var i = 1; i < N - 1; i++) v[i] += .32 * (y[i - 1] + y[i + 1] - 2 * y[i]);
        for (var k = 1; k < N - 1; k++) { v[k] *= .9975; y[k] += v[k]; }
      }
    };
    this.draw = function (extra) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      c.lineWidth = opts.line || 1.6; c.strokeStyle = opts.color; c.lineJoin = 'round'; c.beginPath();
      for (var i = 0; i < N; i++) {
        var t = i / (N - 1);
        if (vertical) { var px = w / 2 + y[i]; var py = t * h; i ? c.lineTo(px, py) : c.moveTo(px, py); }
        else { var qx = t * w, qy = h / 2 + y[i]; i ? c.lineTo(qx, qy) : c.moveTo(qx, qy); }
      }
      c.stroke();
      if (extra) extra(c, w, h, y, N);
    };
    this.y = y;
  }

  var strings = [];
  var hero = $('[data-string]'), cover = $('[data-cover]');
  var heroC = null;
  if (hero) {
    heroC = new Corda(hero, { color: '#faf0d2', line: 1.8, n: 120 });
    strings.push(heroC);
    var lastY = null;
    var mv = function (e) {
      var r = hero.getBoundingClientRect(), my = r.top + r.height / 2, x = (e.clientX - r.left) / r.width, cross = lastY !== null && (lastY - my) * (e.clientY - my) <= 0;
      if (cross && x > 0 && x < 1) { var a = Math.min(60, 14 + Math.abs(e.clientY - lastY) * .9); heroC.hit(x, (e.clientY > lastY ? 1 : -1) * a); pluck(x); wave(x); }
      lastY = e.clientY;
    };
    cover.addEventListener('pointermove', mv);
    cover.addEventListener('pointerleave', function () { lastY = null; });
    cover.addEventListener('pointerdown', function (e) { lastY = null; var r = hero.getBoundingClientRect(); if (Math.abs(e.clientY - (r.top + r.height / 2)) < 90 && !e.target.closest('a,button')) { var x = (e.clientX - r.left) / r.width; heroC.hit(x, 34); pluck(x); wave(x); } });
    if (reduce) setTimeout(function () { heroC.draw(); }, 50);
  }
  var railC = null, rail = $('[data-rail]'), chapters = [];
  if (rail && !reduce) {
    railC = new Corda(rail, { color: '#faf0d2', line: 1.2, n: 80, vertical: true });
    strings.push(railC);
  }

  /* ---------- Palavra BERIMBAU: largura variável como ritmo ---------- */
  var wordEl = $('[data-word]'), letters = [], wTarget = [], wNow = [], mouseX = null;
  function fitWord() {
    if (!wordEl) return;
    wordEl.style.fontSize = '100px';
    letters.forEach(function (l) { l.style.fontStretch = '100%'; });
    var tot = 0; letters.forEach(function (l) { tot += l.getBoundingClientRect().width; });
    var box = wordEl.parentElement.clientWidth - parseFloat(getComputedStyle(wordEl.parentElement).paddingLeft) * 2;
    wordEl.style.fontSize = (100 * box / tot * .985) + 'px';
  }
  if (wordEl) {
    var txt = wordEl.textContent; wordEl.textContent = '';
    txt.split('').forEach(function (ch) { var s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); wordEl.appendChild(s); letters.push(s); wTarget.push(100); wNow.push(100); });
    fitWord(); addEventListener('resize', fitWord);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
    cover.addEventListener('pointermove', function (e) { var r = wordEl.getBoundingClientRect(); mouseX = (e.clientX - r.left) / r.width; });
    cover.addEventListener('pointerleave', function () { mouseX = null; });
  }
  var waveT = -1, waveX = 0;
  function wave(x) { waveT = 0; waveX = x; }
  function hitLetter(i, big) { if (!letters[i]) return; letters[i].classList.add('hit'); setTimeout(function () { letters[i].classList.remove('hit'); }, 170); wNow[i] = big ? 150 : 128; }
  function animWord(time) {
    var n = letters.length; if (!n) return;
    for (var i = 0; i < n; i++) {
      var t = (i + .5) / n, target = 100 + (reduce ? 0 : 6 * Math.sin(time * 1.1 + i * .9));
      if (mouseX !== null) { var d = t - mouseX; target += 46 * Math.exp(-d * d / .012) - 14; }
      if (waveT >= 0) { var dw = Math.abs(t - waveX) - waveT * .9; target += 40 * Math.exp(-dw * dw / .01) * Math.max(0, 1 - waveT); }
      wNow[i] += (target - wNow[i]) * .16;
      letters[i].style.fontStretch = Math.max(50, Math.min(150, wNow[i])).toFixed(1) + '%';
    }
    if (waveT >= 0) { waveT += .03; if (waveT > 1) waveT = -1; }
  }

  /* ---------- Toque: tch tch DOM DIM ---------- */
  var tq = $('[data-toque]'), tqTimer = null;
  if (tq) tq.addEventListener('click', function () {
    if (tqTimer) { clearInterval(tqTimer); tqTimer = null; tq.setAttribute('aria-pressed', 'false'); return; }
    tq.setAttribute('aria-pressed', 'true'); ensure();
    var step = 0, pat = ['tch', 'tch', 'dom', 'dim'], pos = [1, 2, 4, 6];
    var run = function () {
      var k = pat[step % 4]; play(k);
      if (heroC) heroC.hit(.2 + (step % 4) * .2, k === 'tch' ? 7 : k === 'dom' ? 38 : -30, k === 'tch' ? 3 : 9);
      hitLetter(pos[step % 4], k !== 'tch'); step++;
    };
    run(); tqTimer = setInterval(run, 230);
  });

  /* ---------- GSAP / Lenis ---------- */
  var lenis = null, gsap = window.gsap, ST = window.ScrollTrigger;
  if (gsap && ST) gsap.registerPlugin(ST);
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: .11, smoothWheel: true });
    if (ST) lenis.on('scroll', ST.update);
  }
  var coin = 0;
  function loop(ms) {
    var time = ms / 1000;
    if (lenis) lenis.raf(ms);
    var vel = lenis ? lenis.velocity : 0;
    animWord(time);
    if (railC) { if (Math.abs(vel) > 1) railC.hit(.1 + Math.random() * .8, Math.max(-9, Math.min(9, vel * .35)), 5); }
    if (!reduce) strings.forEach(function (s) { s.step(); });
    if (heroC && !reduce) heroC.draw();
    if (railC) {
      var max = document.documentElement.scrollHeight - innerHeight;
      coin = max > 0 ? scrollY / max : 0;
      railC.draw(function (c, w, h, y, N) {
        var yy = coin * h, ix = Math.round(coin * (N - 1));
        c.fillStyle = '#ff9b87'; c.beginPath(); c.arc(w / 2 + y[ix], yy, 6, 0, 7); c.fill();
      });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* Vídeos só tocam quando visíveis */
  var film = $('[data-film]');
  var vids = $$('video[data-film],video[data-lazyvid]');
  if (reduce) vids.forEach(function (v) { v.removeAttribute('autoplay'); });
  else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var p = e.target.play(); if (p) p.catch(function () {}); } else e.target.pause(); }); }, { threshold: .1 });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* Palavras do encarte */
  var lit = $('[data-lit]'), words = [];
  if (lit) {
    var parts = lit.textContent.split(/(\s+)/); lit.textContent = '';
    parts.forEach(function (p) { if (/^\s+$/.test(p)) lit.appendChild(document.createTextNode(p)); else { var s = document.createElement('span'); s.className = 'w'; s.textContent = p; lit.appendChild(s); words.push(s); } });
  }

  /* Rampa de escada que revela o Second Floor */
  function stairClip(p) {
    var n = 7, pts = ['0% 100%'], off = (1 - 2.1 * p) * 100, i;
    for (i = 0; i < n; i++) {
      var y = 100 * (1 - (i + 1) / n) + off, a = 100 * i / n, b = 100 * (i + 1) / n;
      pts.push(a + '% ' + y + '%', b + '% ' + y + '%');
    }
    pts.push('100% 100%');
    return 'polygon(' + pts.join(',') + ')';
  }

  if (ST && !reduce) {
    if (lit) ST.create({ trigger: lit, start: 'top 82%', end: 'bottom 62%', scrub: true, onUpdate: function (s) { var k = Math.floor(s.progress * words.length * 1.02); words.forEach(function (w, i) { w.classList.toggle('on', i < k); }); } });

    var anat = $('[data-anat]');
    if (anat && innerWidth > 900) {
      var steps = $$('[data-astep]', anat), parts2 = $$('[data-part]', anat), cur = -1;
      var go = function (i) {
        if (i === cur) return; cur = i;
        steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
        parts2.forEach(function (p) { p.classList.toggle('on', p.dataset.part === steps[i].dataset.astep); });
        if (railC) railC.hit(.5, 12);
        if (i > 0) pluck(i / 4);
      };
      go(0);
      ST.create({ trigger: anat, start: 'top top', end: 'bottom bottom', onUpdate: function (s) { go(Math.min(3, Math.floor(s.progress * 4))); } });
    }

    var st = $('[data-stairs]');
    if (st) {
      var mask = $('[data-stair-mask]'), tx = $('[data-stair-text]'), moon = $('.stairs__moon');
      mask.style.clipPath = stairClip(.2);
      ST.create({ trigger: st, start: 'top top', end: 'bottom bottom', onUpdate: function (s) {
        mask.style.clipPath = stairClip(Math.min(1, .2 + s.progress * 1.3));
        tx.classList.toggle('on', s.progress > .58);
        moon.style.transform = 'translateY(' + (60 - s.progress * 60) + 'px)';
      } });
    }

    $$('[data-par]').forEach(function (p) { gsap.fromTo(p.firstElementChild, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: p.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }); });

    var last = $('.last__onca');
    if (last) gsap.fromTo(last, { xPercent: 70 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '[data-last]', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    var disc = $('[data-disc]'), arm = $('[data-arm]');
    if (disc) {
      gsap.to(disc, { rotation: 360, duration: 3.2, ease: 'none', repeat: -1 });
      gsap.fromTo(arm, { rotation: 0 }, { rotation: 20, ease: 'none', scrollTrigger: { trigger: '[data-sf]', start: 'top top', end: 'bottom 30%', scrub: true } });
    }

    var rvs = $$('.sidecard,.sp,.way,.rules__l li,.credits li,.wall__i,.dr,.mosaic__t,.mosaic figure,.tk__i,.astep__x').filter(function (e) { return !e.closest('[hidden]'); });
    rvs.forEach(function (e) { e.classList.add('rv'); });
    ST.batch(rvs, { start: 'top 92%', once: true, interval: .08, batchMax: 8, onEnter: function (b) { b.forEach(function (e, i) { e.style.transitionDelay = (i * 45) + 'ms'; e.classList.add('in'); }); } });
    addEventListener('load', function () { ST.refresh(); });
  } else if (st0()) { /* sem animação */ }
  function st0() { var m = $('[data-stair-mask]'); if (m) m.style.clipPath = 'none'; return false; }

  /* Foto flutuante do tracklist */
  var peek = $('[data-peek-img]'), pk = $('[data-peek]');
  if (peek && pk && innerWidth > 900) {
    var qx = gsap ? gsap.quickTo(peek, 'x', { duration: .45 }) : null, qy = gsap ? gsap.quickTo(peek, 'y', { duration: .45 }) : null;
    pk.addEventListener('pointermove', function (e) { if (qx) { qx(e.clientX + 24 - (e.clientX > innerWidth * .6 ? 330 : 0)); qy(e.clientY - 170); } });
    $$('[data-pic]', pk).forEach(function (r) { r.addEventListener('pointerenter', function (e) { peek.src = r.dataset.pic; gsap.set(peek, { x: e.clientX + 24 - (e.clientX > innerWidth * .6 ? 330 : 0), y: e.clientY - 170 }); peek.style.opacity = 1; }); });
    pk.addEventListener('pointerleave', function () { peek.style.opacity = 0; });
  }

  /* Afinador de caipirinha */
  $$('[data-tune]').forEach(function (b) {
    var r = $('[data-tune-range]', b), nm = $('[data-tune-name]', b), fl = $('[data-tune-fill]', b);
    var F = [[T('Lime', 'Limão'), '#a9d353', '62%', 1], [T('Mango', 'Manga'), '#faaa00', '72%', 1.122], [T('Guava', 'Goiaba'), '#ff9b87', '82%', 1.26], [T('Cashew fruit', 'Caju'), '#e8742a', '92%', 1.335]];
    var set = function () { var f = F[+r.value]; b.style.setProperty('--f', f[1]); fl.style.setProperty('--lvl', f[2]); nm.textContent = f[0]; nm.style.fontSize = f[0].length > 7 ? 'clamp(58px,11.6vw,220px)' : ''; if (soundOn) play('dim', f[3]); };
    r.addEventListener('input', set); var was = soundOn; soundOn = false; set(); soundOn = was;
  });

  /* ---------- Tracklist completo ---------- */
  var mns = $$('[data-mn]');
  if (mns.length) {
    var AV = { a: ['dinner', 'brunch'], b: ['dinner', 'lunch', 'exec', 'brunch', 'desserts', 'cocktails', 'social'] };
    var params = new URLSearchParams(location.search), cSide = params.get('side') || root.dataset.side, cSvc = params.get('svc');
    var q = $('[data-q]'), vegBtn = $('[data-vegan]'), count = $('[data-count]'), empty = $('[data-empty]'), vegOnly = false;
    if (AV[cSide] === undefined) cSide = 'a';
    function defaultSvc(s) {
      var n = nyNow(), wk = n.d >= 1 && n.d <= 5;
      if (s === 'a') return n.d === 0 || n.d === 6 ? (n.m < 960 ? 'brunch' : 'dinner') : 'dinner';
      if (wk) { if (n.m >= 960 && n.m < 1140) return 'social'; if (n.m < 900) return 'lunch'; return 'dinner'; }
      return n.m < 960 ? 'brunch' : 'dinner';
    }
    function render() {
      var q0 = q.value.trim().toLowerCase(), shown = 0;
      $$('[data-menu-side]').forEach(function (b) { var on = b.dataset.menuSide === cSide; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      $$('[data-menu-svc]').forEach(function (b) { var k = b.dataset.menuSvc; b.hidden = AV[cSide].indexOf(k) < 0; var on = k === cSvc; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      var searching = q0.length > 1;
      mns.forEach(function (m) {
        var id = m.dataset.mn, sameSide = id.charAt(0) === cSide, active = searching ? sameSide : id === cSide + '-' + cSvc, any = 0;
        if (!active) { m.hidden = true; return; }
        m.hidden = false;
        $$('[data-gr]', m).forEach(function (g) {
          var vis = 0;
          $$('.tr', g).forEach(function (r) {
            var ok = (!q0 || r.dataset.q.indexOf(q0) >= 0) && (!vegOnly || r.dataset.tags.indexOf('vegan') >= 0);
            r.hidden = !ok; if (ok) vis++;
          });
          g.hidden = !vis; any += vis;
        });
        if (!any) m.hidden = true;
        shown += any;
      });
      empty.hidden = shown > 0;
      count.textContent = shown + (pt ? (shown === 1 ? ' faixa' : ' faixas') : (shown === 1 ? ' track' : ' tracks'));
    }
    if (!cSvc || AV[cSide].indexOf(cSvc) < 0) cSvc = defaultSvc(cSide);
    $$('[data-menu-side]').forEach(function (b) {
      b.addEventListener('click', function () { cSide = b.dataset.menuSide; if (AV[cSide].indexOf(cSvc) < 0) cSvc = 'dinner'; setSide(cSide); render(); });
    });
    $$('[data-menu-svc]').forEach(function (b) { b.addEventListener('click', function () { cSvc = b.dataset.menuSvc; q.value = ''; render(); scrollTop(); }); });
    function scrollTop() { var y = $('.ctrl').getBoundingClientRect().top + scrollY - 92; if (scrollY > y) { if (lenis) lenis.scrollTo(y, { immediate: true }); else scrollTo(0, y); } }
    q.addEventListener('input', render);
    vegBtn.addEventListener('click', function () { vegOnly = !vegOnly; vegBtn.setAttribute('aria-pressed', vegOnly); render(); });
    setSide(cSide, false); render();

    /* Setlist da mesa: estimativa local, nunca um pedido */
    var sl = $('[data-setlist]'), set = [];
    try { set = JSON.parse(store.get('bb-setlist') || '[]'); } catch (e) { set = []; }
    function draw() {
      sl.hidden = !set.length;
      $('[data-sl-count]').textContent = set.length;
      var tot = set.reduce(function (a, i) { return a + (i.price || 0); }, 0);
      $('[data-sl-total]').textContent = '$' + tot;
      var list = $('[data-sl-list]'); list.textContent = '';
      set.forEach(function (i) { var li = document.createElement('li'); var a = document.createElement('span'); a.textContent = i.name; var b = document.createElement('span'); b.textContent = i.price || '—'; li.append(a, b); list.appendChild(li); });
      $$('.tr').forEach(function (r) { var on = set.some(function (i) { return i.id === r.dataset.id; }); r.querySelector('[data-add]').setAttribute('aria-pressed', on); });
      store.set('bb-setlist', JSON.stringify(set));
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-add]'); if (!a) return;
      var r = a.closest('.tr'), id = r.dataset.id, ix = set.findIndex(function (i) { return i.id === id; });
      if (ix >= 0) set.splice(ix, 1); else { set.push({ id: id, name: r.dataset.name, price: r.dataset.price ? +r.dataset.price : null }); pluck(.5); }
      draw();
    });
    $('[data-setlist-toggle]').addEventListener('click', function (e) { var p = $('[data-sl-panel]'), o = p.hidden; p.hidden = !o; e.currentTarget.setAttribute('aria-expanded', o); });
    $('[data-sl-clear]').addEventListener('click', function () { set = []; draw(); });
    draw();
  }

  /* Buscador de salas */
  var fnd = $('[data-finder]');
  if (fnd) {
    var g = $('[data-f-guests]'), out = $('[data-f-out]'), cnt = $('[data-f-count]'), none = $('[data-f-none]'), fmtS = 'seated';
    var sps = $$('[data-sp]'), up = function () {
      var n = +g.value, c = 0; out.textContent = n;
      sps.forEach(function (s) {
        var cap = Math.max(+s.dataset[fmtS], +s.dataset.mixed), ok = cap >= n;
        s.hidden = !ok; if (ok) c++;
      });
      none.hidden = c > 0;
      cnt.textContent = c ? c + (pt ? (c > 1 ? ' espaços comportam ' : ' espaço comporta ') : (c > 1 ? ' rooms fit ' : ' room fits ')) + n + T(' guests', ' convidados') : '';
    };
    g.addEventListener('input', up);
    $$('[data-f-style]').forEach(function (b) { b.addEventListener('click', function () { fmtS = b.dataset.fStyle; $$('[data-f-style]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); up(); }); });
    up();
  }

  /* Depoimentos */
  var vs = $$('[data-voice]');
  if (vs.length) {
    var vi = 0, vn = $('[data-voice-n]'), sv = function (d) { vs[vi].hidden = true; vi = (vi + d + vs.length) % vs.length; vs[vi].hidden = false; vn.textContent = (vi + 1) + '/' + vs.length; };
    $('[data-voice-prev]').addEventListener('click', function () { sv(-1); });
    $('[data-voice-next]').addEventListener('click', function () { sv(1); });
  }

  /* Âncoras internas */
  $$('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function (e) { var t = $(a.getAttribute('href')); if (t && lenis) { e.preventDefault(); lenis.scrollTo(t, { offset: -92 }); } }); });
})();

/*
 * Bouton aimanté : l'ombre des boutons blancs (.btn-white) s'écarte du curseur, comme deux
 * aimants qui se repoussent, et le bouton s'écarte très légèrement dans l'autre sens.
 *
 * Position du curseur ramenée au bouton (u, de -1 à 1 sur chaque axe) ; l'ombre part à l'opposé.
 * Au bord du bouton, écart maximal ; au centre, aucun. À l'approche (portée), l'écart diminue
 * avec la distance. Mouvement amorti par un ressort : l'ombre suit avec un léger retard et
 * rebondit en revenant.
 *
 * Le script écrit --sx, --sy (décalage de l'ombre), --tx, --ty (déplacement du bouton) sur
 * chaque bouton ; le CSS de .btn-white les utilise. Rien ne bouge sans souris (tactile) ou avec
 * « réduire les animations » : l'ombre reste au repos.
 * Réglages à chaud : window.boutonAimant (valeurs choisies par Denis, 17 novembre 2026).
 *
 * Variante « repousse » (data-aimant="repousse", carte de Rose, photo de Pauline) : c'est l'élément lui-même qui
 * s'écarte du curseur, et son ombre le suit avec un peu plus d'écart (effet de hauteur). Le script
 * écrit --tx, --ty (déplacement de l'élément) et --sx, --sy (décalage de l'ombre) ; le CSS les utilise.
 */
(function () {
  'use strict';

  var A = window.boutonAimant = {
    push: 22,       // écart maximal de l'ombre, en px
    reach: 90,      // portée à l'approche, en px autour du bouton (0 = seulement au survol)
    stiffness: 245, // raideur du ressort
    damping: 14,    // amortissement (plus bas = plus de rebond)
    move: 0.09,     // part de l'écart appliquée au bouton, dans l'autre sens (0 = immobile)
    restY: 16,      // ombre au repos : décalage vers le bas, en px (même valeur que le CSS)
    // Variante « repousse » (carte de Rose)
    cardPush: 10,   // écart maximal de la carte, en px (16 avant le 18 novembre) ; data-aimant-push pour un autre élément
    cardReach: 140, // portée à l'approche, en px
    cardShadow: 0.6 // part de l'écart ajoutée à l'ombre, dans le même sens (elle suit la carte)
  };

  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  if (mq('(prefers-reduced-motion: reduce)') || !mq('(hover: hover) and (pointer: fine)')) return;

  var btns = [], px = -1e4, py = -1e4, raf = 0, last = 0;

  function target(b) {
    var r = b.el.getBoundingClientRect();
    if (!r.width) { b.tx = b.ty = 0; return; }
    var hw = r.width / 2, hh = r.height / 2;
    // Centre au repos : on retire le déplacement que le script a donné à l'élément lui-même.
    var dx0 = b.repel ? b.x : -b.x * A.move, dy0 = b.repel ? b.y : -b.y * A.move;
    var cx = r.left + hw - dx0, cy = r.top + hh - dy0;
    var dx = px - cx, dy = py - cy;
    // Distance au bord du bouton (0 dedans), et position relative (u) pour la direction.
    var ex = Math.max(Math.abs(dx) - hw, 0), ey = Math.max(Math.abs(dy) - hh, 0);
    var out = Math.sqrt(ex * ex + ey * ey);
    var ux = dx / hw, uy = dy / hh, ul = Math.sqrt(ux * ux + uy * uy) || 1;
    var reach = b.repel ? A.cardReach : A.reach, push = b.repel ? (b.push || A.cardPush) : A.push;
    var k = out > 0 ? (reach > 0 ? Math.max(0, 1 - out / reach) : 0) : Math.min(1, ul);
    // Direction opposée au curseur ; vertical un peu atténué (le bouton est large et bas).
    b.tx = -ux / ul * push * k;
    b.ty = -uy / ul * push * k * 0.8;
  }

  function frame(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 0.033); last = now;
    var moving = false;
    btns.forEach(function (b) {
      target(b);
      var ax = A.stiffness * (b.tx - b.x) - A.damping * b.vx;
      var ay = A.stiffness * (b.ty - b.y) - A.damping * b.vy;
      b.vx += ax * dt; b.vy += ay * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      var s = b.el.style;
      if (b.repel) {   // la carte s'écarte, l'ombre la suit un peu plus loin
        s.setProperty('--tx', b.x.toFixed(2) + 'px');
        s.setProperty('--ty', b.y.toFixed(2) + 'px');
        s.setProperty('--sx', (b.x * A.cardShadow).toFixed(2) + 'px');
        s.setProperty('--sy', (b.y * A.cardShadow).toFixed(2) + 'px');
      } else {
        s.setProperty('--sx', b.x.toFixed(2) + 'px');
        s.setProperty('--sy', (A.restY + b.y).toFixed(2) + 'px');
        s.setProperty('--tx', (-b.x * A.move).toFixed(2) + 'px');
        s.setProperty('--ty', (-b.y * A.move).toFixed(2) + 'px');
      }
      if (Math.abs(b.x - b.tx) + Math.abs(b.y - b.ty) + Math.abs(b.vx) + Math.abs(b.vy) > 0.02) moving = true;
    });
    if (moving) raf = requestAnimationFrame(frame);
  }
  function kick() { if (btns.length && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function init() {
    btns = [].slice.call(document.querySelectorAll('.btn-white, [data-aimant="repousse"]')).map(function (el) {
      return { el: el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, repel: el.getAttribute('data-aimant') === 'repousse',
        push: parseFloat(el.getAttribute('data-aimant-push')) || 0 };   // écart propre à l'élément (photo de Pauline : plus doux)
    });
    if (!btns.length) return; // aucun élément aimanté sur la page : rien à écouter
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY; kick();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { px = py = -1e4; kick(); });
    window.addEventListener('scroll', kick, { passive: true });
  }
  A.refresh = kick;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

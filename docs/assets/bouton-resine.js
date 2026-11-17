/*
 * Bouton résine : au survol, le bouton se remplit de résine de bas en haut, puis se vide
 * quand la souris le quitte.
 *
 * La matière est la photo du héro (hero.jpg), lue à travers un bruit lent : on garde les
 * teintes de la résine, sans mélange de couleurs. Un grain fin donne l'aspect poudreux, un
 * ombrage léger donne du volume, le bord du liquide est bosselé et ondule.
 *
 * Utilisation : <script src="../assets/bouton-resine.js" data-src="../assets/v2/hero.jpg" defer>
 * Boutons concernés : .btn-navy (Primary) et .btn-ghost (Secondary).
 * - Primary : résine franche ; le texte passe du blanc au bleu nuit sous le niveau du liquide.
 * - Secondary : résine plus pâle (mêlée de blanc), contour rose, texte bleu nuit inchangé.
 *
 * Un seul canvas WebGL 2 pour toute la page, posé dans le bouton survolé.
 * Rien ne change sans souris (tactile), sans WebGL 2 ou avec « réduire les animations » :
 * le survol CSS d'origine reste en place.
 * Réglages à chaud : window.boutonResine (fill, drain, grain, wave, lighten, lightenGhost).
 */
(function () {
  'use strict';

  var CFG = window.boutonResine = {
    fill: 3.6,          // durée du remplissage, en secondes (plein à l'œil vers 2,5 s, puis se pose)
    drain: 0.6,         // durée de la descente, en secondes
    grain: 0.08,        // force du grain poudreux
    wave: 1,            // amplitude des vagues du bord (0 = bord plat)
    lighten: 0.18,      // Primary : part de blanc mêlée à la résine (lisibilité du texte bleu nuit)
    lightenGhost: 0.45, // Secondary : résine plus pâle
    zoom: 0.24          // hauteur de la fenêtre lue dans la photo (plus petit = plus zoomé)
  };

  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  if (mq('(prefers-reduced-motion: reduce)')) return;

  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || 'assets/v2/hero.jpg';
  var SELECTOR = '.btn-navy, .btn-ghost';

  /* Bord du liquide : même fonction en JS (découpe du texte) et en GLSL (rendu).
     x de 0 à 1 sur la largeur, résultat en fraction de la hauteur depuis le bas. */
  function surface(x, s) {
    var X = x * s.aspect;
    var w = s.amp * (0.5 * Math.sin(X * 2.6 + s.t * 1.9) +
                     0.3 * Math.sin(X * 5.3 - s.t * 2.7 + 1.3) +
                     0.2 * Math.sin(X * 9.1 + s.t * 3.4 + 0.7));
    var d = (x - s.bumpC) * s.aspect / 0.9;
    return s.level + w + s.bumpA * Math.exp(-d * d);
  }

  var VS = '#version 300 es\n' +
    'in vec2 p; out vec2 v;\n' +
    'void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D tex;\n' +
    'uniform vec2 res;\n' +        // taille du canvas en pixels
    'uniform vec4 win;\n' +        // fenêtre lue dans la photo : x0, y0, largeur, hauteur (uv)
    'uniform float t, level, amp, bumpA, bumpC, aspect, grain, lighten, fill;\n' +
    'uniform vec3 mixCol;\n' +
    'uniform vec4 bg;\n' +           // fond hors du liquide (bleu nuit pour le Primary, transparent sinon)
    'in vec2 v; out vec4 o;\n' +
    'float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }\n' +
    'float fbm(vec2 q){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++){ s += a * noise(q); q = q * 2.03 + 17.1; a *= 0.5; } return s; }\n' +
    'float surf(float x){ float X = x * aspect;\n' +
    '  float w = amp * (0.5 * sin(X * 2.6 + t * 1.9) + 0.3 * sin(X * 5.3 - t * 2.7 + 1.3) + 0.2 * sin(X * 9.1 + t * 3.4 + 0.7));\n' +
    '  float d = (x - bumpC) * aspect / 0.9; return level + w + bumpA * exp(-d * d); }\n' +
    'void main(){\n' +
    '  float px = 1.0 / res.y;\n' +
    '  float depth = surf(v.x) - v.y;\n' +                               // > 0 sous la surface
    '  float a = smoothstep(-0.8 * px, 0.8 * px, depth);\n' +
    '  if (a <= 0.0) { o = bg; return; }\n' +
    '  vec2 P = vec2(v.x * aspect, v.y);\n' +
    // Matière épaisse : la photo est lue à travers deux couches de bruit imbriquées qui dérivent
    // lentement (plis, volutes), et monte un peu avec le niveau (le liquide pousse vers le haut).
    '  vec2 q = vec2(fbm(P * 1.3 + vec2(0.0, -t * 0.14)), fbm(P * 1.3 + vec2(5.2, 1.3 + t * 0.1)));\n' +
    '  vec2 r = vec2(fbm(P * 1.7 + 4.0 * q + vec2(1.7, 9.2) + t * 0.06), fbm(P * 1.7 + 4.0 * q + vec2(8.3, 2.8) - t * 0.05));\n' +
    '  vec2 uv = vec2(v.x, 1.0 - v.y + fill * 0.3) + (r - 0.5) * vec2(0.7 / aspect, 0.9);\n' +
    '  vec3 c = texture(tex, win.xy + win.zw * uv).rgb;\n' +
    // Volume : relief tiré du même bruit, éclairé du haut à gauche ; creux des plis plus sombres.
    '  float h0 = fbm(P * 2.4 + 3.0 * r);\n' +
    '  float hx = fbm((P + vec2(0.015, 0.0)) * 2.4 + 3.0 * r);\n' +
    '  float hy = fbm((P + vec2(0.0, 0.015)) * 2.4 + 3.0 * r);\n' +
    '  vec3 n = normalize(vec3((h0 - hx) * 9.0, (h0 - hy) * 9.0, 1.0));\n' +
    '  float light = dot(n, normalize(vec3(-0.5, 0.6, 0.8)));\n' +
    '  c *= 0.74 + 0.4 * light;\n' +
    '  c *= mix(0.84, 1.08, smoothstep(0.2, 0.8, h0));\n' +
    // Bord : bourrelet plus sombre juste sous la surface, liseré clair sur le bord.
    '  float dpx = depth / px;\n' +
    '  c *= 0.84 + 0.16 * smoothstep(0.0, 10.0, dpx);\n' +
    '  c += 0.16 * (1.0 - smoothstep(0.0, 2.0, dpx));\n' +
    '  c = mix(c, mixCol, lighten);\n' +
    // Grain poudreux, renouvelé 12 fois par seconde.
    '  c += (hash(gl_FragCoord.xy + floor(t * 12.0) * 7.13) - 0.5) * grain;\n' +
    '  o = mix(bg, vec4(clamp(c, 0.0, 1.0), 1.0), a);\n' +
    '}';

  var canvas, gl, prog, U = {}, texReady = false, imgW = 3, imgH = 2;

  function initGL() {
    canvas = document.createElement('canvas');
    canvas.className = 'rb-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['tex', 'res', 'win', 't', 'level', 'amp', 'bumpA', 'bumpC', 'aspect', 'grain', 'lighten', 'fill', 'mixCol', 'bg']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); disable(); });
    return true;
  }

  function loadTexture(done) {
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      imgW = img.naturalWidth; imgH = img.naturalHeight;
      var tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      gl.uniform1i(U.tex, 0);
      texReady = true;
      done();
    };
    img.src = SRC;
  }

  /* État du bouton qui porte le canvas. p : avancement de 0 (vide) à 1 (plein). */
  var cur = null, raf = 0, last = 0;

  function ease(p) { return 1 - Math.pow(1 - p, 1.6); }

  function state(b, now) {
    var p = b.p;
    return {
      aspect: b.w / b.h,
      t: (now - b.t0) / 1000,
      level: -0.45 + 1.9 * ease(p),
      amp: 0.1 * CFG.wave,
      bumpA: 0.35 * (1 - p) * (1 - p),
      bumpC: b.bumpC
    };
  }

  function attach(btn) {
    if (cur && cur.btn === btn) { cur.hover = true; start(); return; }
    if (cur) release();
    var ghost = btn.classList.contains('btn-ghost');
    var pad = ghost ? 0 : 2; // Primary : le liquide recouvre aussi la bordure transparente
    var w = btn.clientWidth + 2 * pad, h = btn.clientHeight + 2 * pad;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.inset = (-pad) + 'px';
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    btn.insertBefore(canvas, btn.firstChild);
    // Fenêtre lue dans la photo : position tirée au hasard à chaque survol.
    var wh = CFG.zoom, ww = wh * (w / h) * (imgH / imgW);
    if (ww > 1) { wh /= ww; ww = 1; }
    var label = null;
    if (!ghost) {
      label = btn.querySelector('.rb-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'rb-label';
        label.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(btn.childNodes, function (n) {
          if (n !== canvas && !(n.classList && n.classList.contains('rb-label'))) label.appendChild(n.cloneNode(true));
        });
        btn.appendChild(label);
      }
    }
    btn.classList.add('rb-on');
    cur = {
      btn: btn, ghost: ghost, label: label, w: w, h: h, p: 0, hover: true,
      t0: performance.now() - Math.random() * 20000,
      bumpC: 0.2 + Math.random() * 0.6,
      win: [Math.random() * (1 - ww), Math.random() * (1 - wh), ww, wh]
    };
    draw(performance.now()); // première image tout de suite : pas d'image vide au survol
    start();
  }

  function release() {
    if (!cur) return;
    cur.btn.classList.remove('rb-on');
    if (cur.label) cur.label.style.clipPath = 'inset(100% 0 0 0)';
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    cur = null;
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function frame(now) {
    raf = 0;
    if (!cur) return;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (cur.hover) cur.p = Math.min(1, cur.p + dt / CFG.fill);
    else cur.p = Math.max(0, cur.p - dt / CFG.drain);
    if (cur.p <= 0 && !cur.hover) { release(); return; }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function draw(now) {
    var s = state(cur, now);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform4f(U.win, cur.win[0], cur.win[1], cur.win[2], cur.win[3]);
    gl.uniform1f(U.t, s.t); gl.uniform1f(U.level, s.level); gl.uniform1f(U.amp, s.amp);
    gl.uniform1f(U.bumpA, s.bumpA); gl.uniform1f(U.bumpC, s.bumpC); gl.uniform1f(U.aspect, s.aspect);
    gl.uniform1f(U.grain, CFG.grain); gl.uniform1f(U.fill, ease(cur.p));
    gl.uniform1f(U.lighten, cur.ghost ? CFG.lightenGhost : CFG.lighten);
    gl.uniform3f(U.mixCol, 0.984, 0.976, 1.0); // papier #FBF9FF
    if (cur.ghost) gl.uniform4f(U.bg, 0, 0, 0, 0);
    else gl.uniform4f(U.bg, 0.067, 0.059, 0.224, 1); // bleu nuit #110F39
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (cur.label) {
      // Texte bleu nuit découpé selon le bord du liquide (même fonction que le shader).
      var pts = ['0% 100%', '100% 100%'];
      for (var i = 24; i >= 0; i--) {
        var x = i / 24, y = surface(x, s);
        pts.push((x * 100).toFixed(2) + '% ' + ((1 - y) * 100).toFixed(2) + '%');
      }
      cur.label.style.clipPath = 'polygon(' + pts.join(',') + ')';
    }
  }

  function enter(e) {
    var btn = e.target.closest && e.target.closest(SELECTOR);
    if (!btn || !btn.classList.contains('rb')) return;
    if (e.type === 'pointerover' && e.pointerType === 'touch') return;
    if (e.type === 'focusin' && !btn.matches(':focus-visible')) return;
    if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
    attach(btn);
  }
  function leave(e) {
    if (!cur) return;
    var btn = e.target.closest && e.target.closest(SELECTOR);
    if (btn !== cur.btn) return;
    if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
    if (e.type === 'pointerout' && btn.matches(':focus-visible')) return;
    if (e.type === 'focusout' && btn.matches(':hover')) return;
    cur.hover = false; start();
  }

  function disable() {
    release();
    document.querySelectorAll(SELECTOR).forEach(function (b) { b.classList.remove('rb'); });
  }

  function init() {
    // Sans souris (écran tactile seul) : pas d'effet.
    if (!mq('(hover: hover) and (pointer: fine)')) return;
    try { if (!initGL()) return; } catch (err) { CFG.error = String(err); return; }
    loadTexture(function () {
      document.querySelectorAll(SELECTOR).forEach(function (b) { b.classList.add('rb'); });
      document.addEventListener('pointerover', enter);
      document.addEventListener('pointerout', leave);
      document.addEventListener('focusin', enter);
      document.addEventListener('focusout', leave);
    });
  }

  if ('requestIdleCallback' in window) requestIdleCallback(init, { timeout: 1500 });
  else setTimeout(init, 300);
})();

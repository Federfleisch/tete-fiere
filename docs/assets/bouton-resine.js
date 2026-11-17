/*
 * Bouton résine : au survol, le bouton se remplit d'une pâte de résine épaisse, de bas en
 * haut. Quand la souris le quitte, sa couleur de fond remonte à son tour depuis le bas et
 * recouvre la résine.
 *
 * Couleurs : la photo du héro (hero.jpg), lue très floue (on garde les grandes zones rose et
 * bleu, sans les veines ni les bulles de la photo). Matière : relief de gros plis arrondis qui
 * remontent lentement, éclairé du haut à gauche, creux plus sombres, grain poudreux.
 *
 * Utilisation : <script src="../assets/bouton-resine.js" data-src="../assets/v2/hero.jpg" defer>
 * Boutons concernés : .btn-navy (Primary) et .btn-ghost (Secondary).
 * - Primary : résine franche ; le texte passe du blanc au bleu nuit dans la résine ;
 *   à la sortie, le bleu nuit remonte depuis le bas.
 * - Secondary : résine plus pâle (mêlée de blanc), contour rose, texte bleu nuit inchangé ;
 *   à la sortie, le fond clair remonte depuis le bas.
 *
 * Un seul canvas WebGL 2 pour toute la page, posé dans le bouton survolé.
 * Rien ne change sans souris (tactile), sans WebGL 2 ou avec « réduire les animations » :
 * le survol CSS d'origine reste en place.
 * Réglages à chaud : window.boutonResine.
 */
(function () {
  'use strict';

  var CFG = window.boutonResine = {
    fill: 2.8,          // durée du remplissage, en secondes (plein à l'œil vers 1,9 s, puis se pose)
    drain: 0.6,         // durée de la remontée du fond à la sortie, en secondes
    grain: 0.07,        // force du grain poudreux
    wave: 1,            // amplitude de la vague du bord (0 = bord plat)
    relief: 1,          // épaisseur de la pâte (force des plis et des ombres)
    blur: 3.5,          // flou de la photo (plus grand = zones de couleur plus larges, 0 = photo nette)
    lighten: 0.14,      // Primary : part de blanc mêlée à la résine (lisibilité du texte bleu nuit)
    lightenGhost: 0.45, // Secondary : résine plus pâle
    zoom: 0.3           // hauteur de la fenêtre lue dans la photo (plus petit = plus zoomé)
  };

  var mq = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  if (mq('(prefers-reduced-motion: reduce)')) return;

  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || 'assets/v2/hero.jpg';
  var SELECTOR = '.btn-navy, .btn-ghost';

  /* Bords : même fonctions en JS (découpe du texte) et en GLSL (rendu).
     x de 0 à 1 sur la largeur, résultat en fraction de la hauteur depuis le bas.
     surface : bord de la résine, une vague longue et douce plus une bosse qui s'efface en montant.
     cover : bord du fond qui remonte à la sortie. */
  function surface(x, s) {
    var X = x * s.aspect;
    var w = s.amp * (0.75 * Math.sin(X * 1.5 + s.t * 1.5) + 0.25 * Math.sin(X * 2.9 - s.t * 1.9 + 1.3));
    var d = (x - s.bumpC) * s.aspect / 1.6;
    return s.level + w + s.bumpA * Math.exp(-d * d);
  }
  function cover(x, s) {
    var X = x * s.aspect;
    return s.cov + s.amp * 0.6 * Math.sin(X * 1.7 - s.t * 1.4 + 2.0);
  }

  var VS = '#version 300 es\n' +
    'in vec2 p; out vec2 v;\n' +
    'void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D tex;\n' +
    'uniform vec2 res;\n' +        // taille du canvas en pixels
    'uniform vec4 win;\n' +        // fenêtre lue dans la photo : x0, y0, largeur, hauteur (uv)
    'uniform float t, level, amp, bumpA, bumpC, cov, aspect, grain, lighten, fill, relief, blur;\n' +
    'uniform vec3 mixCol;\n' +
    'uniform vec4 bg;\n' +         // fond hors de la résine (bleu nuit pour le Primary, transparent sinon)
    'in vec2 v; out vec4 o;\n' +
    'float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }\n' +
    'float fbm(vec2 q){ float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++){ s += a * noise(q); q = q * 2.07 + 17.1; a *= 0.45; } return s / 0.8; }\n' +
    'float surf(float x){ float X = x * aspect;\n' +
    '  float w = amp * (0.75 * sin(X * 1.5 + t * 1.5) + 0.25 * sin(X * 2.9 - t * 1.9 + 1.3));\n' +
    '  float d = (x - bumpC) * aspect / 1.6; return level + w + bumpA * exp(-d * d); }\n' +
    'float covr(float x){ return cov + amp * 0.6 * sin(x * aspect * 1.7 - t * 1.4 + 2.0); }\n' +
    // Relief de la pâte : gros plis qui remontent lentement avec le remplissage.
    'float H(vec2 P){ vec2 q = vec2(fbm(P * 0.8 + vec2(0.0, -t * 0.18)), fbm(P * 0.8 + vec2(4.1, 2.7 - t * 0.13)));\n' +
    '  return fbm(P * 1.25 + 2.4 * q + vec2(0.0, -fill * 0.9)); }\n' +
    'void main(){\n' +
    '  float px = 1.0 / res.y;\n' +
    '  float depth = surf(v.x) - v.y;\n' +                       // > 0 sous le bord de la résine
    '  float up = v.y - covr(v.x);\n' +                          // > 0 au-dessus du fond qui remonte
    '  float a = smoothstep(-0.8 * px, 0.8 * px, depth) * smoothstep(-0.8 * px, 0.8 * px, up);\n' +
    '  if (a <= 0.0) { o = bg; return; }\n' +
    '  vec2 P = vec2(v.x * aspect, v.y);\n' +
    '  float h0 = H(P);\n' +
    '  float hx = H(P + vec2(0.03, 0.0));\n' +
    '  float hy = H(P + vec2(0.0, 0.03));\n' +
    // Couleur : photo très floue, entraînée le long des plis.
    '  vec2 uv = vec2(v.x, 1.0 - v.y + fill * 0.3) + (vec2(h0, hx) - 0.5) * vec2(0.5 / aspect, 0.8);\n' +
    '  vec3 c = textureLod(tex, win.xy + win.zw * uv, blur).rgb;\n' +
    // Volume : éclairage du haut à gauche, creux des plis sombres, sommets poudrés.
    '  vec3 n = normalize(vec3((h0 - hx) * 7.0 * relief, (h0 - hy) * 7.0 * relief, 1.0));\n' +
    '  float light = dot(n, normalize(vec3(-0.55, 0.65, 0.75)));\n' +
    // Les ombres foncent en gardant la teinte (couleur au carré), sans griser.
    '  float sh = clamp((0.62 + 0.5 * light) * mix(0.72, 1.08, smoothstep(0.2, 0.75, h0)), 0.0, 1.2);\n' +
    '  sh = mix(1.0, sh, clamp(relief, 0.0, 1.5));\n' +
    '  vec3 deep = c * c * 1.05;\n' +
    '  c = sh < 1.0 ? mix(deep, c, smoothstep(0.55, 1.0, sh)) : c * sh;\n' +
    '  c = mix(c, vec3(1.0), 0.22 * smoothstep(0.62, 0.92, h0) * relief);\n' +
    // Bord : la pâte est bombée, plus sombre juste sous le bord, avec un liseré clair.
    '  float dpx = depth / px;\n' +
    '  c = mix(c * c * 1.05, c, 0.45 + 0.55 * smoothstep(0.0, 14.0, dpx));\n' +
    '  c += 0.14 * (1.0 - smoothstep(0.0, 2.5, dpx));\n' +
    // Ombre portée par le fond qui remonte.
    '  c *= 0.8 + 0.2 * smoothstep(0.0, 8.0, up / px);\n' +
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
    ['tex', 'res', 'win', 't', 'level', 'amp', 'bumpA', 'bumpC', 'cov', 'aspect', 'grain', 'lighten', 'fill', 'relief', 'blur', 'mixCol', 'bg']
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

  /* État du bouton qui porte le canvas.
     p : remplissage de 0 (vide) à 1 (plein) ; c : remontée du fond à la sortie, de 0 à 1. */
  var cur = null, raf = 0, last = 0;

  function ease(p) { return 1 - Math.pow(1 - p, 1.6); }
  function easeInOut(p) { return p * p * (3 - 2 * p); }

  function state(b, now) {
    var p = b.p;
    return {
      aspect: b.w / b.h,
      t: (now - b.t0) / 1000,
      level: -0.4 + 1.75 * ease(p),
      amp: 0.06 * CFG.wave,
      bumpA: 0.3 * (1 - p) * (1 - p),
      bumpC: b.bumpC,
      cov: -0.15 + 1.35 * easeInOut(b.c)
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
      btn: btn, ghost: ghost, label: label, w: w, h: h, p: 0, c: 0, hover: true,
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
    if (cur.hover) {
      cur.p = Math.min(1, cur.p + dt / CFG.fill);
      cur.c = Math.max(0, cur.c - dt / CFG.drain); // retour pendant la sortie : le fond redescend
    } else {
      cur.c = Math.min(1, cur.c + dt / CFG.drain);
      if (cur.c >= 1) { release(); return; }
    }
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
    gl.uniform1f(U.cov, s.cov); gl.uniform1f(U.relief, CFG.relief); gl.uniform1f(U.blur, CFG.blur);
    gl.uniform1f(U.grain, CFG.grain); gl.uniform1f(U.fill, ease(cur.p));
    gl.uniform1f(U.lighten, cur.ghost ? CFG.lightenGhost : CFG.lighten);
    gl.uniform3f(U.mixCol, 0.984, 0.976, 1.0); // papier #FBF9FF
    if (cur.ghost) gl.uniform4f(U.bg, 0, 0, 0, 0);
    else gl.uniform4f(U.bg, 0.067, 0.059, 0.224, 1); // bleu nuit #110F39
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (cur.label) {
      // Texte bleu nuit découpé selon la résine : entre le fond qui remonte et le bord du liquide.
      var pts = [], N = 24, i, x, top;
      for (i = 0; i <= N; i++) {
        x = i / N; top = surface(x, s);
        pts.push((x * 100).toFixed(2) + '% ' + ((1 - Math.min(cover(x, s), top)) * 100).toFixed(2) + '%');
      }
      for (i = N; i >= 0; i--) {
        x = i / N;
        pts.push((x * 100).toFixed(2) + '% ' + ((1 - surface(x, s)) * 100).toFixed(2) + '%');
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

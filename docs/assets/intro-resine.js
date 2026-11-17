/*
 * Arrivée sur la page (essai).
 * 1. Écran bleu nuit ; la vague de résine monte tout de suite, sans attendre la photo : elle part
 *    d'un aperçu minuscule intégré ci-dessous, puis passe en fondu à la photo en pleine définition
 *    (main-background.jpg) dès qu'elle est chargée.
 *    Le bord ondule nettement (houle), avec une courbe plus forte sur mobile.
 * 2. Un peu avant que la vague n'atteigne le haut (CFG.enter), les éléments arrivent par-dessus :
 *    bandeau et bande défilante (avec leur texte), navigation, logo, tampon (classe arrive-go).
 * 3. La pâte se pose : relief, grain, flou et déformation s'effacent ; la dernière image est la photo
 *    du héro, cadrée comme lui (center / cover sur le premier écran). Le héro reprend alors sa photo
 *    et son fond animé (resine.js, parti de la même photo nette), le voile s'efface : aucun saut
 *    (classe arrive-done, puis window.resineGo()).
 *
 * Utilisation : <div class="intro-veil"><canvas></canvas></div> au début du body, la classe
 * « arrive » posée sur <html> dans le head (pas « intro » : la section d'intro porte déjà ce nom),
 * sauf avec « réduire les animations », puis
 * <script src="../assets/intro-resine.js" data-src="../assets/main-background.jpg" defer>.
 * Sans WebGL 2 ou en cas d'erreur : tout s'affiche simplement. Réglages : window.introResine.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('arrive')) return;

  var CFG = window.introResine = {
    fill: 1.6,      // durée de la montée, en secondes
    settle: 0.4,    // part de la fin de la montée pendant laquelle la pâte se pose (0 à 1)
    enter: 0.72,    // moment de la montée où les éléments arrivent
    hiWait: 2.5,    // attente maximale de la photo en pleine définition, une fois la montée finie (s)
    tilt: 0.1,      // inclinaison du bord
    wave: 0.07,     // hauteur de la houle (part de la hauteur d'écran), écran large
    waves: 1.1,     // nombre d'ondulations sur la largeur, écran large
    waveM: 0.085,   // mêmes réglages sur mobile (écran plus haut que large) : courbe plus marquée
    wavesM: 0.75,
    grain: 0.04,
    relief: 1.2,
    blur: 1.6,      // flou de la photo pendant la montée (niveau de mipmap), 0 à la fin
    res: 1          // résolution du calcul par rapport à l'écran
  };
  // Aperçu 192 × 108 de main-background.jpg (environ 3,6 Ko) : la vague a ses couleurs dès la 1re image.
  var PREVIEW = 'data:image/jpeg;base64,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';

  var veil = document.querySelector('.intro-veil');
  var canvas = veil && veil.querySelector('canvas');
  var hero = document.querySelector('.hero'), topbar = document.querySelector('.topbar'), slider = document.querySelector('.slider');
  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || 'assets/main-background.jpg';

  function enter() { root.classList.add('arrive-go'); }
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    root.classList.add('arrive-go', 'arrive-done');   // le héro reprend sa photo, le voile s'efface
    if (window.resineGo) window.resineGo();             // le fond animé du héro prend le relais
    setTimeout(function () {
      root.classList.remove('arrive', 'arrive-go', 'arrive-done');
      if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    }, 2000);
  }
  if (!veil || !canvas || !hero) { finish(); return; }

  var VS = '#version 300 es\n' +
    'in vec2 p; out vec2 v;\n' +
    'void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  /* v : écran, de 0 à 1 (y depuis le bas) ; bord et relief à l'échelle de l'écran (P = (x * aspect, y)).
     h : position dans le premier écran, pour le cadrage de la photo. settle : 0 pendant la montée,
     1 = photo nette. hi : part de la photo en pleine définition (0 = aperçu). */
  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D tex, texHi;\n' +
    'uniform vec2 res;\n' +
    'uniform vec2 band;\n' +       // bas et haut du premier écran, en fraction de la hauteur d'écran (depuis le bas)
    'uniform float t, level, aspect, heroAsp, imgAsp, grain, relief, blur, fill, settle, tilt, hi, wave, waves;\n' +
    'in vec2 v; out vec4 o;\n' +
    'float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }\n' +
    'float fbm(vec2 q){ float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++){ s += a * noise(q); q = q * 2.07 + 17.1; a *= 0.45; } return s / 0.8; }\n' +
    'float surf(float x){ float X = (x - 0.5) * aspect;\n' +
    '  float k = tilt + 0.05 * sin(t * 1.2) + 0.025 * sin(t * 2.3 + 1.0);\n' +
    '  float u = (x - 0.5) * 6.2832 * waves;\n' +      // ondulations comptées sur la largeur : même houle quel que soit l'écran
    '  float w = 0.72 * sin(u + t * 2.2) + 0.28 * sin(u * 2.3 - t * 2.9 + 1.3);\n' +
    '  return level + k * X + wave * w; }\n' +
    'float H(vec2 P){ vec2 q = vec2(fbm(P * 1.5 + vec2(0.0, -t * 0.22)), fbm(P * 1.5 + vec2(4.1, 2.7 - t * 0.17)));\n' +
    '  return fbm(P * 2.2 + 2.4 * q + vec2(0.0, -fill * 1.2)); }\n' +
    'vec2 cover(vec2 h){ vec2 uv = h;\n' +
    '  if (heroAsp > imgAsp) uv.y = 0.5 + (h.y - 0.5) * imgAsp / heroAsp; else uv.x = 0.5 + (h.x - 0.5) * heroAsp / imgAsp;\n' +
    '  return vec2(uv.x, 1.0 - uv.y); }\n' +
    'vec3 photo(vec2 uv, float lod){ vec3 a = texture(tex, uv).rgb;\n' +
    '  return hi > 0.0 ? mix(a, textureLod(texHi, uv, lod).rgb, hi) : a; }\n' +
    'void main(){\n' +
    '  vec4 bg = vec4(0.067, 0.059, 0.224, 1.0);\n' +
    '  vec2 h = vec2(v.x, (v.y - band.x) / (band.y - band.x));\n' +
    '  if (settle >= 1.0) { o = vec4(photo(cover(h), 0.0), 1.0); return; }\n' +
    '  float px = 1.0 / res.y;\n' +
    '  float depth = surf(v.x) - v.y;\n' +
    '  float a = smoothstep(-1.0 * px, 1.0 * px, depth);\n' +
    '  if (a <= 0.0) { o = bg; return; }\n' +
    '  float m = 1.0 - settle;\n' +
    '  vec2 P = vec2(v.x * aspect, v.y);\n' +
    '  float e = 0.006;\n' +
    '  float h0 = H(P), hx = H(P + vec2(e, 0.0)), hy = H(P + vec2(0.0, e));\n' +
    '  vec3 c = photo(cover(h + (vec2(h0, hy) - 0.5) * 0.05 * m), blur * m);\n' +
    '  vec3 n = normalize(vec3((h0 - hx) * 2.4 * relief / (e * 60.0), (h0 - hy) * 2.4 * relief / (e * 60.0), 1.0));\n' +
    '  float light = dot(n, normalize(vec3(-0.55, 0.65, 0.75)));\n' +
    '  float sh = clamp(0.62 + 0.5 * light, 0.0, 1.2);\n' +
    '  sh = mix(1.0, sh, clamp(relief, 0.0, 1.5) * 0.7 * m);\n' +
    '  vec3 deep = c * c * 1.05;\n' +
    '  c = sh < 1.0 ? mix(deep, c, smoothstep(0.55, 1.0, sh)) : c * sh;\n' +
    '  c = mix(c, vec3(1.0), 0.16 * smoothstep(0.62, 0.92, h0) * relief * m);\n' +
    '  float dpx = depth / px;\n' +
    '  c = mix(c * c * 1.05, c, 0.45 + 0.55 * smoothstep(0.0, 26.0, dpx));\n' +
    '  c += 0.14 * (1.0 - smoothstep(0.0, 3.0, dpx));\n' +
    '  c += (hash(gl_FragCoord.xy + floor(t * 12.0) * 7.13) - 0.5) * grain * m;\n' +
    '  o = mix(bg, vec4(clamp(c, 0.0, 1.0), 1.0), a);\n' +
    '}';

  var gl, U = {}, imgAsp = 16 / 9, t0 = 0, hiReady = false, hiAt = 0;

  function initGL() {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
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
    ['tex', 'texHi', 'res', 'band', 't', 'level', 'aspect', 'heroAsp', 'imgAsp', 'grain', 'relief', 'blur', 'fill', 'settle', 'tilt', 'hi', 'wave', 'waves']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.tex, 0);
    gl.uniform1i(U.texHi, 1);
    // Unité 1 occupée par un pixel en attendant la photo (sinon le navigateur avertit d'une unité vide).
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([17, 15, 57]));
    return true;
  }

  function upload(unit, src, mip) {
    var tx = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  }

  function size() {
    var scale = Math.min(window.devicePixelRatio || 1, 2) * CFG.res;
    canvas.width = Math.max(2, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(2, Math.round(window.innerHeight * scale));
  }

  function ease(p) { return 1 - Math.pow(1 - p, 1.6); }
  function smooth(a, b, x) { var q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); }

  function draw(now, p, hiMix) {
    // Cadre de la photo : le premier écran (bandeau + héro + bande défilante), comme la photo du héro.
    var r = hero.getBoundingClientRect(), vh = window.innerHeight;
    var fTop = r.top - (topbar ? topbar.offsetHeight : 0), fBottom = r.bottom + (slider ? slider.offsetHeight : 0);
    var asp = window.innerWidth / vh, heroAsp = window.innerWidth / Math.max(1, fBottom - fTop);
    var tall = asp < 0.9, wave = tall ? CFG.waveM : CFG.wave;
    var reach = (CFG.tilt + 0.075) * asp / 2 + wave + 0.01;   // la vague part entièrement sous l'écran et finit au-dessus
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform2f(U.band, 1 - fBottom / vh, 1 - fTop / vh);
    gl.uniform1f(U.t, (now - t0) / 1000 + 7.0);
    gl.uniform1f(U.level, -reach + (1 + 2 * reach) * ease(p));
    gl.uniform1f(U.fill, ease(p));
    gl.uniform1f(U.settle, p >= 1 ? 1 : smooth(1 - CFG.settle, 1, p));
    gl.uniform1f(U.tilt, CFG.tilt);
    gl.uniform1f(U.wave, wave);
    gl.uniform1f(U.waves, tall ? CFG.wavesM : CFG.waves);
    gl.uniform1f(U.aspect, asp);
    gl.uniform1f(U.heroAsp, heroAsp);
    gl.uniform1f(U.imgAsp, imgAsp);
    gl.uniform1f(U.grain, CFG.grain);
    gl.uniform1f(U.relief, CFG.relief);
    gl.uniform1f(U.blur, CFG.blur);
    gl.uniform1f(U.hi, hiMix);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function run() {
    t0 = performance.now();
    // Chien de garde : appareil trop lent ou photo qui ne vient pas, la page s'affiche quand même.
    setTimeout(finish, (CFG.fill + CFG.hiWait) * 1000 + 600);
    (function frame(now) {
      if (finished) return;
      var p = Math.max(0, Math.min(1, (now - t0) / 1000 / CFG.fill));
      var hiMix = hiReady ? Math.min(1, (now - hiAt) / 350) : 0;   // fondu aperçu → pleine définition
      draw(now, p, hiMix);
      if (p >= CFG.enter) enter();
      // Fin : montée terminée et photo en pleine définition affichée (ou attente trop longue).
      if (p >= 1 && (hiMix >= 1 || now - t0 > (CFG.fill + CFG.hiWait) * 1000)) { finish(); return; }
      requestAnimationFrame(frame);
    })(t0);
  }

  try {
    if (!initGL()) { finish(); return; }
  } catch (err) { CFG.error = String(err); finish(); return; }
  size();
  window.addEventListener('resize', size);

  // Photo en pleine définition, chargée en parallèle (réduite à 2048 px sur les petits écrans).
  var big = new Image();
  big.decoding = 'async';
  big.onload = function () {
    var src = big, target = Math.max(screen.width, screen.height) * Math.min(window.devicePixelRatio || 1, 2);
    if (big.width > 2048 && target <= 2048) {
      var c2 = document.createElement('canvas');
      c2.width = 2048; c2.height = Math.round(2048 * big.height / big.width);
      c2.getContext('2d').drawImage(big, 0, 0, c2.width, c2.height);
      src = c2;
    }
    imgAsp = big.naturalWidth / big.naturalHeight;
    upload(1, src, true);
    hiReady = true; hiAt = performance.now();
  };
  big.src = SRC;

  // Aperçu intégré : la vague démarre dès qu'il est décodé (quelques millisecondes).
  var small = new Image();
  small.onload = function () { upload(0, small, false); run(); };
  small.onerror = finish;
  small.src = PREVIEW;
})();

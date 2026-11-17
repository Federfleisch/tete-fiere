/*
 * Arrivée sur la page (essai) : l'écran, bleu nuit, se remplit de résine du bas vers le haut,
 * comme le bouton Primary au survol. Une fois plein, le voile s'efface sur la page et les
 * éléments du premier écran (bandeau, navigation, tampon, bande défilante) entrent en scène.
 *
 * Utilisation : <div class="intro-veil"><canvas></canvas></div> au début du body, la classe
 * « arrive » posée sur <html> (pas « intro » : la section d'intro porte déjà ce nom) dans le head (sauf « réduire les animations »), puis
 * <script src="../assets/intro-resine.js" data-src="../assets/v2/main-background-1920.jpg" defer>.
 * Classes posées sur <html> : arrive-go (entrée des éléments), arrive-done (voile effacé).
 * Sans WebGL 2 ou si l'image tarde : le voile s'efface simplement. Réglages : window.introResine.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('arrive')) return;

  var CFG = window.introResine = {
    fill: 1.6,      // durée du remplissage, en secondes
    hold: 0.12,     // pause, écran plein, avant de dévoiler la page
    fade: 0.7,      // durée de l'effacement du voile, en secondes
    wait: 1.5,      // attente maximale de l'image avant de renoncer, en secondes
    grain: 0.04,
    relief: 1.2,
    blur: 1.6,      // flou de la photo (niveau de mipmap)
    res: 0.6        // résolution du calcul par rapport à l'écran (la matière est floue)
  };

  var veil = document.querySelector('.intro-veil');
  var canvas = veil && veil.querySelector('canvas');
  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || 'assets/v2/main-background-1920.jpg';

  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    root.classList.add('arrive-go', 'arrive-done');
    setTimeout(function () {
      root.classList.remove('arrive', 'arrive-go', 'arrive-done');
      if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    }, 1800);
  }
  if (!veil || !canvas) { finish(); return; }

  var VS = '#version 300 es\n' +
    'in vec2 p; out vec2 v;\n' +
    'void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  /* v de 0 à 1 (y depuis le bas) ; P = (x * aspect, y), en hauteurs d'écran. */
  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D tex;\n' +
    'uniform vec2 res;\n' +
    'uniform float t, level, aspect, imgAsp, grain, relief, blur, fill;\n' +
    'in vec2 v; out vec4 o;\n' +
    'float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }\n' +
    'float fbm(vec2 q){ float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++){ s += a * noise(q); q = q * 2.07 + 17.1; a *= 0.45; } return s / 0.8; }\n' +
    // Bord de la résine : niveau + balancement + vague longue.
    'float surf(float x){ float X = (x - 0.5) * aspect;\n' +
    '  float k = 0.045 * sin(t * 1.1) + 0.02 * sin(t * 2.3 + 1.0);\n' +
    '  float w = 0.7 * sin(X * 2.4 + t * 1.7) + 0.3 * sin(X * 5.3 - t * 2.1 + 1.3);\n' +
    '  return level + k * X + 0.03 * w; }\n' +
    // Relief de la pâte : gros plis qui remontent avec le remplissage.
    'float H(vec2 P){ vec2 q = vec2(fbm(P * 1.5 + vec2(0.0, -t * 0.22)), fbm(P * 1.5 + vec2(4.1, 2.7 - t * 0.17)));\n' +
    '  return fbm(P * 2.2 + 2.4 * q + vec2(0.0, -fill * 1.2)); }\n' +
    'void main(){\n' +
    '  vec4 bg = vec4(0.067, 0.059, 0.224, 1.0);\n' +
    '  float px = 1.0 / res.y;\n' +
    '  float depth = surf(v.x) - v.y;\n' +
    '  float a = smoothstep(-1.0 * px, 1.0 * px, depth);\n' +
    '  if (a <= 0.0) { o = bg; return; }\n' +
    '  vec2 P = vec2(v.x * aspect, v.y);\n' +
    '  float e = 0.006;\n' +
    '  float h0 = H(P), hx = H(P + vec2(e, 0.0)), hy = H(P + vec2(0.0, e));\n' +
    // Photo en « cover », déformée par le relief (la matière coule).
    '  vec2 uv = v;\n' +
    '  if (aspect > imgAsp) uv.y = 0.5 + (v.y - 0.5) * imgAsp / aspect; else uv.x = 0.5 + (v.x - 0.5) * aspect / imgAsp;\n' +
    '  uv += (vec2(h0, hy) - 0.5) * 0.05;\n' +
    '  uv.y = 1.0 - uv.y;\n' +
    '  vec3 c = textureLod(tex, uv, blur).rgb;\n' +
    '  vec3 n = normalize(vec3((h0 - hx) * 2.4 * relief / (e * 60.0), (h0 - hy) * 2.4 * relief / (e * 60.0), 1.0));\n' +
    '  float light = dot(n, normalize(vec3(-0.55, 0.65, 0.75)));\n' +
    '  float sh = clamp(0.62 + 0.5 * light, 0.0, 1.2);\n' +
    '  sh = mix(1.0, sh, clamp(relief, 0.0, 1.5) * 0.7);\n' +
    '  vec3 deep = c * c * 1.05;\n' +
    '  c = sh < 1.0 ? mix(deep, c, smoothstep(0.55, 1.0, sh)) : c * sh;\n' +
    '  c = mix(c, vec3(1.0), 0.16 * smoothstep(0.62, 0.92, h0) * relief);\n' +
    // Bord bombé : plus sombre juste sous le bord, liseré clair.
    '  float dpx = depth / px;\n' +
    '  c = mix(c * c * 1.05, c, 0.45 + 0.55 * smoothstep(0.0, 26.0, dpx));\n' +
    '  c += 0.14 * (1.0 - smoothstep(0.0, 3.0, dpx));\n' +
    '  c += (hash(gl_FragCoord.xy + floor(t * 12.0) * 7.13) - 0.5) * grain;\n' +
    '  o = mix(bg, vec4(clamp(c, 0.0, 1.0), 1.0), a);\n' +
    '}';

  var gl, U = {}, imgAsp = 16 / 9, t0 = 0, scale = 1;

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
    ['tex', 'res', 't', 'level', 'aspect', 'imgAsp', 'grain', 'relief', 'blur', 'fill']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  function size() {
    // Résolution réduite : la matière est floue, inutile de calculer chaque pixel.
    scale = Math.min(window.devicePixelRatio || 1, 1.5) * CFG.res;
    canvas.width = Math.max(2, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(2, Math.round(window.innerHeight * scale));
  }

  function ease(p) { return 1 - Math.pow(1 - p, 1.6); }

  function draw(now, p) {
    var asp = canvas.width / canvas.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.t, (now - t0) / 1000 + 7.0);
    // Le niveau part sous l'écran (bord ondulé compris) et finit au-dessus.
    gl.uniform1f(U.level, -0.1 + 1.25 * ease(p));
    gl.uniform1f(U.fill, ease(p));
    gl.uniform1f(U.aspect, asp);
    gl.uniform1f(U.imgAsp, imgAsp);
    gl.uniform1f(U.grain, CFG.grain);
    gl.uniform1f(U.relief, CFG.relief);
    gl.uniform1f(U.blur, CFG.blur);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function run() {
    t0 = performance.now();
    // Chien de garde : sur un appareil trop lent pour suivre, la page s'affiche quand même.
    setTimeout(finish, (CFG.fill + CFG.hold) * 1000 + 900);
    (function frame(now) {
      var p = Math.min(1, (now - t0) / 1000 / CFG.fill);
      draw(now, p);
      if (p < 1) { requestAnimationFrame(frame); return; }
      setTimeout(finish, CFG.hold * 1000);
    })(t0);
  }

  var gaveUp = false;
  var timer = setTimeout(function () { gaveUp = true; finish(); }, CFG.wait * 1000);

  try {
    if (!initGL()) { clearTimeout(timer); finish(); return; }
  } catch (err) { CFG.error = String(err); clearTimeout(timer); finish(); return; }
  size();
  window.addEventListener('resize', size);

  var img = new Image();
  img.decoding = 'async';
  img.onload = function () {
    if (gaveUp) return;
    clearTimeout(timer);
    imgAsp = img.naturalWidth / img.naturalHeight;
    var tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.uniform1i(U.tex, 0);
    run();
  };
  img.onerror = function () { if (!gaveUp) { clearTimeout(timer); finish(); } };
  img.src = SRC;
})();

/*
 * Arrivée sur la page (essai) : l'écran est bleu nuit, puis il se remplit entièrement de résine
 * du bas vers le haut, comme le bouton Primary au survol. La photo est cadrée en center / cover
 * sur le premier écran (bandeau + héro + bande défilante), exactement comme la photo et le fond
 * animé du héro, qui débordent sous les deux bandes. En fin de remplissage, la pâte se pose :
 * relief, grain, flou et déformation s'effacent ; la dernière image est la photo du héro.
 * Le bandeau et la bande défilante apparaissent alors en fondu, depuis le bas, par-dessus
 * l'image ; puis le voile s'efface (rien ne change à l'écran) et la navigation et le tampon entrent.
 *
 * Utilisation : <div class="intro-veil"><canvas></canvas></div> au début du body, la classe
 * « arrive » posée sur <html> dans le head (pas « intro » : la section d'intro porte déjà ce nom),
 * sauf avec « réduire les animations », puis
 * <script src="../assets/intro-resine.js" data-src="../assets/main-background.jpg" defer>.
 * Classes posées sur <html> : arrive-go (entrée des bandes), arrive-done (voile effacé, entrée du reste).
 * Sans WebGL 2, si l'image tarde ou si l'appareil est trop lent : le voile s'efface simplement.
 * Réglages (à poser avant le chargement) : window.introResine.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('arrive')) return;

  var CFG = window.introResine = {
    fill: 1.6,      // durée du remplissage, en secondes
    settle: 0.4,    // part de la fin du remplissage pendant laquelle la pâte se pose (0 à 1)
    hold: 0.15,     // pause sur l'image finale avant de dévoiler la page
    wait: 1.5,      // attente maximale de l'image avant de renoncer, en secondes
    tilt: 0.14,     // inclinaison du bord (en hauteurs de héro par largeur de héro)
    grain: 0.04,
    relief: 1.2,
    blur: 1.6,      // flou de la photo pendant la montée (niveau de mipmap), 0 à la fin
    res: 1          // résolution du calcul par rapport à l'écran
  };

  var veil = document.querySelector('.intro-veil');
  var canvas = veil && veil.querySelector('canvas');
  var hero = document.querySelector('.hero'), topbar = document.querySelector('.topbar'), slider = document.querySelector('.slider');
  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || 'assets/v2/hero.jpg';

  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    root.classList.add('arrive-go');                                           // bandes en fondu, par-dessus le voile
    setTimeout(function () { root.classList.add('arrive-done'); }, 650);       // puis le voile s'efface
    setTimeout(function () {
      root.classList.remove('arrive', 'arrive-go', 'arrive-done');
      if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    }, 2600);
  }
  if (!veil || !canvas || !hero) { finish(); return; }

  var VS = '#version 300 es\n' +
    'in vec2 p; out vec2 v;\n' +
    'void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  /* v : écran, de 0 à 1 (y depuis le bas) ; le bord de la résine et le relief vivent à l'échelle de l'écran
     (P = (x * aspect de l'écran, y)). h : position dans le cadre du héro (0 à 1 dans le héro, au-delà
     au-dessus et en dessous) ; sert au cadrage de la photo. settle : 0 pendant la montée, 1 = photo nette. */
  var FS = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform sampler2D tex;\n' +
    'uniform vec2 res;\n' +
    'uniform vec2 band;\n' +       // bas et haut du premier écran, en fraction de la hauteur d'écran (depuis le bas)
    'uniform float t, level, aspect, heroAsp, imgAsp, grain, relief, blur, fill, settle, tilt;\n' +
    'in vec2 v; out vec4 o;\n' +
    'float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }\n' +
    'float noise(vec2 q){ vec2 i = floor(q), f = fract(q); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }\n' +
    'float fbm(vec2 q){ float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++){ s += a * noise(q); q = q * 2.07 + 17.1; a *= 0.45; } return s / 0.8; }\n' +
    // Bord : niveau + inclinaison franche qui balance un peu + vague longue.
    'float surf(float x){ float X = (x - 0.5) * aspect;\n' +
    '  float k = tilt + 0.05 * sin(t * 1.2) + 0.025 * sin(t * 2.3 + 1.0);\n' +
    '  float w = 0.7 * sin(X * 2.4 + t * 1.7) + 0.3 * sin(X * 5.3 - t * 2.1 + 1.3);\n' +
    '  return level + k * X + 0.03 * w; }\n' +
    'float H(vec2 P){ vec2 q = vec2(fbm(P * 1.5 + vec2(0.0, -t * 0.22)), fbm(P * 1.5 + vec2(4.1, 2.7 - t * 0.17)));\n' +
    '  return fbm(P * 2.2 + 2.4 * q + vec2(0.0, -fill * 1.2)); }\n' +
    // Photo cadrée comme le CSS du héro : center / cover dans le cadre du héro.
    'vec2 cover(vec2 h){ vec2 uv = h;\n' +
    '  if (heroAsp > imgAsp) uv.y = 0.5 + (h.y - 0.5) * imgAsp / heroAsp; else uv.x = 0.5 + (h.x - 0.5) * heroAsp / imgAsp;\n' +
    '  return vec2(uv.x, 1.0 - uv.y); }\n' +
    'void main(){\n' +
    '  vec4 bg = vec4(0.067, 0.059, 0.224, 1.0);\n' +
    '  vec2 h = vec2(v.x, (v.y - band.x) / (band.y - band.x));\n' +
    '  if (settle >= 1.0) { o = vec4(texture(tex, cover(h)).rgb, 1.0); return; }\n' +
    '  float px = 1.0 / res.y;\n' +
    '  float depth = surf(v.x) - v.y;\n' +
    '  float a = smoothstep(-1.0 * px, 1.0 * px, depth);\n' +
    '  if (a <= 0.0) { o = bg; return; }\n' +
    '  float m = 1.0 - settle;\n' +                          // force de la matière, qui s'efface en fin de course
    '  vec2 P = vec2(v.x * aspect, v.y);\n' +
    '  float e = 0.006;\n' +
    '  float h0 = H(P), hx = H(P + vec2(e, 0.0)), hy = H(P + vec2(0.0, e));\n' +
    '  vec2 uv = cover(h + (vec2(h0, hy) - 0.5) * 0.05 * m);\n' +
    '  vec3 c = textureLod(tex, uv, blur * m).rgb;\n' +
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

  var gl, U = {}, imgAsp = 3 / 2, t0 = 0;

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
    ['tex', 'res', 'band', 't', 'level', 'aspect', 'heroAsp', 'imgAsp', 'grain', 'relief', 'blur', 'fill', 'settle', 'tilt']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  function size() {
    var scale = Math.min(window.devicePixelRatio || 1, 2) * CFG.res;
    canvas.width = Math.max(2, Math.round(window.innerWidth * scale));
    canvas.height = Math.max(2, Math.round(window.innerHeight * scale));
  }

  function ease(p) { return 1 - Math.pow(1 - p, 1.6); }
  function smooth(a, b, x) { var q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); }

  function draw(now, p) {
    // Cadre de la photo : le premier écran (bandeau + héro + bande défilante), comme la photo du héro.
    // Relu à chaque image : les hauteurs bougent pendant le chargement (polices, bandeau mesuré).
    var r = hero.getBoundingClientRect(), vh = window.innerHeight;
    var fTop = r.top - (topbar ? topbar.offsetHeight : 0), fBottom = r.bottom + (slider ? slider.offsetHeight : 0);
    var bottom = 1 - fBottom / vh, top = 1 - fTop / vh;
    var asp = window.innerWidth / vh, heroAsp = window.innerWidth / Math.max(1, fBottom - fTop);
    // Marge du bord : inclinaison et vague, pour partir sous le héro et finir au-dessus.
    var reach = (CFG.tilt + 0.075) * asp / 2 + 0.03 + 0.01;
    var settle = smooth(1 - CFG.settle, 1, p);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform2f(U.band, bottom, top);
    gl.uniform1f(U.t, (now - t0) / 1000 + 7.0);
    gl.uniform1f(U.level, -reach + (1 + 2 * reach) * ease(p));
    gl.uniform1f(U.fill, ease(p));
    gl.uniform1f(U.settle, p >= 1 ? 1 : settle);
    gl.uniform1f(U.tilt, CFG.tilt);
    gl.uniform1f(U.aspect, asp);
    gl.uniform1f(U.heroAsp, heroAsp);
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
      var p = Math.max(0, Math.min(1, (now - t0) / 1000 / CFG.fill));
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);   // au-delà de la photo : miroir, sans couture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.uniform1i(U.tex, 0);
    run();
  };
  img.onerror = function () { if (!gaveUp) { clearTimeout(timer); finish(); } };
  img.src = SRC;
})();

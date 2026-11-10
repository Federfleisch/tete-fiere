/*
 * Résine : fond photo déformable au pointeur, en WebGL 2.
 *
 * Principe : une texture de déplacement de coordonnées est transportée sous le pinceau.
 * Le rendu lit la photo aux coordonnées déplacées. Seules les coordonnées sont interpolées,
 * jamais les couleurs : la matière s'étire comme sous un pinceau, sans mélange de teintes.
 *
 * Utilisation : <canvas class="resine" data-src="assets/main-background.jpg"></canvas>
 * La photo est cadrée comme un fond CSS « center / cover ». Sans WebGL 2, le canvas reste
 * caché et le fond CSS de la page s'affiche.
 */
(function () {
  'use strict';

  var SETTINGS = {
    brushRadius: 0.14,   // rayon du pinceau, en fraction de la hauteur
    brushStrength: 0.45, // part du mouvement du curseur transmise à la matière (1 = la suit entièrement)
    relax: 0.996,        // retour à l'état initial, par image à 60 i/s (traces résorbées en ~4 s)
    flow: 0.00012,       // intensité du courant ambiant (0 = immobile au repos)
    flowSpeed: 0.05,     // vitesse d'évolution du courant
    flowScale: 1.6,      // taille des tourbillons (plus grand = plus petits tourbillons)
    warmup: 360,         // pas de simulation joués avant la 1re image : la résine démarre déjà en mouvement
    simScale: 0.5,       // résolution de la simulation par rapport à l'écran
    maxDpr: 2,
    idleStop: 20000      // sans courant ambiant : arrêt de la boucle après 20 s sans mouvement
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { SETTINGS.flow = 0; SETTINGS.warmup = 0; }

  var canvas = document.querySelector('canvas.resine');
  if (!canvas) return;
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return;

  var VERT = '#version 300 es\n' +
    'in vec2 aPos; out vec2 vUv;\n' +
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  // D(x) = M(x) - x. Déplacement s : M'(x) = M(x - s) donc D'(x) = D(x - s) - s.
  // s = coup de pinceau + courant ambiant (rotationnel d'un bruit : il tourbillonne sans se tasser).
  var SIM = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uDisp; uniform vec2 uMouse; uniform vec2 uVel;\n' +
    'uniform float uRadius; uniform float uAspect; uniform float uRelax; uniform float uStrength;\n' +
    'uniform float uTime; uniform float uFlow; uniform float uFlowScale;\n' +
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n' +
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);\n' +
    '  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y); }\n' +
    'float field(vec2 p){ float t = uTime;\n' +
    '  return noise(p + vec2(t, -0.7 * t)) + 0.5 * noise(p * 2.1 + vec2(-0.6 * t, t) + 7.3) + 0.25 * noise(p * 4.3 + vec2(0.4 * t, 0.9 * t) + 3.1); }\n' +
    'vec2 curl(vec2 p){ float e = 0.02;\n' +
    '  float a = field(p + vec2(0.0, e)), b = field(p - vec2(0.0, e));\n' +
    '  float c = field(p + vec2(e, 0.0)), d = field(p - vec2(e, 0.0));\n' +
    '  return vec2(a - b, -(c - d)) / (2.0 * e); }\n' +
    'void main(){\n' +
    '  vec2 d = vUv - uMouse; d.x *= uAspect;\n' +
    '  float f = exp(-dot(d, d) / (uRadius * uRadius));\n' +
    '  vec2 s = uVel * f * uStrength;\n' +
    '  if (uFlow > 0.0) { vec2 c = curl(vec2(vUv.x * uAspect, vUv.y) * uFlowScale); s += vec2(c.x / uAspect, c.y) * uFlow; }\n' +
    '  vec2 D = texture(uDisp, vUv - s).xy - s;\n' +
    '  o = vec4(D * uRelax, 0.0, 1.0);\n' +
    '}';

  var RENDER = '#version 300 es\n' +
    'precision highp float;\n' +
    'in vec2 vUv; out vec4 o;\n' +
    'uniform sampler2D uDisp; uniform sampler2D uPhoto;\n' +
    'uniform float uAspect; uniform float uPhotoAspect;\n' +
    'void main(){\n' +
    '  vec2 uv = vUv + texture(uDisp, vUv).xy - 0.5;\n' +
    '  if (uAspect > uPhotoAspect) uv.y *= uPhotoAspect / uAspect; else uv.x *= uAspect / uPhotoAspect;\n' +
    '  uv += 0.5;\n' +
    '  o = vec4(texture(uPhoto, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);\n' +
    '}';

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p: p, u: u };
  }

  var simProg, renderProg;
  try { simProg = program(SIM); renderProg = program(RENDER); }
  catch (e) { if (window.console) console.warn('Résine désactivée :', e.message); return; }

  var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeTarget(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t: t, fb: fb };
  }

  var W = 0, H = 0, simW = 0, simH = 0, A, B;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, SETTINGS.maxDpr);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === W && h === H) return false;
    W = canvas.width = w; H = canvas.height = h;
    var sw = Math.max(2, Math.round(w * SETTINGS.simScale)), sh = Math.max(2, Math.round(h * SETTINGS.simScale));
    if (sw !== simW || sh !== simH) { A = makeTarget(sw, sh); B = makeTarget(sw, sh); simW = sw; simH = sh; }
    return true;
  }

  /* Photo : réduite à 2048 px de large sur les petits écrans pour ménager la mémoire. */
  var photoTex = gl.createTexture(), photoAspect = 16 / 9;
  var img = new Image();
  img.decoding = 'async';
  img.onload = function () {
    var src = img;
    var target = Math.max(screen.width, screen.height) * Math.min(window.devicePixelRatio || 1, 2);
    if (img.width > 2048 && target <= 2048) {
      var c2 = document.createElement('canvas');
      c2.width = 2048; c2.height = Math.round(2048 * img.height / img.width);
      c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height);
      src = c2;
    }
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    photoAspect = img.width / img.height;
    resize();
    for (var i = 0; i < SETTINGS.warmup; i++) { flowTime += SETTINGS.flowSpeed / 60; simStep(-10, -10, 0, 0); }
    render();
    canvas.classList.add('is-ready');   // fondu d'apparition par-dessus le fond CSS identique
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; last = toUv(e); wake(); }, { passive: true });
    window.addEventListener('resize', function () { if (resize()) wake(); });
    if (SETTINGS.flow > 0) wake();
  };
  img.src = canvas.getAttribute('data-src');

  /* Pointeur (écouté sur la fenêtre : le contenu de la page reste cliquable par-dessus).
     Souris uniquement : au doigt et au stylet, la page défile normalement et la résine
     ondule seule grâce au courant ambiant. */
  var last = null, pending = [], lastInput = 0, running = false;
  function toUv(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }
  function onMove(e) {
    if (e.pointerType !== 'mouse') return;
    var events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (!events || !events.length) events = [e];
    for (var i = 0; i < events.length; i++) {
      var p = toUv(events[i]);
      if (last) pending.push([last[0], last[1], p[0], p[1]]);
      last = p;
    }
    wake();
  }
  document.addEventListener('pointerleave', function () { last = null; });
  window.addEventListener('blur', function () { last = null; });

  var flowTime = 0, relaxNow = SETTINGS.relax, flowNow = SETTINGS.flow;
  function simStep(mx, my, vx, vy) {
    gl.useProgram(simProg.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.uniform1i(simProg.u.uDisp, 0);
    gl.uniform2f(simProg.u.uMouse, mx, my);
    gl.uniform2f(simProg.u.uVel, vx, vy);
    gl.uniform1f(simProg.u.uRadius, SETTINGS.brushRadius);
    gl.uniform1f(simProg.u.uAspect, W / H);
    gl.uniform1f(simProg.u.uRelax, relaxNow);
    gl.uniform1f(simProg.u.uStrength, SETTINGS.brushStrength);
    gl.uniform1f(simProg.u.uTime, flowTime);
    gl.uniform1f(simProg.u.uFlow, flowNow);
    gl.uniform1f(simProg.u.uFlowScale, SETTINGS.flowScale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    var t = A; A = B; B = t;
  }

  function render() {
    gl.useProgram(renderProg.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t);
    gl.uniform1i(renderProg.u.uDisp, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.uniform1i(renderProg.u.uPhoto, 1);
    gl.uniform1f(renderProg.u.uAspect, W / H);
    gl.uniform1f(renderProg.u.uPhotoAspect, photoAspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function wake() {
    lastInput = performance.now();
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  var lastFrame = 0;
  function frame(now) {
    resize();
    // Pas de temps normalisé à 60 i/s : même vitesse sur un écran 120 Hz.
    var dt = lastFrame ? Math.min(3, (now - lastFrame) / (1000 / 60)) : 1;
    lastFrame = now;
    flowTime += SETTINGS.flowSpeed / 60 * dt;
    var segs = pending; pending = [];
    var stepped = false;
    // Le courant et le relâchement s'appliquent une fois par image, pas à chaque sous-pas du pinceau.
    var nSub = 0;
    for (var j = 0; j < segs.length; j++) {
      var g = segs[j];
      nSub += Math.min(24, Math.max(1, Math.ceil(Math.hypot((g[2] - g[0]) * (W / H), g[3] - g[1]) / (SETTINGS.brushRadius / 3))));
    }
    nSub = Math.max(1, nSub);
    relaxNow = Math.pow(SETTINGS.relax, dt / nSub);
    flowNow = SETTINGS.flow * dt / nSub;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], dx = s[2] - s[0], dy = s[3] - s[1];
      var len = Math.hypot(dx * (W / H), dy);
      var n = Math.min(24, Math.max(1, Math.ceil(len / (SETTINGS.brushRadius / 3))));
      for (var k = 1; k <= n; k++) { simStep(s[0] + dx * k / n, s[1] + dy * k / n, dx / n, dy / n); stepped = true; }
    }
    if (!stepped) simStep(-10, -10, 0, 0);
    render();
    if (SETTINGS.flow > 0 || now - lastInput < SETTINGS.idleStop) requestAnimationFrame(frame);
    else { running = false; lastFrame = 0; }
  }

  window.resine = SETTINGS;
})();

/* Relieve QR — motor 3D (geometría, vista previa, exportación 3MF/STL)
   Script clásico (IIFE). three.js se carga bajo demanda con import() dinámico
   gracias al import map del <head>. Expone window.QR3D. */
(function () {
  "use strict";

  var T = null, OrbitControls = null, STLExporter = null, loading = null;

  function ensure() {
    if (T) return Promise.resolve(T);
    if (!loading) {
      loading = Promise.all([
        import("three"),
        import("three/addons/controls/OrbitControls.js"),
        import("three/addons/exporters/STLExporter.js")
      ]).then(function (mods) {
        T = mods[0]; OrbitControls = mods[1].OrbitControls; STLExporter = mods[2].STLExporter;
        return T;
      });
      loading.catch(function () { loading = null; });
    }
    return loading;
  }

  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- 1. Rectángulos máximos a partir de una rejilla on/off ---------- */
  function gridRects(on, cols, rows) {
    var used = new Uint8Array(cols * rows), out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        if (used[i] || !on[i]) continue;
        var w = 1;
        while (c + w < cols && !used[i + w] && on[i + w]) w++;
        var h = 1;
        grow: while (r + h < rows) {
          var base = (r + h) * cols + c;
          for (var k = 0; k < w; k++) if (used[base + k] || !on[base + k]) break grow;
          h++;
        }
        for (var rr = r; rr < r + h; rr++) for (var cc = c; cc < c + w; cc++) used[rr * cols + cc] = 1;
        out.push({ c: c, r: r, w: w, h: h });
      }
    }
    return out;
  }

  /* ---------- 2. Sopa de cajas (geometría escrita a mano) ---------- */
  function Soup() { this.p = []; this.n = []; this.i = []; }
  Soup.prototype.quad = function (a, b, c, d, nx, ny, nz) {
    var o = this.p.length / 3;
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (var k = 0; k < 4; k++) this.n.push(nx, ny, nz);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  Soup.prototype.box = function (x0, y0, z0, x1, y1, z1) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], 0, 0, -1);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], 1, 0, 0);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 0, 1, 0);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0);
  };
  Soup.prototype.geometry = function () {
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setIndex(new T.Uint32BufferAttribute(new Uint32Array(this.i), 1));
    return g;
  };

  /* ---------- 3. Texto (+ emoji) rasterizado a máscara ---------- */
  var TEXT_FONT = '"Bricolage Grotesque", "Arial Black", "Helvetica Neue", Arial, sans-serif';
  var EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  // emoji y texto se dibujan por separado: así el espacio entre ambos no depende de la fuente de emojis
  function labelMask(label, maxWmm, targetHmm) {
    var k = 10; // px por mm
    var fontPx = Math.round(targetHmm * k * 1.3);
    var em = label.emoji || "", str = (label.text || "").trim();
    var cv = document.createElement("canvas");
    var ctx = cv.getContext("2d", { willReadFrequently: true });
    var tf = "800 " + fontPx + "px " + TEXT_FONT, ef = Math.round(fontPx * 0.92) + "px " + EMOJI_FONT;
    ctx.font = ef; var ew = em ? ctx.measureText(em).width : 0;
    ctx.font = tf; var tw = str ? ctx.measureText(str).width : 0;
    var gap = em && str ? fontPx * 0.28 : 0;
    cv.width = Math.max(8, Math.ceil(ew + gap + tw + fontPx)); cv.height = Math.ceil(fontPx * 1.8);
    ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = "#000";
    var x0 = fontPx * 0.5, y0 = cv.height / 2;
    if (em) { ctx.font = ef; ctx.fillText(em, x0, y0 + fontPx * 0.04); }
    if (str) { ctx.font = tf; ctx.fillText(str, x0 + ew + gap, y0); }
    var d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var minX = cv.width, minY = cv.height, maxX = -1, maxY = -1, x, y;
    for (y = 0; y < cv.height; y++) for (x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 110) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    var cols = maxX - minX + 1, rows = maxY - minY + 1;
    var on = new Uint8Array(cols * rows);
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      on[y * cols + x] = d[((y + minY) * cv.width + (x + minX)) * 4 + 3] > 110 ? 1 : 0;
    }
    // escala: altura real ≈ targetHmm, reducida si no cabe a lo ancho
    var cs = targetHmm / rows;
    if (cols * cs > maxWmm) cs = maxWmm / cols;
    if (rows * cs > targetHmm * 1.15) cs = targetHmm * 1.15 / rows;
    return { on: on, cols: cols, rows: rows, cs: cs, heightMM: rows * cs, widthMM: cols * cs };
  }

  /* ---------- 4. Distribución de cada formato (mm) ---------- */
  var THETA = 62 * Math.PI / 180; // inclinación del soporte respecto a la mesa
  var LIP = 3;                     // canto frontal del soporte
  function layout(o) {
    var mod = o.S / o.n;
    var m = Math.max(4, 2 * mod);           // zona de silencio: 2 módulos (mín. 4 mm)
    var W = o.S + 2 * m;
    var labelH = 0, labelV = 0;
    if (o.hasLabel) {
      labelH = o.format === "llavero" ? clamp(o.S * 0.15, 4.5, 8) : clamp(o.S * 0.12, 6, 12);
      labelV = Math.max(3, m * 0.7);
    }
    var qrV = o.hasLabel ? labelV + labelH + Math.max(3, m * 0.6) : m;
    var faceTop = qrV + o.S + m;
    var L = {
      format: o.format, W: W, m: m, faceTop: faceTop, H: faceTop, holes: [], radius: 4,
      qr: { u: m, v: qrV, size: o.S },
      label: o.hasLabel ? { v: labelV, h: labelH, maxW: W - 2 * Math.max(3, m * 0.7) } : null
    };
    if (o.format === "llavero") {
      var tab = 10;
      L.H = faceTop + tab; L.radius = 5;
      L.holes = [{ x: W / 2, y: faceTop + 4.6, r: 2.75 }];
    } else if (o.format === "placa") {
      var band = 9;
      L.H = faceTop + band; L.radius = 4;
      L.holes = [{ x: 7.5, y: faceTop + 4.5, r: 2.2 }, { x: W - 7.5, y: faceTop + 4.5, r: 2.2 }];
    }
    return L;
  }

  function roundedRectShape(w, h, r) {
    var s = new T.Shape();
    s.moveTo(r, 0); s.lineTo(w - r, 0); s.absarc(w - r, r, r, -Math.PI / 2, 0, false);
    s.lineTo(w, h - r); s.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
    s.lineTo(r, h); s.absarc(r, h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(0, r); s.absarc(r, r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  /* ---------- 5. Construcción completa ---------- */
  // p = { mask:{on,cols}, n, format, S, text, relief, thick }
  function build(p) {
    var text = (p.text || "").trim(), emo = p.emoji || "";
    var hasLabel = text.length > 0 || emo.length > 0;
    var L = layout({ S: p.S, n: p.n, format: p.format, hasLabel: hasLabel });
    var thick = p.format === "soporte" ? 0 : p.thick;

    // base + matriz de la cara
    var base, face = new T.Matrix4();
    if (p.format === "soporte") {
      var len = L.faceTop;
      var D = len * Math.cos(THETA), Ht = LIP + len * Math.sin(THETA);
      var prof = new T.Shape();
      prof.moveTo(0, 0); prof.lineTo(D, 0); prof.lineTo(D, Ht); prof.lineTo(0, LIP); prof.lineTo(0, 0);
      base = new T.ExtrudeGeometry(prof, { depth: L.W, bevelEnabled: false });
      var perm = new T.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
      base.applyMatrix4(perm);
      var dv = new T.Vector3(0, Math.cos(THETA), Math.sin(THETA));
      var nv = new T.Vector3(0, -Math.sin(THETA), Math.cos(THETA));
      face.makeBasis(new T.Vector3(1, 0, 0), dv, nv).setPosition(0, 0, LIP);
      L.depth = D; L.height = Ht;
    } else {
      var shape = roundedRectShape(L.W, L.H, L.radius);
      L.holes.forEach(function (hl) {
        var path = new T.Path(); path.absarc(hl.x, hl.y, hl.r, 0, Math.PI * 2, true); shape.holes.push(path);
      });
      base = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 28 });
      face.makeTranslation(0, 0, thick);
    }
    base.computeVertexNormals();

    // relieve: QR con estilo + texto
    var soup = new Soup(), e = 0.01, sink = 0.15, h = p.relief;
    var qrRects = gridRects(p.mask.on, p.mask.cols, p.mask.cols);
    var cs = L.qr.size / p.mask.cols, top = L.qr.v + L.qr.size;
    qrRects.forEach(function (rc) {
      soup.box(L.qr.u + rc.c * cs - e, top - (rc.r + rc.h) * cs - e, -sink,
               L.qr.u + (rc.c + rc.w) * cs + e, top - rc.r * cs + e, h);
    });
    var lab = null, labRects = [];
    if (hasLabel) {
      lab = labelMask({ text: text, emoji: emo }, L.label.maxW, L.label.h);
      if (lab) {
        labRects = gridRects(lab.on, lab.cols, lab.rows);
        var u0 = L.W / 2 - lab.widthMM / 2;
        var vTop = L.label.v + L.label.h / 2 + lab.heightMM / 2;
        labRects.forEach(function (rc) {
          soup.box(u0 + rc.c * lab.cs - e, vTop - (rc.r + rc.h) * lab.cs - e, -sink,
                   u0 + (rc.c + rc.w) * lab.cs + e, vTop - rc.r * lab.cs + e, h);
        });
      }
    }
    var relief = soup.geometry();
    relief.applyMatrix4(face);

    // medidas del objeto
    var bb = new T.Box3().setFromBufferAttribute(base.attributes.position);
    bb.union(new T.Box3().setFromBufferAttribute(relief.attributes.position));
    var size = bb.getSize(new T.Vector3());

    return {
      base: base, relief: relief, layout: L, format: p.format,
      dims: { x: size.x, y: size.y, z: size.z },
      moduleMM: p.S / p.n, rects: qrRects.length + labRects.length,
      labelHeightMM: lab ? lab.heightMM : 0, labelMissing: hasLabel && !lab
    };
  }

  /* ---------- 6. Vista previa ---------- */
  var V = null;
  function mount(el) {
    if (V) return true;
    if (!hasWebGL()) return false;
    var renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false }); }
    catch (err) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(32, 1, 1, 4000);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8f96, 1.7));
    var key = new T.DirectionalLight(0xffffff, 2.1); key.position.set(-120, 200, 260); scene.add(key);
    var rim = new T.DirectionalLight(0xffffff, 0.8); rim.position.set(200, -80, 120); scene.add(rim);
    var outer = new T.Group(), inner = new T.Group();
    outer.add(inner); scene.add(outer);
    var matBase = new T.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.62, metalness: 0 });
    var matCode = new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0 });
    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.enablePan = false;
    V = { el: el, renderer: renderer, scene: scene, camera: camera, controls: controls,
          outer: outer, inner: inner, matBase: matBase, matCode: matCode, meshes: [], fmt: null };
    controls.addEventListener("change", render);
    var ro = new ResizeObserver(resize); ro.observe(el);
    resize();
    return true;
  }
  function resize() {
    if (!V) return;
    var w = V.el.clientWidth, h = V.el.clientHeight;
    if (!w || !h) return;
    V.renderer.setSize(w, h, false);
    V.camera.aspect = w / h; V.camera.updateProjectionMatrix();
    render();
  }
  function render() { if (V && !document.hidden) V.renderer.render(V.scene, V.camera); }

  function show(res, colors) {
    if (!V) return;
    V.meshes.forEach(function (m) { V.inner.remove(m); m.geometry.dispose(); });
    V.matBase.color.set(colors.base); V.matCode.color.set(colors.code);
    var mb = new T.Mesh(res.base.clone(), V.matBase), mc = new T.Mesh(res.relief.clone(), V.matCode);
    V.inner.add(mb); V.inner.add(mc); V.meshes = [mb, mc];
    V.inner.rotation.set(res.format === "soporte" ? -Math.PI / 2 : 0, 0, 0);
    V.inner.position.set(0, 0, 0); V.inner.updateMatrixWorld(true);
    var box = new T.Box3().setFromObject(V.inner);
    var c = box.getCenter(new T.Vector3());
    V.inner.position.sub(c);
    if (V.fmt !== res.format) {           // solo recolocar la cámara al cambiar de formato
      V.fmt = res.format;
      var sz = box.getSize(new T.Vector3());
      var half = Math.max(sz.x, sz.y) / 2 * (res.format === "soporte" ? 1.12 : 1);
      var dist = half / Math.tan(V.camera.fov * Math.PI / 360) * 1.22 + sz.z / 2;
      var dir = res.format === "soporte" ? new T.Vector3(0.55, 0.42, 1) : new T.Vector3(0.32, -0.22, 1);
      V.camera.position.copy(dir.normalize().multiplyScalar(dist));
      V.camera.near = dist / 50; V.camera.far = dist * 10; V.camera.updateProjectionMatrix();
      V.controls.target.set(0, 0, 0); V.controls.update();
    }
    render();
  }
  function setColors(colors) {
    if (!V) return;
    V.matBase.color.set(colors.base); V.matCode.color.set(colors.code); render();
  }

  /* ---------- 7. Exportación ---------- */
  function weld(geo) {
    var pos = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
    var count = idx ? idx.length : pos.length / 3;
    var map = new Map(), verts = [], tris = [], tri = [0, 0, 0];
    for (var t = 0; t < count; t += 3) {
      for (var k = 0; k < 3; k++) {
        var vi = idx ? idx[t + k] : t + k;
        var x = Math.round(pos[vi * 3] * 1000), y = Math.round(pos[vi * 3 + 1] * 1000), z = Math.round(pos[vi * 3 + 2] * 1000);
        var key = x + "," + y + "," + z;
        var id = map.get(key);
        if (id === undefined) { id = verts.length / 3; verts.push(x, y, z); map.set(key, id); }
        tri[k] = id;
      }
      if (tri[0] === tri[1] || tri[1] === tri[2] || tri[0] === tri[2]) continue;
      tris.push(tri[0], tri[1], tri[2]);
    }
    return { verts: verts, tris: tris }; // vértices en micras (enteros)
  }
  function hex8(hex) { return "#" + hex.replace("#", "").toUpperCase().slice(0, 6) + "FF"; }
  function meshXML(w, off) {
    var out = ["<mesh><vertices>"], v = w.verts, t = w.tris, i;
    for (i = 0; i < v.length; i += 3) {
      out.push('<vertex x="' + ((v[i] - off[0]) / 1000) + '" y="' + ((v[i + 1] - off[1]) / 1000) + '" z="' + ((v[i + 2] - off[2]) / 1000) + '"/>');
    }
    out.push("</vertices><triangles>");
    for (i = 0; i < t.length; i += 3) out.push('<triangle v1="' + t[i] + '" v2="' + t[i + 1] + '" v3="' + t[i + 2] + '"/>');
    out.push("</triangles></mesh>");
    return out.join("");
  }
  function offsetOf(list) {
    var off = [Infinity, Infinity, Infinity];
    list.forEach(function (w) {
      for (var i = 0; i < w.verts.length; i += 3) {
        if (w.verts[i] < off[0]) off[0] = w.verts[i];
        if (w.verts[i + 1] < off[1]) off[1] = w.verts[i + 1];
        if (w.verts[i + 2] < off[2]) off[2] = w.verts[i + 2];
      }
    });
    return off;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function export3MF(res, colors, title) {
    var wb = weld(res.base), wr = weld(res.relief);
    var off = offsetOf([wb, wr]);
    var model = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
      '<metadata name="Title">' + esc(title) + '</metadata>',
      '<metadata name="Application">Relieve QR</metadata>',
      '<resources>',
      '<basematerials id="1"><base name="Base" displaycolor="' + hex8(colors.base) + '"/><base name="Codigo" displaycolor="' + hex8(colors.code) + '"/></basematerials>',
      '<object id="2" name="Base" type="model" pid="1" pindex="0">' + meshXML(wb, off) + '</object>',
      '<object id="3" name="Codigo QR y texto" type="model" pid="1" pindex="1">' + meshXML(wr, off) + '</object>',
      '<object id="4" name="' + esc(title) + '" type="model"><components><component objectid="2"/><component objectid="3"/></components></object>',
      '</resources>',
      '<build><item objectid="4"/></build>',
      '</model>'
    ].join("\n");
    var zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
    zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
    zip.file("3D/3dmodel.model", model);
    return zip.generateAsync({ type: "blob", mimeType: "model/3mf", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function exportSTLZip(res, colors, baseName) {
    var exp = new STLExporter();
    var wb = weld(res.base), wr = weld(res.relief);
    var off = offsetOf([wb, wr]);
    function shifted(geo) {
      var g = geo.clone();
      g.translate(-off[0] / 1000, -off[1] / 1000, -off[2] / 1000);
      return new T.Mesh(g);
    }
    var zip = new JSZip();
    zip.file(baseName + "-1-base.stl", exp.parse(shifted(res.base), { binary: true }).buffer);
    zip.file(baseName + "-2-codigo.stl", exp.parse(shifted(res.relief), { binary: true }).buffer);
    zip.file("LEEME.txt",
      "Relieve QR - archivos STL\r\n\r\n" +
      "1. Importa LOS DOS archivos a la vez en tu programa de impresión.\r\n" +
      "   Si te pregunta si es un objeto de varias piezas, responde que SÍ.\r\n" +
      "2. No muevas las piezas por separado: ya están alineadas (ambas empiezan en 0,0,0).\r\n" +
      "3. Asigna un filamento a cada pieza:\r\n" +
      "   - " + baseName + "-1-base.stl   -> color de la base (" + colors.base.toUpperCase() + ")\r\n" +
      "   - " + baseName + "-2-codigo.stl -> color del código y el texto (" + colors.code.toUpperCase() + ")\r\n\r\n" +
      "Con una impresora de un solo color: añade un cambio de filamento en la\r\n" +
      "primera capa del relieve. Si puedes, usa el archivo 3MF: ya lleva los colores.\r\n");
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }

  window.QR3D = {
    ensure: ensure, hasWebGL: hasWebGL, build: build, mount: mount, show: show,
    setColors: setColors, render: render, resize: resize,
    export3MF: export3MF, exportSTLZip: exportSTLZip, gridRects: gridRects
  };
})();

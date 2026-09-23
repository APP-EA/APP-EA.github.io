/* Relieve QR — interfaz, QR 2D, descargas y huecos de anuncios. Script clásico (IIFE). */
(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var $ = function (s, sc) { return (sc || document).querySelector(s); };
  var $$ = function (s, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(s)); };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  var fmtNum = function (v, d) { return v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }); };

  var STYLES = {
    clasico:    { dots: "square",         corners: "square",        cornerDot: "square" },
    redondeado: { dots: "rounded",        corners: "extra-rounded", cornerDot: "dot" },
    puntos:     { dots: "dots",           corners: "dot",           cornerDot: "dot" },
    elegante:   { dots: "classy-rounded", corners: "extra-rounded", cornerDot: "square" }
  };
  var DEFAULT_SIZE = { soporte: 70, llavero: 50, placa: 90 };
  var MASK_PX = 10; // píxeles por módulo en la máscara del relieve

  var state = {
    mode: "link", style: "redondeado", fg: "#17191F", bg: "#FFFFFF",
    center: null,           // { kind:"emoji"|"logo", value, img, sil }
    format: "soporte", size: Object.assign({}, DEFAULT_SIZE),
    text: "", textEmoji: "", relief: 1.2, thick: 3,
    base: "#F4F4F0", code: "#1A1A1C"
  };
  var modules = 0;        // nº de módulos del QR actual
  var gen = 0;            // contador contra reconstrucciones obsoletas
  var current3D = null;   // último objeto construido
  var engine = "idle";    // idle | loading | ready | unavailable

  /* ---------------- contenido ---------------- */
  function wifiEsc(s) { return String(s).replace(/([\\;,:"])/g, "\\$1"); }
  function payload() {
    if (state.mode === "wifi") {
      var ssid = $("#wifiSsid").value.trim();
      if (!ssid) return "";
      var sec = $("#wifiSec").value, pass = $("#wifiPass").value;
      var s = "WIFI:T:" + sec + ";S:" + wifiEsc(ssid) + ";";
      if (sec !== "nopass") s += "P:" + wifiEsc(pass) + ";";
      if ($("#wifiHidden").checked) s += "H:true;";
      return s + ";";
    }
    var u = $("#qrUrl").value.trim();
    if (!u) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && /^[^\s]+\.[^\s]{2,}/.test(u)) u = "https://" + u;
    return u;
  }
  function slug() {
    if (state.mode === "wifi") return "qr-wifi-" + ($("#wifiSsid").value.trim() || "red").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    var p = payload();
    try {
      var u = new URL(p);
      var s = (u.hostname.replace(/^www\./, "") + u.pathname).toLowerCase();
      return "qr-" + (s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "codigo");
    } catch (e) { return "qr-codigo"; }
  }

  /* ---------------- imágenes del centro ---------------- */
  function emojiDataURL(ch, px) {
    var c = document.createElement("canvas"); c.width = c.height = px;
    var x = c.getContext("2d");
    x.font = Math.round(px * 0.8) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(ch, px / 2, px / 2 + px * 0.04);
    return c.toDataURL("image/png");
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  // silueta de un solo color: alfa si hay transparencia real, si no luminancia
  function silhouette(src) {
    return loadImg(src).then(function (img) {
      var S = 360, c = document.createElement("canvas"); c.width = c.height = S;
      var x = c.getContext("2d", { willReadFrequently: true });
      var k = Math.min(S / img.naturalWidth || 1, S / img.naturalHeight || 1);
      var w = (img.naturalWidth || S) * k, h = (img.naturalHeight || S) * k;
      x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      var id = x.getImageData(0, 0, S, S), d = id.data, i, transp = 0, inside = 0;
      var x0 = Math.floor((S - w) / 2), y0 = Math.floor((S - h) / 2);
      for (var yy = y0; yy < y0 + h; yy++) for (var xx = x0; xx < x0 + w; xx++) { inside++; if (d[(yy * S + xx) * 4 + 3] < 128) transp++; }
      var useAlpha = transp / Math.max(1, inside) > 0.04;
      for (i = 0; i < d.length; i += 4) {
        var lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        var on = useAlpha ? d[i + 3] > 128 : (d[i + 3] > 128 && lum < 140);
        d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = on ? 255 : 0;
      }
      x.putImageData(id, 0, 0);
      return c.toDataURL("image/png");
    });
  }

  /* ---------------- opciones del QR ---------------- */
  function qrOptions(size, type, mask) {
    var st = STYLES[state.style];
    var col = mask ? "#000000" : state.fg;
    var img = state.center ? (mask ? state.center.sil : state.center.img) : null;
    var o = {
      width: size, height: size, type: type, data: payload(),
      margin: mask ? 0 : Math.round(size * 0.05),
      qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: img ? "H" : "M" },
      dotsOptions: { type: st.dots, color: col },
      cornersSquareOptions: { type: st.corners, color: col },
      cornersDotOptions: { type: st.cornerDot, color: col },
      backgroundOptions: { color: mask ? "#FFFFFF" : state.bg }
    };
    if (img) {
      o.image = img;
      o.imageOptions = { hideBackgroundDots: true, imageSize: 0.34, margin: mask ? 1 : Math.max(2, Math.round(size * 0.008)), crossOrigin: "anonymous" };
    }
    return o;
  }

  /* ---------------- vista 2D ---------------- */
  function render2D() {
    var box = $("#qr2d"), p = payload();
    var empty = !p;
    $("#qrEmpty").hidden = !empty;
    box.hidden = empty;
    ["#dlPng", "#dlSvg", "#dl3mf", "#dlStl"].forEach(function (s) { $(s).disabled = empty; });
    if (empty) { modules = 0; renderChecks(); return; }
    if (!window.QRCodeStyling) return;
    var qr = new QRCodeStyling(qrOptions(640, "svg", false));
    try { modules = qr._qr ? qr._qr.getModuleCount() : 0; } catch (e) { modules = 0; }
    box.innerHTML = "";
    qr.append(box);
    renderChecks();
  }

  /* ---------------- máscara con estilo para el relieve ---------------- */
  function styledMask() {
    var n = modules;
    var size = n * MASK_PX;
    var q = new QRCodeStyling(qrOptions(size, "canvas", true));
    return q.getRawData("png").then(function (blob) {
      return createImageBitmap(blob);
    }).then(function (bmp) {
      var c = document.createElement("canvas"); c.width = size; c.height = size;
      var x = c.getContext("2d", { willReadFrequently: true });
      x.fillStyle = "#fff"; x.fillRect(0, 0, size, size);
      x.drawImage(bmp, 0, 0, size, size);
      var d = x.getImageData(0, 0, size, size).data, on = new Uint8Array(size * size);
      for (var i = 0, j = 0; i < on.length; i++, j += 4) {
        on[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) < 128 ? 1 : 0;
      }
      return { on: on, cols: size, n: n };
    });
  }

  function build3D() {
    if (!modules || !window.QR3D) return Promise.resolve(null);
    var g = ++gen;
    return window.QR3D.ensure().then(function () {
      return document.fonts && document.fonts.load ? document.fonts.load('800 40px "Bricolage Grotesque"').catch(function () {}) : null;
    }).then(function () { return styledMask(); }).then(function (mask) {
      if (g !== gen) return null;
      var res = window.QR3D.build({
        mask: mask, n: mask.n, format: state.format, S: state.size[state.format],
        text: state.text, emoji: state.textEmoji, relief: state.relief, thick: state.thick
      });
      current3D = res;
      if (engine === "ready") window.QR3D.show(res, { base: state.base, code: state.code });
      $("#dims").textContent = fmtNum(res.dims.x, 0) + " × " + fmtNum(res.dims.y, 0) + " × " + fmtNum(res.dims.z, 1) + " mm";
      renderChecks();
      return res;
    });
  }
  var rebuild3D = debounce(function () { if (engine === "ready") build3D().catch(fail3D); }, 160);
  function fail3D(e) { console.warn("[3D]", e); }

  /* ---------------- comprobaciones de impresión ---------------- */
  function hexRgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lum(h) {
    return hexRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }

  function renderChecks() {
    var ul = $("#checks"), items = [];
    if (!modules) { ul.innerHTML = ""; return; }
    var S = state.size[state.format], mm = S / modules;
    var cr = contrast(state.base, state.code);
    if (cr < 3) items.push(["bad", "Poco contraste entre los colores de impresión (<b>" + fmtNum(cr, 1) + ":1</b>). El móvil no lo leerá: usa una base clara y un código oscuro."]);
    else if (lum(state.code) > lum(state.base)) items.push(["warn", "Código más claro que la base (QR invertido). La mayoría de móviles lo leen, algunos antiguos no."]);
    else items.push(["ok", "Contraste de impresión <b>" + fmtNum(cr, 1) + ":1</b>: se escaneará bien."]);
    if (mm < 1.5) items.push(["bad", "Cada cuadradito mediría <b>" + fmtNum(mm, 2) + " mm</b> (mínimo 1,5 mm). Agranda el código o acorta el enlace."]);
    else if (mm < 2) items.push(["warn", "Cuadraditos de <b>" + fmtNum(mm, 2) + " mm</b>: imprimible con boquilla de 0,4 mm, mejor por encima de 2 mm."]);
    else items.push(["ok", "Cuadraditos de <b>" + fmtNum(mm, 2) + " mm</b> (" + modules + " × " + modules + "): nítidos con una boquilla de 0,4 mm."]);
    if (contrast(state.fg, state.bg) < 3) items.push(["warn", "La imagen PNG/SVG tiene poco contraste entre código y fondo."]);
    if (state.center) items.push(["warn", "El " + (state.center.kind === "logo" ? "logo" : "emoji") + " tapa parte del código: pruébalo con el móvil antes de imprimir una tanda."]);
    if (current3D && current3D.format === state.format) {
      if (current3D.labelMissing) items.push(["warn", "El texto no se ha podido dibujar con esta fuente."]);
      else if (current3D.labelHeightMM && current3D.labelHeightMM < 3.5) items.push(["warn", "El texto es largo y queda a <b>" + fmtNum(current3D.labelHeightMM, 1) + " mm</b> de alto: acórtalo o agranda el objeto."]);
    }
    ul.innerHTML = items.map(function (it) { return '<li class="' + it[0] + '"><span>' + it[1] + "</span></li>"; }).join("");
  }

  /* ---------------- descargas ---------------- */
  var viewerDownloads = null; // solo dentro del visor de Claude
  function saveBlob(blob, filename) {
    var p = Promise.resolve(null);
    if (window.claude && typeof window.claude.use === "function") {
      p = viewerDownloads ? Promise.resolve(viewerDownloads) : window.claude.use("downloads").then(function (d) { viewerDownloads = d; return d; }).catch(function () { return null; });
    }
    return p.then(function (dl) {
      if (dl) {
        if (/\.(png|svg|zip)$/i.test(filename)) return dl.save({ filename: filename, data: blob });
        var z = new JSZip(); z.file(filename, blob);
        return z.generateAsync({ type: "blob" }).then(function (zb) {
          toast("En esta vista previa el archivo va dentro de un .zip: descomprímelo y abre el ." + filename.split(".").pop() + ".");
          return dl.save({ filename: filename.replace(/\.[^.]+$/, "") + ".zip", data: zb });
        });
      }
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }).then(function () {
      document.dispatchEvent(new CustomEvent("qr:downloaded", { detail: { filename: filename } }));
    });
  }
  function withBusy(btn, fn) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy"); btn.setAttribute("aria-busy", "true");
    Promise.resolve().then(fn).catch(function (e) {
      if (e && e.code === "declined") return;
      console.warn(e); toast("No se ha podido generar el archivo. Inténtalo de nuevo.");
    }).then(function () { btn.classList.remove("is-busy"); btn.removeAttribute("aria-busy"); });
  }
  function dlImage(kind) {
    var q = new QRCodeStyling(qrOptions(kind === "png" ? 1200 : 1000, kind === "png" ? "canvas" : "svg", false));
    return q.getRawData(kind).then(function (b) { return saveBlob(b, slug() + "." + kind); });
  }
  function ready3D() {
    return build3D().then(function (res) { if (!res) throw new Error("sin modelo"); return res; });
  }
  function dl3MF() {
    var lbl = $("#dl3mf span"), old = lbl.textContent;
    lbl.textContent = "Generando el archivo 3D…";
    return ready3D().then(function (res) {
      return window.QR3D.export3MF(res, { base: state.base, code: state.code }, "Relieve QR · " + state.format);
    }).then(function (blob) {
      return saveBlob(blob, slug() + "-" + state.format + ".3mf");
    }).finally(function () { lbl.textContent = old; });
  }
  function dlSTL() {
    return ready3D().then(function (res) {
      return window.QR3D.exportSTLZip(res, { base: state.base, code: state.code }, slug() + "-" + state.format);
    }).then(function (blob) { return saveBlob(blob, slug() + "-" + state.format + "-stl.zip"); });
  }

  var toastT;
  function toast(msg) {
    var t = $("#toastMsg"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 5200);
  }

  /* ---------------- vista 3D (carga diferida) ---------------- */
  function activate3D() {
    if (engine !== "idle") return;
    var msg = $("#viewerMsg");
    if (!window.QR3D || !window.QR3D.hasWebGL()) {
      engine = "unavailable";
      msg.textContent = "Tu navegador no puede mostrar la vista 3D, pero la descarga del 3MF funciona igual.";
      return;
    }
    engine = "loading";
    msg.textContent = "Preparando la vista 3D…";
    window.QR3D.ensure().then(function () {
      if (!window.QR3D.mount($("#viewer"))) throw new Error("webgl");
      engine = "ready";
      msg.hidden = true;
      return build3D();
    }).catch(function (e) {
      console.warn("[3D]", e);
      engine = "unavailable";
      msg.hidden = false;
      msg.textContent = "No se ha podido cargar la vista 3D. Las descargas siguen funcionando.";
    });
  }
  function initViewer() {
    var el = $("#viewer");
    function inView() {
      if (window.innerHeight === 0 || document.hidden) return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.top < window.innerHeight + 200 && r.bottom > -200;
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) {
        if (en.some(function (e) { return e.isIntersecting; })) { activate3D(); io.disconnect(); }
      }, { rootMargin: "200px", threshold: 0.01 });
      io.observe(el);
    }
    // pestaña en segundo plano (innerHeight 0): reintentar y reaccionar al mostrarse
    var tries = 0, timer = setInterval(function () {
      if (engine !== "idle" || ++tries > 60) return clearInterval(timer);
      if (inView()) activate3D();
    }, 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      if (engine === "idle" && inView()) activate3D();
      if (engine === "ready") { window.QR3D.resize(); window.QR3D.render(); }
    });
  }

  /* ---------------- controles ---------------- */
  var refresh = debounce(function () { safe(render2D, "render2D"); rebuild3D(); }, 130);

  function initContent() {
    $$(".seg [data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.mode = b.dataset.mode;
        $$(".seg [data-mode]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        $$(".mode-pane").forEach(function (p) { p.hidden = p.dataset.pane !== state.mode; });
        if (state.mode === "wifi" && !$("#wifiSsid").value) $("#wifiSsid").focus();
        refresh();
      });
    });
    ["#qrUrl", "#wifiSsid", "#wifiPass"].forEach(function (s) { $(s).addEventListener("input", refresh); });
    ["#wifiSec", "#wifiHidden"].forEach(function (s) { $(s).addEventListener("change", refresh); });
    $("#qrUrl").addEventListener("input", function () { $("#urlHint").textContent = "Consejo: cuanto más corto el enlace, más grandes salen los cuadraditos del código."; }, { once: true });
    $$("[data-example]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ex = (data.examples || {})[b.dataset.example]; if (!ex) return;
        var inp = $("#qrUrl"); inp.value = ex.url; $("#urlHint").textContent = ex.hint;
        inp.focus(); inp.select(); refresh();
      });
    });
  }

  function setCenter(c) {
    state.center = c;
    $$(".emoji-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(!!c && c.kind === "emoji" && c.value === b.dataset.emoji)); });
    $("#centerNone").setAttribute("aria-pressed", String(!c));
    $("#centerNone").classList.toggle("is-on", !c);
    $("#centerClear").hidden = !c;
    $("#centerHint").textContent = c && c.kind === "logo"
      ? "Logo aplicado. En 3D se imprime como silueta del color del código."
      : "Toca un emoji para ponerlo en el centro. En 3D se imprime como silueta en relieve.";
    refresh();
  }

  function initDesign() {
    $$('input[name="qrStyle"]').forEach(function (r) { r.addEventListener("change", function () { state.style = r.value; refresh(); }); });
    $("#fgColor").addEventListener("input", function (e) { state.fg = e.target.value; refresh(); });
    $("#bgColor").addEventListener("input", function (e) { state.bg = e.target.value; refresh(); });
    var grid = $("#emojiGrid");
    grid.innerHTML = (data.centerEmojis || []).map(function (em) {
      return '<button type="button" class="emoji-btn" data-emoji="' + em + '" aria-pressed="false" aria-label="Emoji ' + em + '">' + em + "</button>";
    }).join("");
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".emoji-btn"); if (!b) return;
      var em = b.dataset.emoji;
      if (state.center && state.center.kind === "emoji" && state.center.value === em) return setCenter(null);
      var img = emojiDataURL(em, 256);
      silhouette(img).then(function (sil) { setCenter({ kind: "emoji", value: em, img: img, sil: sil }); });
    });
    $("#centerNone").addEventListener("click", function () { setCenter(null); });
    $("#centerClear").addEventListener("click", function () { setCenter(null); $("#logoFile").value = ""; });
    $("#logoFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast("El logo pesa más de 8 MB. Usa una imagen más ligera."); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var src = rd.result;
        silhouette(src).then(function (sil) { setCenter({ kind: "logo", value: f.name, img: src, sil: sil }); })
          .catch(function () { toast("No se ha podido leer esa imagen. Prueba con PNG o JPG."); });
      };
      rd.readAsDataURL(f);
    });
  }

  function paintSwatches() {
    $$(".swatches").forEach(function (box) {
      var key = box.dataset.target;
      $$(".sw", box).forEach(function (s) {
        var on = s.dataset.hex && s.dataset.hex.toLowerCase() === state[key].toLowerCase();
        if (s.classList.contains("sw-custom")) on = !$$(".sw[data-hex]", box).some(function (x) { return x.dataset.hex.toLowerCase() === state[key].toLowerCase(); });
        s.setAttribute("aria-pressed", String(!!on));
      });
    });
  }
  function colorsChanged() {
    paintSwatches(); renderChecks();
    if (engine === "ready") window.QR3D.setColors({ base: state.base, code: state.code });
  }

  function initObject() {
    $$('input[name="format"]').forEach(function (r) {
      r.addEventListener("change", function () {
        state.format = r.value;
        var s = $("#sizeRange"); s.value = state.size[state.format];
        $("#sizeOut").textContent = s.value + " mm";
        refresh();
      });
    });
    $("#sizeRange").addEventListener("input", function (e) {
      state.size[state.format] = +e.target.value; $("#sizeOut").textContent = e.target.value + " mm";
      renderChecks(); rebuild3D();
    });
    $("#reliefRange").addEventListener("input", function (e) { state.relief = +e.target.value; $("#reliefOut").textContent = fmtNum(state.relief, 1) + " mm"; rebuild3D(); });
    $("#thickRange").addEventListener("input", function (e) { state.thick = +e.target.value; $("#thickOut").textContent = fmtNum(state.thick, 1) + " mm"; rebuild3D(); });
    $("#labelText").addEventListener("input", function (e) { state.text = e.target.value; rebuild3D(); });
    var sel = $("#labelEmoji");
    sel.innerHTML = (data.labelEmojis || [""]).map(function (em) { return '<option value="' + em + '">' + (em || "Sin emoji") + "</option>"; }).join("");
    sel.addEventListener("change", function () { state.textEmoji = sel.value; rebuild3D(); });

    $$(".swatches").forEach(function (box) {
      var key = box.dataset.target;
      var html = (data.filaments || []).map(function (f) {
        return '<button type="button" class="sw" data-hex="' + f.hex + '" style="background:' + f.hex + '" title="' + f.name + '" aria-label="' + f.name + '" aria-pressed="false"></button>';
      }).join("");
      html += '<label class="sw sw-custom" title="Otro color" aria-pressed="false"><input type="color" aria-label="Otro color" value="' + state[key] + '"></label>';
      box.innerHTML = html;
      box.addEventListener("click", function (e) {
        var b = e.target.closest(".sw[data-hex]"); if (!b) return;
        state[key] = b.dataset.hex; colorsChanged();
      });
      $("input", box).addEventListener("input", function (e) { state[key] = e.target.value; colorsChanged(); });
    });
    paintSwatches();
  }

  function initDownloads() {
    $("#dlPng").addEventListener("click", function () { withBusy($("#dlPng"), function () { return dlImage("png"); }); });
    $("#dlSvg").addEventListener("click", function () { withBusy($("#dlSvg"), function () { return dlImage("svg"); }); });
    $("#dl3mf").addEventListener("click", function () { withBusy($("#dl3mf"), dl3MF); });
    $("#dlStl").addEventListener("click", function () { withBusy($("#dlStl"), dlSTL); });
  }

  /* ---------------- huecos de anuncios ---------------- */
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function initAds() {
    var dlg = $("#adModal");
    function closeModal() { if (dlg.open) dlg.close(); }
    document.addEventListener("qr:downloaded", function () {
      setTimeout(function () {
        if (dlg.open) return;
        if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      }, 350);
    });
    $("#adModalX").addEventListener("click", closeModal);
    $("#adModalClose").addEventListener("click", closeModal);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeModal(); });

    var toastEl = $("#adToast");
    if (ss("adToastClosed") !== "1") setTimeout(function () { toastEl.hidden = false; }, 15000);
    $("#adToastX").addEventListener("click", function () { toastEl.hidden = true; ss("adToastClosed", "1"); });
  }

  function boot() {
    if (!window.QRCodeStyling) {
      $("#qrEmpty").hidden = false; $("#qrEmpty").textContent = "No se ha podido cargar el generador. Recarga la página.";
    }
    safe(initContent, "initContent");
    safe(initDesign, "initDesign");
    safe(initObject, "initObject");
    safe(initDownloads, "initDownloads");
    safe(initAds, "initAds");
    safe(render2D, "render2D");
    safe(initViewer, "initViewer");
    window.__qr3dDebug = { state: state, build3D: build3D, styledMask: styledMask, get current() { return current3D; }, get engine() { return engine; }, get modules() { return modules; }, payload: payload };
    document.documentElement.classList.add("is-ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

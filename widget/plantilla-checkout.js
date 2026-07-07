/* ============================================================================
 * David Brito · AI Finance — Widget de checkout de Plantillas N1 (FinanStart /
 * FinanPro / FinanDirectivo).
 *
 * Uso:  <script src="https://cdn.jsdelivr.net/gh/nachojr2003/david-brito-ai-finance@main/widget/plantilla-checkout.js"></script>
 *       En el botón de cada plantilla:  onclick="dbritoPlantillaCheckout({ producto:'finanpro', precio:'S/ 109' })"
 *       (precio es solo para mostrar en el modal; el monto REAL lo pone el server).
 *
 * Flujo: abre un modal (nombre, correo, sector, teléfono con prefijo de país) ->
 *        POST al webhook n8n -> recibe el link de Mercado Pago -> redirige al pago.
 *        La plantilla se entrega por correo cuando el webhook de MP confirma el pago.
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__dbritoCheckoutLoaded) return;
  window.__dbritoCheckoutLoaded = true;

  var CFG = window.dbritoCheckoutConfig || {};
  CFG.n8nBase = CFG.n8nBase || 'https://meta.ijvagency.com';
  CFG.webhook = CFG.webhook || (CFG.n8nBase + '/webhook/dbrito-crear-pago-plantilla-web');

  var GREEN = '#0F2A22', GOLD = '#EBBA58', GOLDD = '#BA800C', TEXT = '#484848', BG = '#F5F8F6';

  var PRODUCTS = {
    finanstart:     { name: 'FinanStart',     tag: 'Tu primer control financiero' },
    finanpro:       { name: 'FinanPro',       tag: 'Control y proyección para negocios en expansión' },
    finandirectivo: { name: 'FinanDirectivo', tag: 'Finanzas de alta gerencia' }
  };

  // Prefijos de país (LatAm + ES + US). Perú por defecto.
  var COUNTRIES = [
    { n: 'Perú', d: '51', f: '🇵🇪' },
    { n: 'Argentina', d: '54', f: '🇦🇷' },
    { n: 'Bolivia', d: '591', f: '🇧🇴' },
    { n: 'Brasil', d: '55', f: '🇧🇷' },
    { n: 'Chile', d: '56', f: '🇨🇱' },
    { n: 'Colombia', d: '57', f: '🇨🇴' },
    { n: 'Costa Rica', d: '506', f: '🇨🇷' },
    { n: 'Ecuador', d: '593', f: '🇪🇨' },
    { n: 'El Salvador', d: '503', f: '🇸🇻' },
    { n: 'España', d: '34', f: '🇪🇸' },
    { n: 'Estados Unidos', d: '1', f: '🇺🇸' },
    { n: 'Guatemala', d: '502', f: '🇬🇹' },
    { n: 'Honduras', d: '504', f: '🇭🇳' },
    { n: 'México', d: '52', f: '🇲🇽' },
    { n: 'Nicaragua', d: '505', f: '🇳🇮' },
    { n: 'Panamá', d: '507', f: '🇵🇦' },
    { n: 'Paraguay', d: '595', f: '🇵🇾' },
    { n: 'Rep. Dominicana', d: '1', f: '🇩🇴' },
    { n: 'Uruguay', d: '598', f: '🇺🇾' },
    { n: 'Venezuela', d: '58', f: '🇻🇪' }
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.floor((Date.now() + Math.random() * 1e10) % 16);
      var v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
    });
  }

  // sessionId estable por navegador (TTL 30 min) -> reintentos dedupean (misma preferencia).
  var SID_KEY = 'dbrito_ck_sid', SID_TS = 'dbrito_ck_ts', TTL = 30 * 60 * 1000;
  function sessionId() {
    var id, ts = 0;
    try { id = sessionStorage.getItem(SID_KEY); ts = parseInt(sessionStorage.getItem(SID_TS) || '0', 10); } catch (e) {}
    if (!id || (Date.now() - ts) > TTL) id = 'web_' + uuid();
    try { sessionStorage.setItem(SID_KEY, id); sessionStorage.setItem(SID_TS, String(Date.now())); } catch (e) {}
    return id;
  }

  function injectFont() {
    if (document.getElementById('dbck-font')) return;
    try {
      var l = document.createElement('link'); l.id = 'dbck-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap';
      document.head.appendChild(l);
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('dbck-styles')) return;
    var css = ''
      + '.dbck-ov{position:fixed;inset:0;background:rgba(15,42,34,.55);z-index:2147483000;display:none;align-items:center;justify-content:center;padding:16px;font-family:"Outfit",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-text-size-adjust:100%;}'
      + '.dbck-ov.open{display:flex;}'
      + '.dbck-card{background:' + BG + ';width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;box-shadow:0 24px 70px rgba(15,42,34,.35);position:relative;}'
      + '.dbck-head{background:' + GREEN + ';color:#fff;padding:22px 24px 20px;border-radius:18px 18px 0 0;}'
      + '.dbck-eyebrow{color:' + GOLD + ';font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:0 0 6px;}'
      + '.dbck-title{font-size:22px;font-weight:800;margin:0;line-height:1.15;}'
      + '.dbck-tag{font-size:13px;opacity:.85;margin:6px 0 0;}'
      + '.dbck-price{display:inline-block;margin-top:12px;background:' + GOLD + ';color:' + GREEN + ';font-weight:800;font-size:15px;padding:4px 12px;border-radius:999px;}'
      + '.dbck-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;font-size:18px;line-height:1;cursor:pointer;}'
      + '.dbck-x:hover{background:rgba(255,255,255,.28);}'
      + '.dbck-body{padding:20px 24px 24px;}'
      + '.dbck-lead{font-size:13.5px;color:' + TEXT + ';margin:0 0 16px;line-height:1.5;}'
      + '.dbck-field{margin-bottom:13px;}'
      + '.dbck-label{display:block;font-size:12.5px;font-weight:600;color:' + GREEN + ';margin:0 0 5px;}'
      + '.dbck-input,.dbck-sel{width:100%;box-sizing:border-box;border:1.5px solid #d7e0da;border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;color:#26332e;background:#fff;outline:none;transition:border-color .15s;}'
      + '.dbck-input:focus,.dbck-sel:focus{border-color:' + GOLDD + ';}'
      + '.dbck-phone{display:flex;gap:8px;}'
      + '.dbck-phone .dbck-sel{flex:0 0 128px;}'
      + '.dbck-phone .dbck-input{flex:1;}'
      + '.dbck-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}'
      + '.dbck-err{display:none;background:#fdecec;color:#a12222;border:1px solid #f3c2c2;border-radius:9px;padding:9px 12px;font-size:12.5px;margin:2px 0 12px;}'
      + '.dbck-err.show{display:block;}'
      + '.dbck-btn{width:100%;border:none;border-radius:11px;background:' + GOLD + ';color:' + GREEN + ';font-family:inherit;font-size:15px;font-weight:800;padding:14px;cursor:pointer;transition:filter .15s;margin-top:4px;}'
      + '.dbck-btn:hover{filter:brightness(.96);}'
      + '.dbck-btn:disabled{opacity:.65;cursor:default;}'
      + '.dbck-note{font-size:11.5px;color:#7a857f;text-align:center;margin:12px 0 0;line-height:1.45;}'
      + '.dbck-lock{color:' + GOLDD + ';}';
    var st = document.createElement('style'); st.id = 'dbck-styles'; st.textContent = css;
    document.head.appendChild(st);
  }

  var els = null;
  function build() {
    if (els) return els;
    injectFont(); injectStyles();
    var ov = document.createElement('div'); ov.className = 'dbck-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');

    var opts = COUNTRIES.map(function (c, i) {
      return '<option value="' + c.d + '"' + (c.n === 'Perú' ? ' selected' : '') + '>' + c.f + ' ' + escapeHtml(c.n) + ' (+' + c.d + ')</option>';
    }).join('');

    ov.innerHTML =
      '<div class="dbck-card">' +
        '<button type="button" class="dbck-x" aria-label="Cerrar">&times;</button>' +
        '<div class="dbck-head">' +
          '<p class="dbck-eyebrow">Elige tu plantilla</p>' +
          '<h3 class="dbck-title" id="dbck-title">Plantilla</h3>' +
          '<p class="dbck-tag" id="dbck-tag"></p>' +
          '<span class="dbck-price" id="dbck-price" style="display:none"></span>' +
        '</div>' +
        '<div class="dbck-body">' +
          '<p class="dbck-lead">Completa tus datos y te llevamos al pago seguro con Mercado Pago. Apenas se confirme, te enviamos la plantilla en Excel + su manual a tu correo.</p>' +
          '<form id="dbck-form" novalidate>' +
            '<div class="dbck-field"><label class="dbck-label" for="dbck-nombre">Nombre completo</label>' +
              '<input class="dbck-input" id="dbck-nombre" type="text" autocomplete="name" placeholder="Tu nombre y apellido"></div>' +
            '<div class="dbck-field"><label class="dbck-label" for="dbck-correo">Correo electrónico</label>' +
              '<input class="dbck-input" id="dbck-correo" type="email" autocomplete="email" placeholder="tucorreo@empresa.com"></div>' +
            '<div class="dbck-field"><label class="dbck-label" for="dbck-sector">Sector / tipo de empresa</label>' +
              '<input class="dbck-input" id="dbck-sector" type="text" placeholder="Ej. agroexportadora, comercio, servicios..."></div>' +
            '<div class="dbck-field"><label class="dbck-label" for="dbck-telnum">Teléfono / WhatsApp</label>' +
              '<div class="dbck-phone">' +
                '<select class="dbck-sel" id="dbck-dial" aria-label="Prefijo de país">' + opts + '</select>' +
                '<input class="dbck-input" id="dbck-telnum" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="Número"></div></div>' +
            '<input class="dbck-hp" id="dbck-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" placeholder="Deja este campo vacío">' +
            '<div class="dbck-err" id="dbck-err"></div>' +
            '<button type="submit" class="dbck-btn" id="dbck-submit">Continuar con el pago →</button>' +
            '<p class="dbck-note"><span class="dbck-lock">🔒</span> Pago procesado por Mercado Pago. No guardamos datos de tu tarjeta.</p>' +
          '</form>' +
        '</div>' +
      '</div>';

    document.body.appendChild(ov);

    els = {
      ov: ov,
      card: ov.querySelector('.dbck-card'),
      title: ov.querySelector('#dbck-title'),
      tag: ov.querySelector('#dbck-tag'),
      price: ov.querySelector('#dbck-price'),
      form: ov.querySelector('#dbck-form'),
      nombre: ov.querySelector('#dbck-nombre'),
      correo: ov.querySelector('#dbck-correo'),
      sector: ov.querySelector('#dbck-sector'),
      dial: ov.querySelector('#dbck-dial'),
      telnum: ov.querySelector('#dbck-telnum'),
      hp: ov.querySelector('#dbck-hp'),
      err: ov.querySelector('#dbck-err'),
      submit: ov.querySelector('#dbck-submit')
    };

    ov.querySelector('.dbck-x').addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('open')) close(); });
    els.form.addEventListener('submit', onSubmit);
    els.telnum.addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
    return els;
  }

  var currentProducto = null;
  function showErr(msg) { els.err.textContent = msg; els.err.classList.add('show'); }
  function clearErr() { els.err.textContent = ''; els.err.classList.remove('show'); }
  function setLoading(on) {
    els.submit.disabled = on;
    els.submit.textContent = on ? 'Generando tu link de pago…' : 'Continuar con el pago →';
  }

  function open(arg) {
    var producto, precio;
    if (typeof arg === 'string') { producto = arg; }
    else if (arg && typeof arg === 'object') { producto = arg.producto || arg.plantilla; precio = arg.precio || arg.price; }
    producto = String(producto || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!PRODUCTS[producto]) { console.warn('[dbrito-checkout] producto inválido:', producto); return; }
    build();
    currentProducto = producto;
    var p = PRODUCTS[producto];
    els.title.textContent = p.name;
    els.tag.textContent = p.tag;
    if (precio) { els.price.textContent = precio; els.price.style.display = 'inline-block'; }
    else { els.price.style.display = 'none'; }
    clearErr(); setLoading(false); els.hp.value = '';
    els.ov.classList.add('open');
    setTimeout(function () { try { els.nombre.focus(); } catch (e) {} }, 60);
  }
  function close() { if (els) els.ov.classList.remove('open'); }

  function onSubmit(e) {
    e.preventDefault();
    clearErr();
    var nombre = els.nombre.value.trim();
    var correo = els.correo.value.trim();
    var sector = els.sector.value.trim();
    var dial = els.dial.value;
    var telnum = els.telnum.value.replace(/[^0-9]/g, '');
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

    if (nombre.length < 2) return showErr('Escribe tu nombre completo.');
    if (!emailOk) return showErr('Ingresa un correo electrónico válido.');
    if (sector.length < 2) return showErr('Cuéntanos el sector o tipo de tu empresa.');
    if (telnum.length < 6) return showErr('Ingresa un número de teléfono válido.');

    setLoading(true);
    var payload = {
      producto: currentProducto,
      nombre: nombre, correo: correo, sector: sector,
      dial_code: dial, telefono_num: telnum,
      session_id: sessionId(), channel: 'web',
      hp: els.hp.value
    };

    var timedOut = false;
    var t = setTimeout(function () { timedOut = true; setLoading(false); showErr('La conexión demoró demasiado. Inténtalo de nuevo.'); }, 20000);

    fetch(CFG.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (timedOut) return;
        clearTimeout(t);
        if (data && data.ok && data.init_point) {
          window.location.href = data.init_point;
        } else {
          setLoading(false);
          showErr((data && data.error) || 'No pudimos generar el link de pago. Inténtalo de nuevo en un momento.');
        }
      }).catch(function () {
        if (timedOut) return;
        clearTimeout(t);
        setLoading(false);
        showErr('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
      });
  }

  window.dbritoPlantillaCheckout = open;
})();

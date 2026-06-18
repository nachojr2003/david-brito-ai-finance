(function () {
  'use strict';
  var DEFAULTS = {
    n8nBase:        'https://n8n-jcg4epwgyztosnmbxghhwvdv.34.133.34.116.sslip.io',
    timeoutMs:      45000,
    maxRetries:     1,
    welcomeMessage: 'Hola, soy el asistente IA de **David Brito · AI Finance**.\n\nDavid es ex banquero corporativo (BBVA, Interbank · USD 30M+ en cartera) y hoy ayuda a empresarios LATAM a **ordenar sus finanzas, estructurar deuda y acceder a financiamiento con criterio**.\n\nPara situarte mejor — ¿cuéntame de tu empresa: a qué se dedica y de qué tamaño es aproximadamente?'
  };
  var CFG = window.dbritoAgentConfig = window.dbritoAgentConfig || {};
  for (var __k in DEFAULTS) { if (CFG[__k] === undefined || CFG[__k] === null) CFG[__k] = DEFAULTS[__k]; }
  if (!CFG.webhook)      CFG.webhook      = CFG.n8nBase + '/webhook/dbrito-agent';
  if (!CFG.leadsWebhook) CFG.leadsWebhook = CFG.n8nBase + '/webhook/dbrito-leads';

  var GREEN  = '#0F2A22';
  var GOLD   = '#EBBA58';
  var GOLDD  = '#BA800C';
  var BG     = '#FFFFFF';
  var TEXT   = '#1F2937';
  var LIGHT  = '#F5F8F6';

  function $(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') el.style.cssText = attrs[k];
      else if (k.indexOf('on') === 0) el[k] = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    if (html != null) el.innerHTML = html;
    return el;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function parseMd(s) {
    var t = escapeHtml(s);
    t = t.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^\*])\*([^\*]+)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>');
    t = t.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
    t = t.replace(/\n/g, '<br>');
    return t;
  }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }

  var SESSION_KEY  = 'dbrito_session_id';
  var MESSAGES_KEY = 'dbrito_messages';
  var SESSION_LAST_KEY = 'dbrito_session_last';
  var SESSION_TTL_MS = 30 * 60 * 1000; // regla 61: sessionStorage sobrevive a Cmd+Shift+R — expirar la sesion a los 30 min
  var sessionId = sessionStorage.getItem(SESSION_KEY) || uuid();
  var lastSeen = parseInt(sessionStorage.getItem(SESSION_LAST_KEY) || '0', 10);
  if (lastSeen && (Date.now() - lastSeen) > SESSION_TTL_MS) {
    sessionId = uuid();
    sessionStorage.removeItem(MESSAGES_KEY);
  }
  sessionStorage.setItem(SESSION_KEY, sessionId);
  sessionStorage.setItem(SESSION_LAST_KEY, String(Date.now()));
  function loadHistory() { try { return JSON.parse(sessionStorage.getItem(MESSAGES_KEY) || '[]'); } catch (e) { return []; } }

  var css = `
    .dbr-launcher { position: fixed; bottom: 20px; right: 20px; background: ${GREEN}; color: ${GOLD}; border: none; border-radius: 28px; padding: 12px 20px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 24px rgba(15,41,33,.22); cursor: pointer; z-index: 999998; font-family: 'Outfit', system-ui,-apple-system,sans-serif; display: flex; align-items: center; gap: 8px; }
    .dbr-launcher:hover { background: #143A2E; }
    .dbr-launcher svg { width: 18px; height: 18px; color: ${GOLD}; }
    .dbr-panel { position: fixed; bottom: 20px; right: 20px; width: 380px; max-width: calc(100vw - 32px); height: 600px; max-height: calc(100vh - 60px); background: ${BG}; border-radius: 16px; box-shadow: 0 24px 60px rgba(15,41,33,.25); z-index: 999999; display: none; flex-direction: column; overflow: hidden; font-family: 'Outfit', system-ui,-apple-system,sans-serif; color: ${TEXT}; }
    .dbr-panel.open { display: flex; }
    .dbr-header { background: ${GREEN}; color: white; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .dbr-header-title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; line-height: 1.2; }
    .dbr-header-logo { width: 44px; height: 44px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 4px; box-sizing: border-box; flex-shrink: 0; }
    .dbr-header-logo .mono { color: ${GREEN}; font-weight: 800; font-size: 9px; line-height: 1.1; letter-spacing: .3px; text-align: center; }
    .dbr-header-logo .mono .gold { color: ${GOLD}; }
    .dbr-header-sub { font-size: 11px; color: ${GOLD}; font-weight: 500; margin-top: 2px; letter-spacing: .3px; }
    .dbr-header-actions { display: flex; gap: 4px; }
    .dbr-iconbtn { background: transparent; border: none; color: white; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: .85; }
    .dbr-iconbtn:hover { opacity: 1; background: rgba(236,186,85,.18); }
    .dbr-iconbtn svg { width: 16px; height: 16px; }
    .dbr-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: ${LIGHT}; }
    .dbr-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .dbr-msg.bot  { background: white; color: ${TEXT}; align-self: flex-start; border-top-left-radius: 4px; box-shadow: 0 1px 2px rgba(15,41,33,.06); }
    .dbr-msg.user { background: ${GREEN}; color: white; align-self: flex-end; border-top-right-radius: 4px; }
    .dbr-msg ul { margin: 6px 0 0; padding-left: 20px; }
    .dbr-msg a { color: ${GOLDD}; }
    .dbr-msg.user a { color: ${GOLD}; text-decoration: underline; }
    .dbr-msg img { max-width: 1.2em !important; max-height: 1.2em !important; display: inline-block !important; vertical-align: text-bottom !important; }
    .dbr-typing { display: inline-flex; gap: 8px; align-items: center; padding: 2px 0; color: #888; font-size: 13px; font-style: italic; }
    .dbr-typing-dots { display: inline-flex; gap: 4px; }
    .dbr-typing-dots span { width: 6px; height: 6px; background: ${GOLD}; border-radius: 50%; animation: dbr-bounce 1.2s infinite; }
    .dbr-typing-dots span:nth-child(2) { animation-delay: .15s; }
    .dbr-typing-dots span:nth-child(3) { animation-delay: .3s; }
    @keyframes dbr-bounce { 0%, 80%, 100% { transform: scale(.6); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
    .dbr-caret { display: inline-block; width: 2px; height: 14px; background: ${GOLD}; vertical-align: text-bottom; animation: dbr-blink 0.9s steps(1) infinite; margin-left: 1px; }
    @keyframes dbr-blink { 50% { opacity: 0; } }
    .dbr-quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 8px; background: ${LIGHT}; }
    .dbr-quick button { background: white; color: ${GREEN}; border: 1px solid ${GREEN}; border-radius: 16px; padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
    .dbr-quick button:hover { background: ${GREEN}; color: ${GOLD}; }
    .dbr-form { padding: 14px; background: white; border-top: 1px solid #e5e7eb; flex-shrink: 0; position: relative; }
    .dbr-form-close { position: absolute; top: 8px; right: 10px; background: transparent; border: none; color: #9ca3af; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
    .dbr-form-close:hover { background: #f3f4f6; color: ${GREEN}; }
    .dbr-form-close svg { width: 14px; height: 14px; }
    .dbr-form-title { font-size: 13px; font-weight: 700; color: ${GREEN}; margin: 0 22px 4px 0; }
    .dbr-form-sub { font-size: 12px; color: #6b7280; margin: 0 0 10px; }
    .dbr-inline-cta { align-self: flex-start; background: ${GREEN}; color: ${GOLD}; border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 2px 6px rgba(15,41,33,.12); margin-top: -4px; font-family: inherit; }
    .dbr-inline-cta:hover { background: #143A2E; }
    .dbr-inline-cta svg { width: 14px; height: 14px; }
    .dbr-form input, .dbr-form textarea, .dbr-form select { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; margin-bottom: 6px; }
    .dbr-form input:focus, .dbr-form textarea:focus, .dbr-form select:focus { border-color: ${GREEN}; outline: none; }
    .dbr-form textarea { resize: vertical; min-height: 60px; }
    .dbr-form .row { display: flex; gap: 6px; }
    .dbr-form .row > * { flex: 1; }
    .dbr-form-actions { display: flex; gap: 6px; margin-top: 6px; }
    .dbr-form .submit { background: ${GREEN}; color: ${GOLD}; border: none; border-radius: 8px; padding: 9px 14px; font-weight: 700; cursor: pointer; flex: 1; }
    .dbr-form .submit:hover { background: #143A2E; }
    .dbr-form .submit:disabled { background: #9ca3af; cursor: not-allowed; color: white; }
    .dbr-form .cancel { background: transparent; color: #666; border: 1px solid #ddd; border-radius: 8px; padding: 9px 14px; cursor: pointer; }
    .dbr-form .hp { position: absolute; left: -9999px; opacity: 0; }
    .dbr-input { display: flex; gap: 8px; padding: 10px 12px; background: white; border-top: 1px solid #e5e7eb; align-items: flex-end; }
    .dbr-input textarea { flex: 1; border: 1px solid #d1d5db; border-radius: 18px; padding: 9px 14px; font-size: 14px; font-family: inherit; resize: none; max-height: 100px; outline: none; min-height: 38px; }
    .dbr-input textarea:focus { border-color: ${GREEN}; }
    .dbr-input button { background: ${GREEN}; color: ${GOLD}; border: none; border-radius: 50%; width: 38px; height: 38px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .dbr-input button:disabled { background: #ccc; color: white; cursor: not-allowed; }
    .dbr-input button svg { width: 18px; height: 18px; }
    .dbr-toast { position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%); background: rgba(15,41,33,.92); color: ${GOLD}; padding: 8px 14px; border-radius: 8px; font-size: 13px; opacity: 0; transition: opacity .3s; pointer-events: none; }
    .dbr-toast.show { opacity: 1; }
    .dbr-cta { background: linear-gradient(135deg, ${GREEN} 0%, #143A2E 100%); color: white; border-radius: 12px; padding: 14px 16px; margin: 4px 0; align-self: stretch; }
    .dbr-cta-title { font-weight: 700; font-size: 14px; margin: 0 0 6px; color: ${GOLD}; }
    .dbr-cta-text { font-size: 13px; line-height: 1.4; margin: 0 0 10px; }
    .dbr-cta a { display: inline-block; background: ${GOLD}; color: ${GREEN}; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 13px; }
    .dbr-cta a:hover { background: #fff; }
    .dbr-cta-alt { font-size: 12px; color: rgba(255,255,255,.75); margin: 10px 0 0; }
    .dbr-cta-alt a { background: transparent !important; color: ${GOLD} !important; padding: 0 !important; font-weight: 600 !important; text-decoration: underline !important; }
    .dbr-cta-alt a:hover { background: transparent !important; color: #fff !important; }
    .dbr-footer { padding: 8px 12px; background: white; text-align: center; font-size: 10px; line-height: 1.4; color: #999; border-top: 1px solid #f3f4f6; }
    .dbr-footer a { color: #888; text-decoration: underline; }
    .dbr-footer a:hover { color: ${GREEN}; }
    .dbr-footer .powered { margin-top: 2px; color: #aaa; }
    .dbr-footer .powered a { color: ${GREEN}; font-weight: 600; text-decoration: none; }
    .dbr-footer .powered a:hover { text-decoration: underline; }
    @media (max-width: 480px) { .dbr-panel { width: 100%; height: 100%; max-width: 100%; max-height: 100%; bottom: 0; right: 0; border-radius: 0; } }
  `;
  document.head.appendChild($('style', null, css));

  var launcher = $('button', { class: 'dbr-launcher', 'aria-label': 'Abrir chat' },
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> Conversa con David');

  var panel = $('div', { class: 'dbr-panel', role: 'dialog', 'aria-label': 'Chat de David Brito AI Finance' });
  var header = $('div', { class: 'dbr-header' });
  header.appendChild($('div', { class: 'dbr-header-title' },
    '<span class="dbr-header-logo"><span class="mono">DAVID<br>BRITO<br><span class="gold">AI</span></span></span>' +
    '<span><div>David Brito · AI Finance</div><div class="dbr-header-sub">CFO Externo · Asistente IA</div></span>'));
  var headerActions = $('div', { class: 'dbr-header-actions' });
  var resetBtn = $('button', { class: 'dbr-iconbtn', 'aria-label': 'Reiniciar conversación', title: 'Reiniciar' },
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>');
  var closeBtn = $('button', { class: 'dbr-iconbtn', 'aria-label': 'Cerrar' },
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>');
  headerActions.appendChild(resetBtn); headerActions.appendChild(closeBtn);
  header.appendChild(headerActions);

  var messages = $('div', { class: 'dbr-messages', 'aria-live': 'polite' });
  var quick    = $('div', { class: 'dbr-quick' });
  var formHost = $('div');
  var input    = $('div', { class: 'dbr-input' });
  var textarea = $('textarea', { rows: '1', placeholder: 'Mensaje', 'aria-label': 'Mensaje' });
  var sendBtn  = $('button', { 'aria-label': 'Enviar' },
    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>');
  input.appendChild(textarea); input.appendChild(sendBtn);

  var toast = $('div', { class: 'dbr-toast' });
  var footer = $('div', { class: 'dbr-footer' },
    'Al usar este chat acepto la <a href="/politica-privacidad" target="_blank" rel="noopener">política de privacidad</a> de David Brito · AI Finance.' +
    '<div class="powered">Powered by <a href="https://ijvagency.com/" target="_blank" rel="noopener">IJV</a></div>'
  );
  panel.appendChild(header); panel.appendChild(messages); panel.appendChild(quick);
  panel.appendChild(formHost); panel.appendChild(input); panel.appendChild(footer); panel.appendChild(toast);
  document.body.appendChild(launcher); document.body.appendChild(panel);

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { messages.scrollTop = messages.scrollHeight; });
  }
  function addMsg(role, text, opts) {
    opts = opts || {};
    var el = $('div', { class: 'dbr-msg ' + role });
    if (opts.typing) el.innerHTML = '<div class="dbr-typing"><span>Escribiendo</span><span class="dbr-typing-dots"><span></span><span></span><span></span></span></div>';
    else el.innerHTML = role === 'user' ? escapeHtml(text) : parseMd(text);
    messages.appendChild(el); scrollToBottom();
    return el;
  }
  function typeOn(el, fullText, onDone) {
    var text = String(fullText || '');
    el.innerHTML = '<span class="dbr-typed"></span><span class="dbr-caret"></span>';
    var typed = el.querySelector('.dbr-typed');
    var step = 3, i = 0;
    var timer = setInterval(function () {
      if (i >= text.length) { clearInterval(timer); el.innerHTML = parseMd(text); scrollToBottom(); if (onDone) onDone(); return; }
      i = Math.min(i + step, text.length);
      typed.innerHTML = parseMd(text.slice(0, i));
      scrollToBottom();
    }, 18);
  }
  function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 1600); }
  function setQuickButtons(buttons) {
    quick.innerHTML = '';
    if (!buttons || !buttons.length) { quick.style.display = 'none'; return; }
    quick.style.display = 'flex';
    buttons.forEach(function (b) {
      var btn = $('button', { type: 'button' }, escapeHtml(b.label));
      btn.onclick = function () { b.onClick(); };
      quick.appendChild(btn);
    });
  }
  function clearForm() { formHost.innerHTML = ''; }

  function welcome() {
    messages.innerHTML = '';
    addMsg('bot', CFG.welcomeMessage);
    setQuickButtons([
      { label: 'Tengo un negocio creciendo', onClick: function () { sendMessage('Tengo un negocio creciendo y quiero ordenar sus finanzas'); } },
      { label: 'Necesito financiamiento',    onClick: function () { sendMessage('Estoy buscando financiamiento para mi empresa'); } },
      { label: 'Agendar diagnóstico',     onClick: function () { showLeadForm(); } }
    ]);
  }

  function callAgent(msg) {
    var ctrl = new AbortController();
    var to   = setTimeout(function () { ctrl.abort(); }, CFG.timeoutMs || 45000);
    var attempt = 0; var max = (CFG.maxRetries || 0) + 1;
    function tryOnce() {
      attempt++;
      return fetch(CFG.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, sessionId: sessionId, channel: 'web' }), signal: ctrl.signal })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(function (err) { if (attempt < max) return new Promise(function (res) { setTimeout(res, 800); }).then(tryOnce); throw err; });
    }
    return tryOnce().finally(function () { clearTimeout(to); });
  }

  var sending = false;
  function sendMessage(msg) {
    if (sending || !msg || !msg.trim()) return;
    sending = true; sendBtn.disabled = true;
    sessionStorage.setItem(SESSION_LAST_KEY, String(Date.now()));
    addMsg('user', msg);
    var typingEl = addMsg('bot', '', { typing: true });
    callAgent(msg).then(function (data) {
      var responseText = data.output || data.response || 'Sin respuesta.';
      typeOn(typingEl, responseText, function () {
        var t = responseText.toLowerCase();
        if (/\b(contactar|equipo|coordinar|asesor|reuni[oó]n|agendar|d[eé]jame tus datos|dejarme tus datos)\b/.test(t)) addLeadCTA();
      });
    }).catch(function () {
      typingEl.innerHTML = '<em style="color:#b91c1c">Hubo un problema. Por favor intenta nuevamente.</em>';
    }).finally(function () { sending = false; sendBtn.disabled = false; scrollToBottom(); });
  }

  function addLeadCTA() {
    if (formHost.querySelector('.dbr-form')) return;
    // Desactiva cualquier CTA previo (si el usuario lo ignoró tipeando) y muestra uno fresco
    var prev = messages.querySelectorAll('.dbr-inline-cta');
    prev.forEach(function (p) { p.disabled = true; p.style.opacity = '.4'; p.removeAttribute('data-active'); });
    var btn = $('button', { class: 'dbr-inline-cta', type: 'button', 'data-active': '1' },
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Agendar reunión');
    btn.onclick = function () {
      btn.disabled = true;
      btn.style.opacity = '.5';
      btn.removeAttribute('data-active');
      showLeadForm();
    };
    messages.appendChild(btn);
    scrollToBottom();
  }

  function showLeadForm() {
    if (formHost.querySelector('.dbr-form')) return;
    clearForm();
    var f = $('form', { class: 'dbr-form', autocomplete: 'on' });
    f.innerHTML =
      '<button type="button" class="dbr-form-close" aria-label="Cerrar formulario" title="Cerrar"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
      '<p class="dbr-form-title">Coordinemos una reunión con David</p>' +
      '<p class="dbr-form-sub">Sesión de 45 minutos con David, uno a uno. Él te contactará personalmente.</p>' +
      '<input class="hp" name="hp" tabindex="-1" autocomplete="off">' +
      '<input name="nombre" placeholder="Nombre completo*" required maxlength="120">' +
      '<div class="row"><input name="email" type="email" placeholder="Email*" required maxlength="120">' +
                     '<input name="telefono" placeholder="Celular" maxlength="40"></div>' +
      '<input name="empresa" placeholder="Empresa" maxlength="120">' +
      '<select name="segmento">' +
        '<option value="">Tamaño de empresa (opcional)</option>' +
        '<option value="Microempresa">Microempresa — hasta USD 150K/año</option>' +
        '<option value="Pequeña Empresa">Pequeña — USD 150K – 1.7M/año</option>' +
        '<option value="Mediana Empresa">Mediana — USD 1.7M – 23M/año</option>' +
        '<option value="Gran Empresa">Gran Empresa — USD 23M – 100M/año</option>' +
      '</select>' +
      '<textarea name="consulta" placeholder="Cuéntame brevemente tu situación o lo que necesitas..." maxlength="500"></textarea>' +
      '<div class="dbr-form-actions"><button type="submit" class="submit">Solicitar reunión</button>' +
      '<button type="button" class="cancel">Cancelar</button></div>';
    f.querySelector('.cancel').onclick = clearForm;
    f.querySelector('.dbr-form-close').onclick = clearForm;
    f.onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      var body = { hp: fd.get('hp') };
      ['nombre','email','telefono','empresa','segmento','consulta'].forEach(function (k) { body[k] = fd.get(k); });
      f.querySelector('.submit').disabled = true;
      f.querySelector('.submit').textContent = 'Enviando…';
      fetch(CFG.leadsWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function () {
          clearForm();
          var firstName = (body.nombre || '').split(' ')[0] || '';
          addMsg('bot', '¡Gracias' + (firstName ? ', ' + firstName : '') + '! Recibí tus datos. David te contactará en las próximas horas.');
          var cta = $('div', { class: 'dbr-cta' });
          var calendlyHref = CFG.calendlyUrl || 'https://calendly.com/estrategia-dbaifinance/30min';
          var waHref = 'https://wa.me/' + (CFG.whatsappNumber || '51907979298') + '?text=Hola%20David%2C%20te%20escribo%20por%20el%20chat%20de%20la%20web';
          cta.innerHTML =
            '<p class="dbr-cta-title">Agenda directamente tu reunión</p>' +
            '<p class="dbr-cta-text">Si prefieres reservar tú mismo el slot que mejor te acomode, abre el calendario y elige día y hora — es el camino más rápido.</p>' +
            '<a href="' + calendlyHref + '" target="_blank" rel="noopener">Agendar 45 min →</a>' +
            '<p class="dbr-cta-alt">o escríbele por <a href="' + waHref + '" target="_blank" rel="noopener">WhatsApp</a></p>';
          messages.appendChild(cta);
          scrollToBottom();
        })
        .catch(function () {
          f.querySelector('.submit').disabled = false;
          f.querySelector('.submit').textContent = 'Solicitar reunión';
          addMsg('bot', 'Hubo un problema enviando tus datos. Intenta nuevamente o escríbele directo a dr.britos79@gmail.com.');
        });
    };
    formHost.appendChild(f);
    scrollToBottom();
  }

  launcher.onclick  = function () { panel.classList.add('open'); launcher.style.display = 'none'; if (!loadHistory().length) welcome(); textarea.focus(); };
  closeBtn.onclick  = function () { panel.classList.remove('open'); launcher.style.display = ''; };
  resetBtn.onclick  = function () {
    sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(MESSAGES_KEY);
    sessionId = uuid(); sessionStorage.setItem(SESSION_KEY, sessionId);
    sessionStorage.setItem(SESSION_LAST_KEY, String(Date.now()));
    clearForm(); welcome(); showToast('Conversación reiniciada');
  };
  sendBtn.onclick = function () { var v = textarea.value; textarea.value = ''; textarea.style.height = 'auto'; sendMessage(v); };
  textarea.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
  textarea.addEventListener('input', function () { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px'; });

  welcome();
})();

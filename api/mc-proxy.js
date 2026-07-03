// Vercel Edge Function — Proxy ManyChat → n8n (query-string mode + passthrough)
//
// Por qué existe (historia completa en CLAUDE.md §17):
// 1) ManyChat interpola {{Last Text Input}} CRUDO dentro del body JSON del
//    External Request. Un mensaje multilínea (el lead aprieta Enter) vuelve ese
//    JSON inválido.
// 2) Descubrimiento clave 2026-07-02: ManyChat VALIDA el body antes de enviar y
//    cuando el JSON queda inválido NO ENVÍA el request (lo descarta de su lado,
//    ni ejecución ni 422 llegan a ningún servidor). Por eso ni el header
//    text/plain ni un proxy/sidecar que "repare JSON" arreglan el multilínea:
//    no hay nada que reparar porque el request nunca sale de ManyChat.
//
// FIX GENÉRICO (modo query): el mensaje se saca del body y va en el QUERY STRING
// de la URL del External Request. El body queda como JSON estático siempre
// válido ({}) → ManyChat siempre envía. Este proxy lee message/sessionId/channel/
// userName (y cualquier otro param) del query, reconstruye el JSON
// {message, sessionId, ...} y lo reenvía a n8n como text/plain (el nodo
// "Parse Body" del workflow lo parsea igual que siempre).
//
// Config recomendada en ManyChat (por canal; `message` SIEMPRE el ÚLTIMO param,
// así un '&' crudo dentro del mensaje no rompe los demás campos):
//   URL:  https://drbrito-ai.vercel.app/api/mc-proxy?channel=instagram&sessionId=ig_{{Contact Id}}&userName={{First Name}}&message={{Last Text Input}}
//   Body: {}
//
// MODO DRY-RUN (para verificar si ManyChat url-encodea el multilínea, sin tocar
// n8n): agregar &dryrun=1 ANTES de message en la URL → el proxy responde
// {output: "ECO ..."} con el mensaje tal como lo parseó. ManyChat lo mapea a
// bot_response y el bot le devuelve el eco al tester. Si el eco muestra las 2
// líneas → el fix funciona; quitar el dryrun y queda live.
//
// MODO PASSTHROUGH (compat): si NO viene `message` en el query, se comporta como
// la versión anterior — reenvía el body crudo a n8n con text/plain (cubre el
// tráfico single-line actual de ManyChat mientras se migra la URL, y cualquier
// caller legacy). El widget web NO pasa por aquí (postea directo a n8n).
//
// Edge runtime => sin cold-start (~0.3s de overhead), holgado frente al timeout
// de ~10s de ManyChat.

export const config = { runtime: 'edge' };

const N8N_URL = 'https://meta.ijvagency.com/webhook/dbrito-agent';
const PROXY_NAME = 'dbrito-mc';
const TIMEOUT_MS = 9000; // red de seguridad por debajo del timeout ~10s de ManyChat

export default async function handler(req) {
  const url = new URL(req.url);
  const qp = parseQuery(url); // parse manual: `message` tolera '&'/'=' crudos (toma todo el tail)

  if (req.method === 'GET') {
    // Con ?message=... en el query: eco diagnóstico (testeable desde un browser).
    if (qp.message !== undefined) {
      return json(200, { ok: true, mode: 'query-echo', parsed: qp, lineas: countLines(qp.message) });
    }
    // Health check simple para verificar el deploy.
    return json(200, { ok: true, proxy: PROXY_NAME, target: N8N_URL, modes: ['query', 'body-passthrough'] });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let raw = '';
  try {
    raw = await req.text(); // body crudo, sin parseo => los \n multilinea se preservan
  } catch (_) {
    raw = '';
  }

  // ── MODO QUERY: el mensaje viene en la URL, el body es estático/complementario ──
  if (qp.message !== undefined) {
    let payload = {};
    if (raw && raw.trim()) {
      try { payload = JSON.parse(raw); } catch (_) { payload = {}; } // body roto => manda el query
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) payload = {};
    for (const k of Object.keys(qp)) {
      if (k === 'dryrun') continue; // interno del proxy, no viaja a n8n
      payload[k] = qp[k];
    }

    // DRY-RUN: eco sin tocar n8n — verifica que el multilínea sobrevive el query.
    if (qp.dryrun !== undefined) {
      const msg = String(payload.message || '');
      return json(200, {
        output: 'ECO del proxy — llegaron ' + countLines(msg) + ' línea(s):\n' + msg,
      });
    }

    raw = JSON.stringify(payload); // JSON SIEMPRE válido → Parse Body lo pasa directo
  }

  // ── Reenvío a n8n (igual para ambos modos) ──
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // <- la clave: nunca application/json
        'User-Agent': 'ManyChat-Proxy',
      },
      body: raw,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await upstream.text();
    // Devolvemos el cuerpo de n8n tal cual (trae {"output":"..."} que ManyChat
    // mapea con $.output). Status 200 siempre para que ManyChat siempre mapee la
    // respuesta; si viniera vacia, su rama NO ("bot_response has any value")
    // dispara el fallback.
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (_err) {
    clearTimeout(timer);
    // n8n inalcanzable / timeout: devolvemos output vacio parseable para que
    // ManyChat muestre su mensaje de fallback en vez de romperse.
    return json(200, { output: '' });
  }
}

// Parse manual del query string. Diferencias vs url.searchParams (a propósito):
// - `message` se extrae como TODO lo que viene después de "message=" (por eso va
//   al final de la URL): si ManyChat no encodeara un '&' o '=' dentro del
//   mensaje, no se pierde el resto del texto ni se rompen los otros params.
// - NO se traduce '+' a espacio: encodeURIComponent estándar usa %20; si el
//   mensaje trae un '+' literal ("2+2"), searchParams lo destrozaría.
function parseQuery(url) {
  const out = {};
  const search = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  if (!search) return out;

  let head = search;
  let tail; // el valor de `message`, sin partir por '&'
  if (search.startsWith('message=')) {
    head = '';
    tail = search.slice('message='.length);
  } else {
    const idx = search.indexOf('&message=');
    if (idx >= 0) {
      head = search.slice(0, idx);
      tail = search.slice(idx + '&message='.length);
    }
  }

  for (const pair of head.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) { out[safeDecode(pair)] = ''; continue; }
    out[safeDecode(pair.slice(0, eq))] = safeDecode(pair.slice(eq + 1));
  }
  if (tail !== undefined) out.message = safeDecode(tail);
  return out;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (_) {
    // Hay un '%' crudo que rompe el decode completo (ej. "descuento 50% ya" sin
    // encodear). Decodeamos solo los runs de %XX válidos (runs completos para no
    // partir secuencias UTF-8 multi-byte) y dejamos el resto tal cual.
    return s.replace(/(%[0-9A-Fa-f]{2})+/g, (m) => {
      try { return decodeURIComponent(m); } catch (_) { return m; }
    });
  }
}

function countLines(s) {
  return String(s).split('\n').length;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

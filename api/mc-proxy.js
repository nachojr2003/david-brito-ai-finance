// Vercel Edge Function — Proxy ManyChat → n8n (normaliza el Content-Type)
//
// Por qué existe:
// n8n rechaza con HTTP 422 ("Bad control character in string literal in JSON")
// cuando ManyChat manda un mensaje MULTILINEA (el usuario aprieta Enter) como
// application/json — el salto de linea crudo vuelve el JSON invalido y el
// framework de n8n (Express) lo tira ANTES de ejecutar el workflow, asi que el
// mensaje se pierde en silencio y ManyChat reenvia el bot_response viejo.
//
// ManyChat tiene un header "Content-Type: text/plain" configurado, PERO lo
// ignora y revierte a application/json justo cuando el cuerpo JSON queda
// invalido (multilinea) — es decir, falla exactamente cuando mas se necesita.
//
// Este proxy lee el body CRUDO (sin parsear JSON aca, asi los saltos sobreviven)
// y lo reenvia a n8n con Content-Type: text/plain SIEMPRE. El nodo "Parse Body"
// de n8n repara el JSON. Resultado: imposible el 422, sin depender del header de
// ManyChat. ManyChat solo tiene que apuntar su URL a este endpoint.
//
// Edge runtime => sin cold-start (~0.3s de overhead), holgado frente al timeout
// de ~10s de ManyChat.

export const config = { runtime: 'edge' };

const N8N_URL = 'https://meta.ijvagency.com/webhook/dbrito-agent';
const TIMEOUT_MS = 9000; // red de seguridad por debajo del timeout ~10s de ManyChat

export default async function handler(req) {
  // Health check simple para verificar el deploy con un GET.
  if (req.method === 'GET') {
    return json(200, { ok: true, proxy: 'dbrito-mc', target: N8N_URL });
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

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

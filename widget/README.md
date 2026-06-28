# Widget David Brito · AI Finance — Guía de embebido

Widget de chat conversacional con IA para embeber en cualquier sitio web. Mismo agente que corre en `drbrito-ai.vercel.app` — un solo cerebro multicanal.

## Instalación en 30 segundos

Pega este snippet **antes del `</body>`** de tu sitio:

```html
<!-- Widget David Brito · AI Finance · agente IA conversacional -->
<script>
  window.dbritoAgentConfig = {
    n8nBase:        'https://meta.ijvagency.com',
    timeoutMs:      45000,
    maxRetries:     1,
    calendlyUrl:    'https://calendly.com/estrategia-dbaifinance',
    whatsappNumber: '51907979298'
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/nachojr2003/david-brito-ai-finance@main/widget/dbrito-agent.js" defer></script>
<!-- Fin widget -->
```

Eso es todo. El botón flotante (launcher verde con ícono de chat) aparece automáticamente en la esquina inferior derecha.

## Configuración opcional

Puedes personalizar el `dbritoAgentConfig`:

| Parámetro | Valor por defecto | Para qué sirve |
|---|---|---|
| `n8nBase` | URL del backend del agente | NO tocar — apunta al backend de IJV Agency |
| `timeoutMs` | `45000` (45 segundos) | Timeout máximo por respuesta del agente |
| `maxRetries` | `1` | Reintentos si el agente no responde |
| `calendlyUrl` | URL del Calendly de David | El link "Agendar 30 min" lleva acá |
| `whatsappNumber` | `51907979298` | WhatsApp Business de David (sin `+`) |
| `welcomeMessage` | (mensaje por defecto) | Texto inicial del agente al abrir el chat |

### Ejemplo con welcome personalizado para la landing N1

Si quieres que el agente arranque con un mensaje específico para la landing de plantillas:

```html
<script>
  window.dbritoAgentConfig = {
    n8nBase:        'https://meta.ijvagency.com',
    calendlyUrl:    'https://calendly.com/estrategia-dbaifinance',
    whatsappNumber: '51907979298',
    welcomeMessage: 'Hola, soy el asistente IA de **David Brito · AI Finance**.\n\n¿Quieres saber más sobre nuestras plantillas financieras o sobre el Diagnóstico Financiero Express?'
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/nachojr2003/david-brito-ai-finance@main/widget/dbrito-agent.js" defer></script>
```

## Características incluidas

- ✅ Chat IA conversacional con Gemini 2.5 Flash
- ✅ Markdown rendering (negritas, listas, links)
- ✅ Typewriter effect en respuestas
- ✅ Quick buttons configurables ("Soy agroexportador", etc.)
- ✅ Lead form embebido (nombre, email, teléfono, empresa)
- ✅ CTA inline a Calendly + WhatsApp
- ✅ Persistencia de sesión vía `sessionStorage` (TTL 30 min)
- ✅ XSS sanitization en todas las entradas
- ✅ Anti-bot honeypot en el lead form
- ✅ Botón reset session (⟳)
- ✅ Responsive — funciona en mobile/desktop
- ✅ Identidad visual oficial: verde `#0F2A22` + dorado `#EBBA58`, fuente Outfit
- ✅ Sin dependencias externas (vanilla JS)
- ✅ Servido desde jsDelivr CDN (caché global, 99.9% uptime)

## Para forzar refresh del cache CDN

Si actualizamos el widget y necesitas que se reflejen los cambios inmediatamente sin esperar el cache TTL (~12h):

```
https://purge.jsdelivr.net/gh/nachojr2003/david-brito-ai-finance@main/widget/dbrito-agent.js
```

Visita esa URL una vez y jsDelivr fuerza la actualización.

## Tamaño

- `dbrito-agent.js` no-minified: ~22 KB
- Gzipped por jsDelivr: ~6 KB
- Sin dependencias externas — no requiere jQuery, React, ni nada

## Privacidad y cumplimiento

El widget está alineado a **Ley N° 29733 (Perú)**. La política de privacidad oficial está publicada en:
- https://drbrito-ai.vercel.app/politica-privacidad

Recomendación: incluir un link a esa política desde el footer de tu landing.

## Soporte

- IJV Agency · `javier.vergara@ijvagency.com`
- WhatsApp dueño del producto: David Brito · `+51 907 979 298`

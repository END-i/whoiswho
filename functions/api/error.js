// Cloudflare Pages Function: POST /api/error — звіт про помилку з браузера гравця (логіка й тести — src/lib/errorsink.js).
// DB — прив'язка до бази D1 «pet-errors» (налаштовано в проєкті Cloudflare, лише для продакшну).
import { handleError } from '../../src/lib/errorsink.js';

export const onRequest = ({ request, env }) => handleError(request, env.DB);

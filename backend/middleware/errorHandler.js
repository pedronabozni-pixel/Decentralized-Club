// ==========================================================================
//  Tratamento central de erros + helper para validacao com Zod.
// ==========================================================================
import { ZodError } from 'zod';

/** Envolve um handler async e encaminha erros para o errorHandler. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Valida `data` contra um schema Zod, lancando erro 400 amigavel. */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = new Error('Dados invalidos.');
    err.status = 400;
    err.details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    throw err;
  }
  return result.data;
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Rota nao encontrada.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados invalidos.',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({
    error: err.message || 'Erro interno do servidor.',
    ...(err.details ? { details: err.details } : {}),
  });
}

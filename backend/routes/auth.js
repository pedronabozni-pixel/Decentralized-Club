// ==========================================================================
//  Rotas de autenticacao: registro e login (JWT + bcrypt).
// ==========================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { usersRepo } from '../repositories/users.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, validate } from '../middleware/errorHandler.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatorio.').max(120).optional(),
  email: z.string().trim().toLowerCase().email('E-mail invalido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail invalido.'),
  password: z.string().min(1, 'Senha obrigatoria.'),
});

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name };
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const data = validate(registerSchema, req.body);

  if (usersRepo.findByEmail(data.email)) {
    return res.status(409).json({ error: 'E-mail ja cadastrado.' });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = usersRepo.create({
    email: data.email,
    passwordHash,
    name: data.name,
  });

  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const data = validate(loginSchema, req.body);

  const user = usersRepo.findByEmail(data.email);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const ok = await bcrypt.compare(data.password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciais invalidas.' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}));

export default router;

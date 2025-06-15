
import { z } from 'zod';

// Audio post validation schemas
export const audioPostSchema = z.object({
  title: z.string()
    .min(1, 'Título é obrigatório')
    .max(200, 'Título deve ter no máximo 200 caracteres')
    .regex(/^[^<>'"&]*$/, 'Título contém caracteres inválidos'),
  description: z.string()
    .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
    .regex(/^[^<>'"&]*$/, 'Descrição contém caracteres inválidos')
    .optional(),
  duration: z.number()
    .min(1, 'Duração deve ser maior que 0')
    .max(600, 'Duração máxima é de 10 minutos'),
});

// Profile validation schemas
export const profileSchema = z.object({
  username: z.string()
    .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
    .max(30, 'Nome de usuário deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Nome de usuário deve conter apenas letras, números e underscores'),
  display_name: z.string()
    .max(100, 'Nome de exibição deve ter no máximo 100 caracteres')
    .regex(/^[^<>'"&]*$/, 'Nome de exibição contém caracteres inválidos')
    .optional(),
  bio: z.string()
    .max(500, 'Bio deve ter no máximo 500 caracteres')
    .regex(/^[^<>'"&]*$/, 'Bio contém caracteres inválidos')
    .optional(),
});

// Report validation schema
export const reportSchema = z.object({
  reason: z.string()
    .min(1, 'Motivo é obrigatório')
    .max(200, 'Motivo deve ter no máximo 200 caracteres')
    .regex(/^[^<>'"&]*$/, 'Motivo contém caracteres inválidos'),
  description: z.string()
    .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
    .regex(/^[^<>'"&]*$/, 'Descrição contém caracteres inválidos')
    .optional(),
});

// Utility function to sanitize HTML content
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;');
};

// Utility function to validate file types
export const validateAudioFile = (file: File): { isValid: boolean; error?: string } => {
  const allowedTypes = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
  const maxSize = 52428800; // 50MB

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Tipo de arquivo não permitido. Use apenas arquivos de áudio.' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'Arquivo muito grande. Tamanho máximo: 50MB.' };
  }

  return { isValid: true };
};

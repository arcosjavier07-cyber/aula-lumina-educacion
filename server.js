require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get(['/manifest.webmanifest', '/sw.js', '/icon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'], (req, res) => res.sendFile(path.join(__dirname, req.path.slice(1))));

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
require('node:fs').mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'aula-lumina.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, profile TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
const sessions = new Map();
const safeEqual = (a, b) => {
 const aa = Buffer.from(a); const bb = Buffer.from(b);
 return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
function auth(req, res, next) {
 const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
 const userId = sessions.get(token);
 if (!userId) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
 req.user = db.prepare('SELECT id,name,email,profile,details FROM users WHERE id=?').get(userId);
 next();
}
app.post('/api/register', (req, res) => {
 const { name, email, password, profile, details = {} } = req.body || {};
 if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8 || !['alumno','profesor'].includes(profile)) return res.status(400).json({ error: 'Completa tus datos y usa una contraseña de al menos 8 caracteres.' });
 const salt = crypto.randomBytes(16).toString('hex');
 const hash = crypto.scryptSync(password, salt, 64).toString('hex');
 try {
  const info = db.prepare('INSERT INTO users (name,email,password_hash,salt,profile,details) VALUES (?,?,?,?,?,?)').run(name.trim(), email.toLowerCase().trim(), hash, salt, profile, JSON.stringify(details));
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Number(info.lastInsertRowid));
  res.json({ token, user: db.prepare('SELECT id,name,email,profile,details FROM users WHERE id=?').get(info.lastInsertRowid) });
 } catch { res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' }); }
});
app.post('/api/login', (req, res) => {
 const { email, password } = req.body || {};
 const user = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase().trim());
 if (!user || !safeEqual(crypto.scryptSync(password || '', user.salt, 64).toString('hex'), user.password_hash)) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
 const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
 res.json({ token, user: { id:user.id, name:user.name, email:user.email, profile:user.profile, details:JSON.parse(user.details) } });
});
app.get('/api/me', auth, (req,res) => res.json({ user: { ...req.user, details: JSON.parse(req.user.details) } }));
app.post('/api/profile', auth, (req,res) => {
 const current = db.prepare('SELECT details FROM users WHERE id=?').get(req.user.id);
 const details = { ...JSON.parse(current.details), ...(req.body?.details || {}) };
 db.prepare('UPDATE users SET details=? WHERE id=?').run(JSON.stringify(details), req.user.id);
 res.json({ ok: true, details });
});
app.post('/api/chat', auth, async (req,res) => {
 const { messages = [], subject = '', level = '' } = req.body || {};
 if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'El chat con Claude está listo, pero el administrador aún debe configurar ANTHROPIC_API_KEY en el hosting.' });
 if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) return res.status(400).json({ error: 'Envía una conversación válida.' });
 const safeMessages = messages.filter(m => ['user','assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ role:m.role, content:m.content.slice(0,12000) }));
 try {
  const response = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{ 'content-type':'application/json', 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' }, body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1200, system:`Eres Lúmina, tutora académica cálida y rigurosa para personas de cualquier nivel. Adapta el vocabulario y complejidad al nivel ${String(level).slice(0,100) || 'indicado por la persona'}. Materia o tema: ${String(subject).slice(0,150) || 'el que solicite la persona'}. Explica paso a paso, fomenta comprensión, pregunta cuando falte contexto y responde en español salvo que la persona pida otro idioma. Si te piden crear imágenes, audio o video, ofrece un prompt o guion útil con claridad: esta instalación no genera archivos multimedia por sí sola.`, messages:safeMessages }) });
  const data = await response.json();
  if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: data.error?.message || 'No se pudo conectar con Claude.' });
  res.json({ reply: data.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n') || 'No recibí una respuesta en texto.' });
 } catch { res.status(502).json({ error: 'No se pudo conectar con Claude. Revisa la conexión e inténtalo otra vez.' }); }
});
app.listen(port, '0.0.0.0', () => console.log(`Aula Lúmina disponible en el puerto ${port}`));

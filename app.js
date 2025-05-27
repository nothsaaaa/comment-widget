import express from 'express';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const cooldown = rateLimit({
  windowMs: 10 * 1000,
  max: 2,
  message: 'Too many requests, please wait a few seconds.'
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

const db = new sqlite3.Database('./comments.db');
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));

await dbRun(`CREATE TABLE IF NOT EXISTS comment_sections (
  section_id TEXT PRIMARY KEY,
  admin_password TEXT,
  moderation_enabled INTEGER DEFAULT 0
)`);

await dbRun(`CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT,
  name TEXT,
  content TEXT,
  pending INTEGER DEFAULT 0
)`);

app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', { embedCode: null, adminPassword: null });
});

app.post('/generate', cooldown, async (req, res) => {
  const sectionId = uuidv4();
  const adminPassword = crypto.randomBytes(4).toString('hex');

  try {
    await dbRun(
      'INSERT INTO comment_sections (section_id, admin_password) VALUES (?, ?)',
      sectionId,
      adminPassword
    );
    const embedCode = `<iframe src="http://localhost:${port}/widget/${sectionId}" width="100%" height="400" style="border:none;"></iframe>`;
    res.render('index', { embedCode, adminPassword });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/widget/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const theme = req.query.theme || 'default';

  try {
    const sectionExists = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
    if (sectionExists.length === 0) return res.status(404).send('Comment section not found');

    // Only approved comments
    const comments = await dbAll(
      'SELECT name, content FROM comments WHERE section_id = ? AND pending = 0 ORDER BY id DESC',
      sectionId
    );

    // Check for pending comments (waiting approval)
    const pendingCountArr = await dbAll(
      'SELECT COUNT(*) as count FROM comments WHERE section_id = ? AND pending = 1',
      sectionId
    );
    const pendingCount = pendingCountArr[0]?.count || 0;

    res.render('widget', { sectionId, comments, theme, pendingCount });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});


app.post('/widget/:sectionId', cooldown, async (req, res) => {
  const { sectionId } = req.params;
  const { name = 'Anonymous', comment } = req.body;

  try {
    const section = await dbAll('SELECT moderation_enabled FROM comment_sections WHERE section_id = ?', sectionId);
    if (section.length === 0) return res.status(404).send('Comment section not found');

    if (!comment || comment.trim().length === 0) return res.redirect(`/widget/${sectionId}`);
    if (comment.trim().length > 150) return res.status(413).send('Comment too long');

    const isPending = section[0].moderation_enabled ? 1 : 0;

    await dbRun(
      'INSERT INTO comments (section_id, name, content, pending) VALUES (?, ?, ?, ?)',
      sectionId,
      name.trim().slice(0, 30) || 'Anonymous',
      comment.trim(),
      isPending
    );

    res.redirect(`/widget/${sectionId}`);
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.get('/admin/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const { password } = req.query;

  try {
    const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
    if (section.length === 0 || section[0].admin_password !== password) return res.status(403).send('Forbidden');

    const comments = await dbAll(
      'SELECT id, name, content, pending FROM comments WHERE section_id = ? ORDER BY id DESC',
      sectionId
    );

    res.render('admin', {
      sectionId,
      comments,
      moderationEnabled: section[0].moderation_enabled,
      password
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

app.post('/admin/:sectionId/moderation', async (req, res) => {
  const { sectionId } = req.params;
  const { password, enable } = req.body;

  const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
  if (section.length === 0 || section[0].admin_password !== password) return res.status(403).send('Forbidden');

  await dbRun('UPDATE comment_sections SET moderation_enabled = ? WHERE section_id = ?', enable ? 1 : 0, sectionId);
  res.redirect(`/admin/${sectionId}?password=${password}`);
});

app.post('/admin/:sectionId/delete', async (req, res) => {
  const { sectionId } = req.params;
  const { password, commentId } = req.body;

  const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
  if (section.length === 0 || section[0].admin_password !== password) return res.status(403).send('Forbidden');

  await dbRun('DELETE FROM comments WHERE id = ? AND section_id = ?', commentId, sectionId);
  res.redirect(`/admin/${sectionId}?password=${password}`);
});

app.post('/admin/:sectionId/approve', async (req, res) => {
  const { sectionId } = req.params;
  const { password, commentId } = req.body;

  const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
  if (section.length === 0 || section[0].admin_password !== password) return res.status(403).send('Forbidden');

  await dbRun('UPDATE comments SET pending = 0 WHERE id = ? AND section_id = ?', commentId, sectionId);
  res.redirect(`/admin/${sectionId}?password=${password}`);
});

app.listen(port, () => {
  console.log(`\nComment widget running at http://localhost:${port}`);
});

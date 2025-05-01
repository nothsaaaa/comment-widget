import express from 'express';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

const db = new sqlite3.Database('./comments.db');
const dbRun = promisify(db.run.bind(db));
const dbAll = promisify(db.all.bind(db));

await dbRun(`CREATE TABLE IF NOT EXISTS comment_sections (
  section_id TEXT PRIMARY KEY
)`);

await dbRun(`CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT,
  name TEXT,
  content TEXT
)`);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', { embedCode: null });
});

app.post('/generate', async (req, res) => {
  const sectionId = uuidv4();
  await dbRun('INSERT INTO comment_sections (section_id) VALUES (?)', sectionId);
  const embedCode = `<iframe src="http://localhost:${port}/widget/${sectionId}" width="100%" height="400" style="border:none;"></iframe>`;
  res.render('index', { embedCode });
});

app.get('/widget/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const theme = req.query.theme || 'default';
  const comments = await dbAll(
    'SELECT name, content FROM comments WHERE section_id = ? ORDER BY id DESC',
    sectionId
  );
  res.render('widget', { sectionId, comments, theme });
});

app.post('/widget/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const { name = 'Anonymous', comment } = req.body;
  if (comment?.trim()) {
    await dbRun(
      'INSERT INTO comments (section_id, name, content) VALUES (?, ?, ?)',
      sectionId,
      name.trim() || 'Anonymous',
      comment.trim()
    );
  }
  res.redirect(`/widget/${sectionId}`);
});

app.listen(port, () => {
  console.log(`Comment widget running at http://localhost:${port}`);
});

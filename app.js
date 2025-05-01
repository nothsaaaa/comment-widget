import express from 'express';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import morgan from 'morgan';

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

app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  console.log(`\n[INFO] ${req.method} ${req.url} - Query: ${JSON.stringify(req.query)} - Body: ${JSON.stringify(req.body)}`);
  next();
});

app.get('/', (req, res) => {
  console.log(`[INFO] Accessed homepage to generate embed code`);
  res.render('index', { embedCode: null });
});

app.post('/generate', async (req, res) => {
  const sectionId = uuidv4();
  console.log(`[INFO] Generating new comment section with ID: ${sectionId}`);
  try {
    await dbRun('INSERT INTO comment_sections (section_id) VALUES (?)', sectionId);
    const embedCode = `<iframe src="http://localhost:${port}/widget/${sectionId}" width="100%" height="400" style="border:none;"></iframe>`;
    console.log(`[INFO] Embed code generated for sectionId: ${sectionId}`);
    res.render('index', { embedCode });
  } catch (error) {
    console.error(`[ERROR] Failed to insert comment section: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/widget/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const theme = req.query.theme || 'default';
  console.log(`[INFO] GET request for widget section ${sectionId} with theme: ${theme}`);

  try {
    const sectionExists = await dbAll('SELECT 1 FROM comment_sections WHERE section_id = ?', sectionId);
    if (sectionExists.length === 0) {
      console.warn(`[WARN] Tried to access nonexistent sectionId: ${sectionId}`);
      return res.status(404).send('Comment section not found');
    }

    const comments = await dbAll(
      'SELECT name, content FROM comments WHERE section_id = ? ORDER BY id DESC',
      sectionId
    );

    console.log(`[INFO] Loaded ${comments.length} comments for section ${sectionId}`);
    res.render('widget', { sectionId, comments, theme });
  } catch (err) {
    console.error(`[ERROR] Failed to load section: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/widget/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const { name = 'Anonymous', comment } = req.body;

  try {
    const sectionExists = await dbAll('SELECT 1 FROM comment_sections WHERE section_id = ?', sectionId);
    if (sectionExists.length === 0) {
      console.warn(`[WARN] POST to nonexistent sectionId: ${sectionId}`);
      return res.status(404).send('Comment section not found');
    }

    if (!comment || comment.trim().length === 0) {
      console.warn(`[WARN] Empty comment rejected for section ${sectionId}`);
      return res.redirect(`/widget/${sectionId}`);
    }

    if (comment.trim().length > 150) {
      console.warn(`[WARN] Comment too long (${comment.length} chars) from section ${sectionId}`);
      return res.status(413).send('Comment too long');
    }

    await dbRun(
      'INSERT INTO comments (section_id, name, content) VALUES (?, ?, ?)',
      sectionId,
      name.trim().slice(0, 30) || 'Anonymous',
      comment.trim()
    );

    console.log(`[INFO] Comment posted to section ${sectionId} by ${name}`);
    res.redirect(`/widget/${sectionId}`);
  } catch (err) {
    console.error(`[ERROR] Failed to process comment: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`\nComment widget running at http://localhost:${port}`);
});

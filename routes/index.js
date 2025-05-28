import express from 'ultimate-express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { dbRun } from '../db/database.js';
import cooldown from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { embedCode: null, adminPassword: null });
});

router.post('/generate', cooldown, async (req, res) => {
  const sectionId = uuidv4();
  const rawPassword = crypto.randomBytes(8).toString('hex');
  const saltRounds = 12; //change probably

  try {
    const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);

    await dbRun(
      'INSERT INTO comment_sections (section_id, admin_password) VALUES (?, ?)',
      sectionId,
      hashedPassword
    );

    const embedCode = `<iframe src="http://localhost:3000/widget/${sectionId}" width="100%" height="400" style="border:none;"></iframe>`;
    res.render('index', { embedCode, adminPassword: rawPassword });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

export default router;

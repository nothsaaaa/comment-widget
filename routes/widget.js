import express from 'ultimate-express';
import { dbAll, dbRun } from '../db/database.js';

const router = express.Router();

router.get('/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const theme = req.query.theme || 'default';

  try {
    const sectionExists = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
    if (sectionExists.length === 0) return res.status(404).send('Comment section not found');

    const comments = await dbAll(
      'SELECT name, content FROM comments WHERE section_id = ? AND pending = 0 ORDER BY id DESC',
      sectionId
    );

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

router.post('/:sectionId', async (req, res) => {
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

export default router;

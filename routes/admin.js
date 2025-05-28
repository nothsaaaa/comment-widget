import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { dbRun, dbAll } from '../db/database.js';
import adminAuth from '../middleware/adminAuth.js';
import { recordFailedAttempt, isBlocked } from '../utils/loginAttempts.js';

const router = express.Router();

const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
// the reason this is so long is because its not a bank
// stupid Comment widget

router.get('/:sectionId/login', (req, res) => {
  res.render('login', { sectionId: req.params.sectionId, error: null });
});

router.post('/:sectionId/login', async (req, res) => {
  const { sectionId } = req.params;
  const { password } = req.body;
  const ip = req.ip;

  if (isBlocked(ip, sectionId)) {
    return res.status(429).send('Too many incorrect login attempts. Try again later.');
  }

  try {
    const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
    if (section.length === 0) return res.status(404).send('Comment section not found');

    const isMatch = await bcrypt.compare(password, section[0].admin_password);
    if (!isMatch) {
      recordFailedAttempt(ip, sectionId);
      return res.render('login', { sectionId, error: 'Invalid password' });
    }

    // clean expired sessions on login
    await dbRun('DELETE FROM admin_sessions WHERE expires_at < ?', Date.now());

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION;

    await dbRun(
      'INSERT INTO admin_sessions (session_token, section_id, expires_at) VALUES (?, ?, ?)',
      sessionToken,
      sectionId,
      expiresAt
    );

    res.cookie(`admin_${sectionId}`, sessionToken, {
      httpOnly: true,
      signed: true,
      maxAge: SESSION_DURATION,
      // secure: true, // Enable in production HTTPS
      // i may be misunderstanding `httpOnly` and `secure: True`
    });

    res.redirect(`/admin/${sectionId}`);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/:sectionId/logout', async (req, res) => {
  const { sectionId } = req.params;
  const sessionToken = req.signedCookies[`admin_${sectionId}`];
  if (sessionToken) {
    try {
      await dbRun('DELETE FROM admin_sessions WHERE session_token = ?', sessionToken);
    } catch (err) {
      console.error('Logout DB error:', err);
    }
  }
  res.clearCookie(`admin_${sectionId}`);
  res.redirect(`/admin/${sectionId}/login`);
});

router.get('/:sectionId', adminAuth, async (req, res) => {
  const { sectionId } = req.params;

  try {
    const section = await dbAll('SELECT * FROM comment_sections WHERE section_id = ?', sectionId);
    if (section.length === 0) return res.status(404).send('Comment section not found');

    const comments = await dbAll(
      'SELECT id, name, content, pending FROM comments WHERE section_id = ? ORDER BY id DESC',
      sectionId
    );

    res.render('admin', {
      sectionId,
      comments,
      moderationEnabled: section[0].moderation_enabled
    });
  } catch (err) {
    res.status(500).send('Internal Server Error');
  }
});

router.post('/:sectionId/moderation', adminAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { enable } = req.body;

  await dbRun('UPDATE comment_sections SET moderation_enabled = ? WHERE section_id = ?', enable ? 1 : 0, sectionId);
  res.redirect(`/admin/${sectionId}`);
});

router.post('/:sectionId/delete', adminAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { commentId } = req.body;

  await dbRun('DELETE FROM comments WHERE id = ? AND section_id = ?', commentId, sectionId);
  res.redirect(`/admin/${sectionId}`);
});

router.post('/:sectionId/approve', adminAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { commentId } = req.body;

  await dbRun('UPDATE comments SET pending = 0 WHERE id = ? AND section_id = ?', commentId, sectionId);
  res.redirect(`/admin/${sectionId}`);
});

export default router;

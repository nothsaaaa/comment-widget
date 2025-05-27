import { dbGet, dbRun } from '../db/database.js';

export default async function adminAuth(req, res, next) {
  const { sectionId } = req.params;
  const sessionToken = req.signedCookies[`admin_${sectionId}`];

  if (!sessionToken) {
    return res.redirect(`/admin/${sectionId}/login`);
  }

  try {
    const session = await dbGet(
      'SELECT * FROM admin_sessions WHERE session_token = ?',
      sessionToken
    );

    if (!session || session.section_id !== sectionId || session.expires_at < Date.now()) {
      await dbRun('DELETE FROM admin_sessions WHERE session_token = ?', sessionToken);
      res.clearCookie(`admin_${sectionId}`);
      return res.redirect(`/admin/${sectionId}/login`);
    }

    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).send('Internal Server Error');
  }
}

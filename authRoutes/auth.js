const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');

const router = express.Router();

function ensureSessionUser(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
  next();
}

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, message: 'Not logged in' });
  }

  return res.json({ ok: true, user: req.session.user });
});

router.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'Name, email, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, message: 'Password must be at least 6 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'user']
    );

    req.session.user = {
      id: result.insertId,
      name,
      email,
      role: 'user',
    };

    if (req.accepts('html')) {
      return res.redirect('/resources');
    }

    return res.status(201).json({ ok: true, user: req.session.user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' || /Duplicate entry/.test(error.message)) {
      return res.status(409).json({ ok: false, message: 'A user with that email already exists.' });
    }

    console.error('Register error:', error);
    return res.status(500).json({ ok: false, message: 'Unable to create the account right now.' });
  }
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Email and password are required.' });
  }

  try {
    const [rows] = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    if (req.accepts('html')) {
      return res.redirect('/resources');
    }

    return res.json({ ok: true, user: req.session.user });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ ok: false, message: 'Unable to log in right now.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ ok: false, message: 'Unable to log out.' });
    }

    if (req.accepts('html')) {
      return res.redirect('/login');
    }

    return res.json({ ok: true, message: 'Logged out successfully.' });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout error:', error);
    }
    res.redirect('/login');
  });
});

module.exports = router;

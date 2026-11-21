const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const authRoutes = require('./authRoutes/auth');
const { testConnection, query } = require('./db/database');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'where2-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const fallbackResources = [
  {
    id: 1,
    name: 'Main Library',
    building: 'Jafet Library',
    floor: '2nd Floor',
    category_name: 'Study Area',
    description: 'Large study hall with quiet zones and plenty of tables.',
    capacity: 80,
    features: 'wifi, outlets, quiet zone',
    condition_label: 'Noise / crowd level',
    condition_code: 'quiet',
    latest_condition: 'Quiet',
    latest_comment: 'Very quiet and spacious.',
  },
  {
    id: 2,
    name: 'Computer Lab A',
    building: 'Bliss Hall',
    floor: '1st Floor',
    category_name: 'Computer Lab',
    description: 'General-purpose computer lab with Windows machines.',
    capacity: 40,
    features: 'windows, printing',
    condition_label: 'Computer availability',
    condition_code: 'many_free',
    latest_condition: 'Many PCs free',
    latest_comment: 'Several computers are available right now.',
  },
  {
    id: 3,
    name: 'Library Printer P2',
    building: 'Jafet Library',
    floor: 'Ground',
    category_name: 'Printer',
    description: 'Self-service printer and copier.',
    features: 'color, duplex, scan',
    condition_label: 'Printer status',
    condition_code: 'working',
    latest_condition: 'Working',
    latest_comment: 'Printer is functioning properly.',
  },
  {
    id: 4,
    name: 'Central Cafeteria',
    building: 'West Hall',
    floor: 'Ground',
    category_name: 'Cafeteria',
    description: 'Main cafeteria serving hot meals and coffee.',
    capacity: 150,
    features: 'hot meals, vegetarian',
    condition_label: 'Waiting time',
    condition_code: 'short_wait',
    latest_condition: 'Short wait',
    latest_comment: 'The queue is moving steadily.',
  },
];

async function fetchResourcesFromDb() {
  try {
    const [rows] = await query(`
      SELECT r.id,
             r.name,
             r.building,
             r.floor,
             r.description,
             r.capacity,
             r.features,
             c.name AS category_name,
             c.condition_label,
             co.label AS latest_condition,
             rep.comment AS latest_comment
      FROM resources r
      JOIN categories c ON c.id = r.category_id
      LEFT JOIN (
        SELECT report.resource_id, report.condition_id, report.comment, report.created_at
        FROM reports report
        INNER JOIN (
          SELECT resource_id, MAX(created_at) AS created_at
          FROM reports
          GROUP BY resource_id
        ) latest ON latest.resource_id = report.resource_id AND latest.created_at = report.created_at
      ) rep ON rep.resource_id = r.id
      LEFT JOIN condition_options co ON co.id = rep.condition_id
      WHERE r.is_active = TRUE
      ORDER BY r.name ASC
    `);

    return rows;
  } catch (error) {
    console.warn('Database read failed, using fallback data. Error:', error.message);
    return fallbackResources;
  }
}

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/health', async (req, res) => {
  const databaseReady = await testConnection();
  res.json({ ok: true, database: databaseReady });
});

app.get('/api/resources', async (req, res) => {
  const resources = await fetchResourcesFromDb();
  res.json({ ok: true, resources });
});

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await query('SELECT id, code, name, condition_label FROM categories ORDER BY name ASC');
    res.json({ ok: true, categories: rows });
  } catch (error) {
    res.json({
      ok: true,
      categories: [
        { id: 1, code: 'study_area', name: 'Study Area', condition_label: 'Noise / crowd level' },
        { id: 2, code: 'computer_lab', name: 'Computer Lab', condition_label: 'Computer availability' },
        { id: 3, code: 'printer', name: 'Printer', condition_label: 'Printer status' },
        { id: 4, code: 'cafeteria', name: 'Cafeteria', condition_label: 'Waiting time' },
      ],
    });
  }
});

function requireSession(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, message: 'Please sign in to continue.' });
  }
  next();
}

app.get('/api/reports', requireSession, async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT rp.id,
             rp.resource_id,
             rp.comment,
             rp.created_at,
             rp.user_id,
             r.name AS resource_name,
             r.building,
             c.name AS category_name,
             co.label AS condition_name,
             u.name AS reporter_name,
             SUM(CASE WHEN rv.vote = 'confirm' THEN 1 ELSE 0 END) AS confirm_count,
             SUM(CASE WHEN rv.vote = 'dispute' THEN 1 ELSE 0 END) AS dispute_count,
             MAX(CASE WHEN rv.user_id = ? THEN rv.vote ELSE NULL END) AS current_user_vote
      FROM reports rp
      JOIN resources r ON r.id = rp.resource_id
      JOIN categories c ON c.id = rp.category_id
      JOIN condition_options co ON co.id = rp.condition_id AND co.category_id = rp.category_id
      JOIN users u ON u.id = rp.user_id
      LEFT JOIN report_votes rv ON rv.report_id = rp.id
      WHERE rp.is_hidden = FALSE
      GROUP BY rp.id, rp.resource_id, rp.comment, rp.created_at, rp.user_id,
               r.name, r.building, c.name, co.label, u.name
      ORDER BY rp.created_at DESC
      LIMIT 100
    `, [req.session.user.id]);

    const reports = rows.map((report) => ({
      ...report,
      confirm_count: Number(report.confirm_count || 0),
      dispute_count: Number(report.dispute_count || 0),
      is_own_report: Number(report.user_id) === Number(req.session.user.id),
    }));

    res.json({ ok: true, reports });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ ok: false, message: 'Could not load reports.' });
  }
});

app.post('/api/reports/:reportId/vote', requireSession, async (req, res) => {
  const reportId = Number(req.params.reportId);
  const vote = String(req.body && req.body.vote || '').trim().toLowerCase();

  if (!Number.isInteger(reportId) || reportId < 1) {
    return res.status(400).json({ ok: false, message: 'Invalid report.' });
  }
  if (!['confirm', 'dispute'].includes(vote)) {
    return res.status(400).json({ ok: false, message: 'Vote must be confirm or dispute.' });
  }

  try {
    const [reports] = await query(
      'SELECT id, user_id, is_hidden FROM reports WHERE id = ?',
      [reportId]
    );
    const report = reports[0];

    if (!report) {
      return res.status(404).json({ ok: false, message: 'Report not found.' });
    }
    if (report.is_hidden) {
      return res.status(404).json({ ok: false, message: 'Report is no longer available.' });
    }
    if (Number(report.user_id) === Number(req.session.user.id)) {
      return res.status(403).json({ ok: false, message: 'You cannot vote on your own report.' });
    }

    await query(`
      INSERT INTO report_votes (user_id, report_id, vote)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE vote = VALUES(vote)
    `, [req.session.user.id, reportId, vote]);

    const [[totals]] = await query(`
      SELECT
        SUM(CASE WHEN vote = 'confirm' THEN 1 ELSE 0 END) AS confirm_count,
        SUM(CASE WHEN vote = 'dispute' THEN 1 ELSE 0 END) AS dispute_count,
        MAX(CASE WHEN user_id = ? THEN vote ELSE NULL END) AS current_user_vote
      FROM report_votes
      WHERE report_id = ?
    `, [req.session.user.id, reportId]);

    res.json({
      ok: true,
      report_id: reportId,
      confirm_count: Number(totals.confirm_count || 0),
      dispute_count: Number(totals.dispute_count || 0),
      current_user_vote: totals.current_user_vote,
      message: `Vote changed to ${vote}.`,
    });
  } catch (error) {
    if (error.sqlState === '45000' || /self-vot|cannot vote/i.test(error.message)) {
      return res.status(403).json({ ok: false, message: 'You cannot vote on your own report.' });
    }
    console.error('Vote error:', error);
    res.status(500).json({ ok: false, message: 'Could not save your vote.' });
  }
});

function renderAuthPage(res, req, page, title) {
  if (req.session.user) {
    return res.redirect('/resources');
  }

  const messages = {
    'missing-registration-fields': 'Please fill in your name, email, and password.',
    'password-too-short': 'Your password must be at least 6 characters.',
    'email-already-registered': 'An account with that email already exists.',
    'registration-unavailable': 'We could not create your account right now. Please try again.',
    'missing-login-fields': 'Please enter your email and password.',
    'invalid-credentials': 'Invalid email or password.',
    'login-unavailable': 'We could not log you in right now. Please try again.',
  };

  const message = messages[req.query.error] || '';
  res.render(page, { title, message });
}

app.get('/login', (req, res) => {
  renderAuthPage(res, req, 'login', 'Login');
});

app.get('/register', (req, res) => {
  renderAuthPage(res, req, 'register', 'Create account');
});

app.get('/signup', (req, res) => {
  renderAuthPage(res, req, 'register', 'Create account');
});

app.get('/resources', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('resources', { title: 'Resources', user: req.session.user });
});

app.get('/reports', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('reports', { title: 'Community reports', user: req.session.user });
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/resources');
  }
  return res.redirect('/login');
});

app.use('/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Route not found' });
});

app.listen(PORT, async () => {
  const dbReady = await testConnection();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(dbReady ? 'Database connection: OK' : 'Database connection: unavailable, using demo data');
});

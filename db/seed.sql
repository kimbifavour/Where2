
USE where2;

-- ---------- Categories ----------
INSERT INTO categories (code, name, condition_label) VALUES
  ('study_area',   'Study Area',   'Noise / crowd level'),
  ('computer_lab', 'Computer Lab', 'Computer availability'),
  ('printer',      'Printer',      'Printer status'),
  ('cafeteria',    'Cafeteria',    'Waiting time');

-- ---------- Allowed conditions per category ----------
INSERT INTO condition_options (category_id, code, label, score, sort_order)
SELECT id, 'quiet',     'Quiet',     100, 1 FROM categories WHERE code = 'study_area' UNION ALL
SELECT id, 'moderate',  'Moderate',   50, 2 FROM categories WHERE code = 'study_area' UNION ALL
SELECT id, 'crowded',   'Crowded',     0, 3 FROM categories WHERE code = 'study_area' UNION ALL

SELECT id, 'many_free', 'Many PCs free',  100, 1 FROM categories WHERE code = 'computer_lab' UNION ALL
SELECT id, 'some_free', 'A few PCs free',  50, 2 FROM categories WHERE code = 'computer_lab' UNION ALL
SELECT id, 'full',      'Full',             0, 3 FROM categories WHERE code = 'computer_lab' UNION ALL

SELECT id, 'working',      'Working',              100, 1 FROM categories WHERE code = 'printer' UNION ALL
SELECT id, 'low_supplies', 'Low paper / toner',     50, 2 FROM categories WHERE code = 'printer' UNION ALL
SELECT id, 'out_of_order', 'Out of order',           0, 3 FROM categories WHERE code = 'printer' UNION ALL

SELECT id, 'short_wait',    'Short wait',    100, 1 FROM categories WHERE code = 'cafeteria' UNION ALL
SELECT id, 'moderate_wait', 'Moderate wait',  50, 2 FROM categories WHERE code = 'cafeteria' UNION ALL
SELECT id, 'long_wait',     'Long wait',       0, 3 FROM categories WHERE code = 'cafeteria';

-- ---------- 15 resources (spec needs >= 12) ----------
INSERT INTO resources (name, category_id, building, floor, description, capacity, features, is_active)
SELECT 'Main Library',         id, 'Jafet Library',  '2nd Floor', 'Large silent reading hall.',              80, 'outlets,wifi,silent zone', TRUE FROM categories WHERE code='study_area' UNION ALL
SELECT 'Engineering Lounge',   id, 'Bechtel',        'Ground',    'Group-friendly lounge with whiteboards.', 24, 'outlets,whiteboard',       TRUE FROM categories WHERE code='study_area' UNION ALL
SELECT 'Atrium Study Space',   id, 'West Hall',      'Ground',    'Open atrium seating near the entrance.',  36, 'wifi,natural light',       TRUE FROM categories WHERE code='study_area' UNION ALL
SELECT 'Nicely Study Room',    id, 'Nicely Hall',    '3rd Floor', 'Small quiet room for individual study.',  18, 'outlets',                  TRUE FROM categories WHERE code='study_area' UNION ALL

SELECT 'Computer Lab A',       id, 'Bliss Hall',     '1st Floor', 'General-purpose lab, Windows PCs.',       40, 'windows,printing',         TRUE FROM categories WHERE code='computer_lab' UNION ALL
SELECT 'Engineering CAD Lab',  id, 'Bechtel',        '2nd Floor', 'High-spec PCs with CAD software.',        30, 'windows,cad,matlab',       TRUE FROM categories WHERE code='computer_lab' UNION ALL
SELECT 'Library Mac Lab',      id, 'Jafet Library',  'Ground',    'iMacs for media work.',                   20, 'mac,adobe suite',          TRUE FROM categories WHERE code='computer_lab' UNION ALL
SELECT 'Business School Lab',  id, 'Olayan School',  '1st Floor', 'Lab with Bloomberg terminals.',           25, 'windows,bloomberg',        TRUE FROM categories WHERE code='computer_lab' UNION ALL

SELECT 'Library Printer P2',   id, 'Jafet Library',  'Ground',    'Black & white and colour printing.',    NULL, 'color,duplex,scan',        TRUE  FROM categories WHERE code='printer' UNION ALL
SELECT 'Bechtel Printer B1',   id, 'Bechtel',        'Ground',    'Black & white printer for engineering.', NULL, 'duplex',                  TRUE  FROM categories WHERE code='printer' UNION ALL
SELECT 'Nicely Printer N1',    id, 'Nicely Hall',    '1st Floor', 'Self-service printer.',                  NULL, 'duplex,scan',             TRUE  FROM categories WHERE code='printer' UNION ALL
SELECT 'West Printer 03',      id, 'West Hall',      'Ground',    'Old printer, currently decommissioned.', NULL, 'b&w only',                FALSE FROM categories WHERE code='printer' UNION ALL

SELECT 'Central Cafeteria',    id, 'West Hall',      'Ground',    'Main hot-meals cafeteria.',              150, 'hot meals,vegetarian',     TRUE FROM categories WHERE code='cafeteria' UNION ALL
SELECT 'Milk Bar',             id, 'Main Gate',      'Ground',    'Coffee and quick snacks.',                40, 'coffee,outdoor seating',   TRUE FROM categories WHERE code='cafeteria' UNION ALL
SELECT 'Engineering Café',     id, 'Bechtel',        'Ground',    'Sandwiches and coffee.',                  30, 'coffee,sandwiches',        TRUE FROM categories WHERE code='cafeteria';

-- ---------- Sample reports ----------
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Very quiet, plenty of seats.', NOW() - INTERVAL 5 MINUTE
FROM users u JOIN resources r ON r.name = 'Main Library'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'quiet'
WHERE u.email = 'alice@campus.edu';

INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Exam week, every table taken.', NOW() - INTERVAL 80 MINUTE
FROM users u JOIN resources r ON r.name = 'Main Library'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'crowded'
WHERE u.email = 'bob@campus.edu';

INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Getting busier.', NOW() - INTERVAL 121 MINUTE
FROM users u JOIN resources r ON r.name = 'Main Library'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'moderate'
WHERE u.email = 'carol@campus.edu';

-- Engineering Lounge
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Some chatter, several desks available.', NOW() - INTERVAL 9 MINUTE
FROM users u JOIN resources r ON r.name = 'Engineering Lounge'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'moderate'
WHERE u.email = 'alice@campus.edu';

-- Library Printer P2
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Working - paper and toner available', NOW() - INTERVAL 6 MINUTE
FROM users u JOIN resources r ON r.name = 'Library Printer P2'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'working'
WHERE u.email = 'bob@campus.edu';

-- Bechtel Printer B1
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Paper jam, shows error E-12.', NOW() - INTERVAL 25 MINUTE
FROM users u JOIN resources r ON r.name = 'Bechtel Printer B1'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'out_of_order'
WHERE u.email = 'carol@campus.edu';

-- Computer Lab A
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, NULL, NOW() - INTERVAL 15 MINUTE
FROM users u JOIN resources r ON r.name = 'Computer Lab A'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'many_free'
WHERE u.email = 'alice@campus.edu';

-- Engineering CAD Lab
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Class in session, almost full.', NOW() - INTERVAL 40 MINUTE
FROM users u JOIN resources r ON r.name = 'Engineering CAD Lab'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'some_free'
WHERE u.email = 'bob@campus.edu';

-- Central Cafeteria
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'The line is moving steadily', NOW() - INTERVAL 12 MINUTE
FROM users u JOIN resources r ON r.name = 'Central Cafeteria'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'moderate_wait'
WHERE u.email = 'carol@campus.edu';

-- Milk Bar
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Huge line at lunch time.', NOW() - INTERVAL 30 MINUTE
FROM users u JOIN resources r ON r.name = 'Milk Bar'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'long_wait'
WHERE u.email = 'alice@campus.edu';

-- Old history report (3 days ago) - shows in history, never in current score
INSERT INTO reports (user_id, resource_id, category_id, condition_id, comment, created_at)
SELECT u.id, r.id, r.category_id, c.id, 'Empty on a Sunday.', NOW() - INTERVAL 3 DAY
FROM users u JOIN resources r ON r.name = 'Nicely Study Room'
JOIN condition_options c ON c.category_id = r.category_id AND c.code = 'quiet'
WHERE u.email = 'bob@campus.edu';

-- NOTE: 'Atrium Study Space' intentionally has NO reports -> shows "Unknown".

-- ---------- Sample votes ----------
-- Alice's fresh "Quiet" Main Library report: Bob and Carol confirm it
INSERT INTO report_votes (user_id, report_id, vote)
SELECT u.id, rp.id, 'confirm'
FROM users u
JOIN reports rp ON rp.comment = 'Very quiet, plenty of seats.'
WHERE u.email IN ('bob@campus.edu', 'carol@campus.edu');

-- Bob's "Crowded" Main Library report: Alice disputes it
INSERT INTO report_votes (user_id, report_id, vote)
SELECT u.id, rp.id, 'dispute'
FROM users u
JOIN reports rp ON rp.comment = 'Exam week, every table taken.'
WHERE u.email = 'alice@campus.edu';

-- Carol's broken printer report: Alice and Bob confirm
INSERT INTO report_votes (user_id, report_id, vote)
SELECT u.id, rp.id, 'confirm'
FROM users u
JOIN reports rp ON rp.comment = 'Paper jam, shows error E-12.'
WHERE u.email IN ('alice@campus.edu', 'bob@campus.edu');

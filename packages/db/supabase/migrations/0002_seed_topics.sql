-- Seed: single dev client + 40 curated topics across 5 themes.
-- Client UUID matches CLIENT_ID in .env (will be aligned with auth.users.id
-- once the operator signs in for the first time).

insert into clients (id, email, display_name)
values ('2ba3a610-1753-427f-a95c-c91fcbc98a04', 'adirgabay9@gmail.com', 'Reem (dev)')
on conflict (email) do nothing;

insert into app_settings (client_id)
values ('2ba3a610-1753-427f-a95c-c91fcbc98a04')
on conflict (client_id) do nothing;

with c as (select '2ba3a610-1753-427f-a95c-c91fcbc98a04'::uuid as cid)
insert into topics (client_id, he_label, en_query, theme, source) values
  -- saving (8)
  ((select cid from c), 'קרן חירום למתחילים',          'emergency fund basics',                'saving',    'seed'),
  ((select cid from c), 'כמה כסף לחסוך כל חודש',         'how much to save each month',          'saving',    'seed'),
  ((select cid from c), 'בנקאות גבוהת ריבית',           'high yield savings accounts',          'saving',    'seed'),
  ((select cid from c), 'אוטומציה של חיסכון',           'automate your savings',                'saving',    'seed'),
  ((select cid from c), 'תקציב 50/30/20',              '50 30 20 budget rule',                 'saving',    'seed'),
  ((select cid from c), 'חיסכון אגרסיבי בשנות ה-20',     'aggressive saving in your 20s',        'saving',    'seed'),
  ((select cid from c), 'סקירת תקציב חודשית',           'monthly budget review process',        'saving',    'seed'),
  ((select cid from c), 'חיסכון לרכישת דירה',           'saving for a house down payment',      'saving',    'seed'),

  -- investing (10)
  ((select cid from c), 'תעודות סל מול קרנות מדד',       'index funds vs etf',                   'investing', 'seed'),
  ((select cid from c), 'גיוון תיק השקעות',             'portfolio diversification basics',     'investing', 'seed'),
  ((select cid from c), 'עלות ממוצעת בדולר',            'dollar cost averaging explained',      'investing', 'seed'),
  ((select cid from c), 'ריבית דריבית להבנה',            'compound interest explained',          'investing', 'seed'),
  ((select cid from c), 'השקעות במס מועדף',             'tax advantaged accounts',              'investing', 'seed'),
  ((select cid from c), 'השקעה ב-S&P 500',              'investing in the s&p 500',             'investing', 'seed'),
  ((select cid from c), 'הקצאת נכסים לפי גיל',           'asset allocation by age',              'investing', 'seed'),
  ((select cid from c), 'סיכון מול תשואה',              'risk vs return tradeoff',              'investing', 'seed'),
  ((select cid from c), 'השקעה אחרי 40',                'investing after 40',                   'investing', 'seed'),
  ((select cid from c), 'למה אסור לתזמן את השוק',         'why you cant time the market',         'investing', 'seed'),

  -- debt (7)
  ((select cid from c), 'שיטת כדור השלג מול מפולת',      'snowball vs avalanche debt',           'debt',      'seed'),
  ((select cid from c), 'ריביות כרטיסי אשראי',           'credit card interest explained',       'debt',      'seed'),
  ((select cid from c), 'איחוד הלוואות',                'debt consolidation pros cons',         'debt',      'seed'),
  ((select cid from c), 'ניהול חוב סטודנטים',            'student loan strategies',              'debt',      'seed'),
  ((select cid from c), 'הימנעות ממלכודת המינימום',       'minimum payment trap',                 'debt',      'seed'),
  ((select cid from c), 'דירוג אשראי מ-A עד Z',          'credit score basics',                  'debt',      'seed'),
  ((select cid from c), 'מתי לקחת משכנתא',              'when to take a mortgage',              'debt',      'seed'),

  -- mindset (8)
  ((select cid from c), 'אינפלציית סגנון חיים',           'lifestyle inflation explained',        'mindset',   'seed'),
  ((select cid from c), 'הוצאות רגשיות',                'emotional spending triggers',          'mindset',   'seed'),
  ((select cid from c), 'שיחות כסף בזוגיות',             'money conversations couples',          'mindset',   'seed'),
  ((select cid from c), 'ללמד ילדים על כסף',             'teaching kids money basics',           'mindset',   'seed'),
  ((select cid from c), 'חופש כלכלי הוא הרגל',           'financial freedom mindset',            'mindset',   'seed'),
  ((select cid from c), 'למה משכורת לא תהפוך אותך לעשיר', 'why salary alone wont make you rich',  'mindset',   'seed'),
  ((select cid from c), 'הטיות קוגניטיביות בכסף',         'cognitive biases money decisions',     'mindset',   'seed'),
  ((select cid from c), 'החיים שאתה באמת רוצה',           'lifestyle design financial planning',  'mindset',   'seed'),

  -- tools (7)
  ((select cid from c), 'כרטיסי אשראי עם נקודות',         'credit card points strategy',          'tools',     'seed'),
  ((select cid from c), 'ביטוח חיים מתחילים',             'life insurance basics',                'tools',     'seed'),
  ((select cid from c), 'תכנון פרישה',                  'retirement planning fundamentals',     'tools',     'seed'),
  ((select cid from c), 'הצהרת הון אישית',              'personal net worth statement',         'tools',     'seed'),
  ((select cid from c), 'מכירת מניות לקיזוז מס',          'tax loss harvesting',                  'tools',     'seed'),
  ((select cid from c), 'רכב חדש מול משומש פיננסית',     'new vs used car financially',          'tools',     'seed'),
  ((select cid from c), 'תזרים מזומנים אישי',            'personal cash flow analysis',          'tools',     'seed')
on conflict (client_id, en_query) do nothing;

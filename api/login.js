const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize SQLite Database
const dbPath = path.join('/tmp', 'etf_database.db');
const db = new sqlite3.Database(dbPath);

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance REAL DEFAULT 20,
    is_vip INTEGER DEFAULT 0,
    invite_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER,
    used_by INTEGER,
    is_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create initial invite code
  db.get('SELECT COUNT(*) as count FROM invite_codes', (err, row) => {
    if (!err && row.count === 0) {
      const initialCode = `ETF-V-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      db.run('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)', [initialCode, 'admin']);
    }
  });
});

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        isVip: user.is_vip === 1,
        inviteCode: user.invite_code,
        membershipLevel: user.is_vip === 1 ? 'VIP会员' : '普通会员'
      }
    });
  });
}

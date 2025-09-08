const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');

const JWT_SECRET = 'etf_secret_key_2024';
const dbPath = path.join(process.cwd(), 'etf_database.db');
const db = new sqlite3.Database(dbPath);

// Middleware to verify JWT token
const authenticateToken = (req) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('访问令牌缺失');
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    return user;
  } catch (err) {
    throw new Error('令牌无效');
  }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const user = authenticateToken(req);
    const userId = user.userId;

    db.all(`
      SELECT t.*, 
             u1.username as from_username,
             u2.username as to_username
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      WHERE t.from_user_id = ? OR t.to_user_id = ?
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [userId, userId], (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      res.json(transactions);
    });
  } catch (error) {
    if (error.message === '访问令牌缺失') {
      return res.status(401).json({ error: error.message });
    }
    if (error.message === '令牌无效') {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: '服务器错误' });
  }
}

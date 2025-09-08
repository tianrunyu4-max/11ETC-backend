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
    
    db.get('SELECT * FROM users WHERE id = ?', [user.userId], (err, userRecord) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (!userRecord) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json({
        id: userRecord.id,
        username: userRecord.username,
        balance: userRecord.balance,
        isVip: userRecord.is_vip === 1,
        inviteCode: userRecord.invite_code,
        membershipLevel: userRecord.is_vip === 1 ? 'VIP会员' : '普通会员'
      });
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

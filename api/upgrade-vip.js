const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');

const JWT_SECRET = 'etf_secret_key_2024';
const dbPath = path.join(process.cwd(), 'etf_database.db');
const db = new sqlite3.Database(dbPath);

// Generate invite code
const generateInviteCode = () => {
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ETF-V-${randomCode}`;
};

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '方法不允许' });
  }

  try {
    const user = authenticateToken(req);
    const userId = user.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, userRecord) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (!userRecord) {
        return res.status(404).json({ error: '用户不存在' });
      }

      if (userRecord.is_vip === 1) {
        return res.status(400).json({ error: '您已经是VIP会员' });
      }

      if (userRecord.balance < 30) {
        return res.status(400).json({ error: '余额不足，需要30 USDT' });
      }

      const inviteCode = generateInviteCode();

      // Update user to VIP and deduct balance
      db.run('UPDATE users SET is_vip = 1, balance = balance - 30, invite_code = ? WHERE id = ?', 
        [inviteCode, userId], (err) => {
          if (err) {
            return res.status(500).json({ error: '升级失败' });
          }

          // Create invite code record
          db.run('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)', 
            [inviteCode, userId]);

          // Record transaction
          db.run('INSERT INTO transactions (from_user_id, amount, type) VALUES (?, 30, "vip_upgrade")', 
            [userId]);

          res.json({
            message: '升级成功！您现在是VIP会员',
            inviteCode,
            newBalance: userRecord.balance - 30
          });
        }
      );
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

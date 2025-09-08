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
    const { toUsername, amount } = req.body;
    const fromUserId = user.userId;

    if (!toUsername || !amount || amount < 10) {
      return res.status(400).json({ error: '转账金额最低10 USDT' });
    }

    // Get sender info
    db.get('SELECT * FROM users WHERE id = ?', [fromUserId], (err, fromUser) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (!fromUser || fromUser.balance < amount) {
        return res.status(400).json({ error: '余额不足' });
      }

      // Get receiver info
      db.get('SELECT * FROM users WHERE username = ?', [toUsername], (err, toUser) => {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }

        if (!toUser) {
          return res.status(404).json({ error: '接收方用户不存在' });
        }

        if (fromUser.id === toUser.id) {
          return res.status(400).json({ error: '不能转账给自己' });
        }

        // Perform transfer
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Deduct from sender
          db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, fromUserId]);

          // Add to receiver
          db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, toUser.id]);

          // Record transaction
          db.run('INSERT INTO transactions (from_user_id, to_user_id, amount, type) VALUES (?, ?, ?, "transfer")', 
            [fromUserId, toUser.id, amount], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: '转账失败' });
              }

              db.run('COMMIT');
              res.json({
                message: `成功转账 ${amount} USDT 给 ${toUsername}`,
                newBalance: fromUser.balance - amount
              });
            }
          );
        });
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

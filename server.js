const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'etf_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new sqlite3.Database('./etf_database.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance REAL DEFAULT 0,
    is_vip INTEGER DEFAULT 0,
    invite_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Transactions table
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users (id),
    FOREIGN KEY (to_user_id) REFERENCES users (id)
  )`);

  // Invite codes table
  db.run(`CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER,
    used_by INTEGER,
    is_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id),
    FOREIGN KEY (used_by) REFERENCES users (id)
  )`);
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    req.user = user;
    next();
  });
};

// Generate invite code
const generateInviteCode = () => {
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ETF-V-${randomCode}`;
};

// Routes

// User Registration (Simplified - No invite code required)
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  try {
    // Check if username already exists
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (existingUser) {
        return res.status(400).json({ error: '用户名已存在' });
      }

      // Create user with default balance
      db.run('INSERT INTO users (username, password, balance) VALUES (?, ?, 20)', 
        [username, password], 
        function(err) {
          if (err) {
            return res.status(500).json({ error: '创建用户失败' });
          }

          res.json({ 
            message: '注册成功',
            userId: this.lastID,
            user: {
              id: this.lastID,
              username: username,
              balance: 20,
              isVip: false
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// User Login (Simplified - No JWT)
app.post('/api/login', (req, res) => {
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
});

// Get user profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      id: user.id,
      username: user.username,
      balance: user.balance,
      isVip: user.is_vip === 1,
      inviteCode: user.invite_code,
      membershipLevel: user.is_vip === 1 ? 'VIP会员' : '普通会员'
    });
  });
});

// Upgrade to VIP
app.post('/api/upgrade-vip', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (user.is_vip === 1) {
      return res.status(400).json({ error: '您已经是VIP会员' });
    }

    if (user.balance < 30) {
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
          newBalance: user.balance - 30
        });
      }
    );
  });
});

// Transfer USDT
app.post('/api/transfer', authenticateToken, (req, res) => {
  const { toUsername, amount } = req.body;
  const fromUserId = req.user.userId;

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
});

// Get transaction history
app.get('/api/transactions', authenticateToken, (req, res) => {
  const userId = req.user.userId;

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
});

// Admin: Add balance to user (for testing)
app.post('/api/admin/add-balance', (req, res) => {
  const { username, amount } = req.body;

  if (!username || !amount) {
    return res.status(400).json({ error: '请提供用户名和金额' });
  }

  db.run('UPDATE users SET balance = balance + ? WHERE username = ?', 
    [amount, username], function(err) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json({ 
        message: `成功为用户 ${username} 添加 ${amount} USDT`,
        changes: this.changes
      });
    }
  );
});

// Create initial invite code for first user
app.post('/api/admin/create-invite', (req, res) => {
  const inviteCode = generateInviteCode();
  
  db.run('INSERT INTO invite_codes (code, created_by) VALUES (?, 0)', [inviteCode], (err) => {
    if (err) {
      return res.status(500).json({ error: '创建邀请码失败' });
    }

    res.json({ 
      message: '邀请码创建成功',
      inviteCode 
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '10个 ETF API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 10个 ETF 后端服务器运行在端口 ${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接时出错:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
});

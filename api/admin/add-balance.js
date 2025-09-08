const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'etf_database.db');
const db = new sqlite3.Database(dbPath);

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
}

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'etf_database.db');
const db = new sqlite3.Database(dbPath);

// Generate invite code
const generateInviteCode = () => {
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ETF-V-${randomCode}`;
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
}

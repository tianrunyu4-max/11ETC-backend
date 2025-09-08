# 10个 ETF 后端API服务

## 项目结构
```
backend/
├── server.js          # 主服务器文件
├── package.json       # 依赖配置
├── etf_database.db    # SQLite数据库（运行后自动创建）
└── README.md          # 项目说明
```

## 安装和运行

1. 安装依赖：
```bash
cd backend
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 启动生产服务器：
```bash
npm start
```

服务器将在 `http://localhost:3001` 运行

## API接口

### 认证相关
- `POST /api/register` - 用户注册
- `POST /api/login` - 用户登录
- `GET /api/profile` - 获取用户信息

### 会员功能
- `POST /api/upgrade-vip` - 升级VIP会员

### 转账功能
- `POST /api/transfer` - USDT转账
- `GET /api/transactions` - 获取交易记录

### 管理员功能
- `POST /api/admin/add-balance` - 添加用户余额
- `POST /api/admin/create-invite` - 创建邀请码

### 系统
- `GET /api/health` - 健康检查

## 数据库表结构

### users 表
- id: 用户ID
- username: 用户名
- password: 密码哈希
- balance: USDT余额
- is_vip: VIP状态
- invite_code: 邀请码
- created_at: 创建时间

### transactions 表
- id: 交易ID
- from_user_id: 发送方用户ID
- to_user_id: 接收方用户ID
- amount: 金额
- type: 交易类型
- created_at: 创建时间

### invite_codes 表
- id: 邀请码ID
- code: 邀请码
- created_by: 创建者用户ID
- used_by: 使用者用户ID
- is_used: 是否已使用
- created_at: 创建时间

## 使用说明

1. 首次运行需要创建初始邀请码：
```bash
curl -X POST http://localhost:3001/api/admin/create-invite
```

2. 为用户添加余额：
```bash
curl -X POST http://localhost:3001/api/admin/add-balance \
  -H "Content-Type: application/json" \
  -d '{"username": "用户123", "amount": 100}'
```

## 安全特性

- 密码使用bcrypt加密
- JWT令牌认证
- SQL注入防护
- 事务处理确保数据一致性

# AnimePick - AI 原生动漫筛选应用

一款基于 **Tauri 2 + React + Python** 构建的桌面动漫筛选应用。通过直观的滑动手势和丰富的筛选功能，帮助用户高效地管理和标记自己的动漫观看记录。支持**基于TF-IDF的个性化推荐系统**。

---

## ✨ 功能亮点

| 功能 | 描述 |
|------|------|
| 🎴 **卡片滑动** | 左滑跳过，右滑标记为已看 |
| ✅ **批量选择** | 点击卡片多选，一键确认 |
| 🏷️ **标签筛选** | 按标签筛选动漫（如"日本"、"搞笑"等） |
| 🔍 **高级筛选** | 按评分、年份、观看状态进行筛选 |
| 🎯 **智能推荐** | 基于观看历史的个性化推荐（TF-IDF + 滞后响应） |
| 💾 **数据持久化** | 所有操作自动保存到 SQLite 数据库 |
| ↩️ **撤销功能** | 支持撤销最近的操作 |
| 👀 **视图切换** | 在"全部"和"已看"视图间切换 |
| 📐 **布局调整** | 支持小/中/大三种卡片布局 |

### 用户状态类型

- **Watched（已看）**: 用户已观看的动漫
- **Interested（想看）**: 用户感兴趣，想要观看的动漫
- **Skipped（跳过）**: 用户不感兴趣，已跳过的动漫

---

## 🎯 推荐系统特性 (NEW!)

AnimePick 配备了先进的推荐引擎，提供个性化的动漫推荐体验：

### 核心特性

- **滞后响应机制**: 第k+1次推荐基于k-2, k-1, ..., 1的选择，避免推荐茧房
- **双重考虑**: 同时考虑全局平均特征（40%）和局部相似向量（40%）
- **多样性保障**: 多样性奖励机制（20%），防止推荐过于单一
- **高温度调节**: Temperature=2.0，平滑分数分布，增加探索性
- **Session持久化**: 跨会话保持推荐历史

### 性能指标

- **响应时间**: 平均66ms（包含HTTP往返）
- **推荐质量**: 基于14,256部动漫的TF-IDF向量
- **存储开销**: ~1.4MB内存占用
- **最小历史**: 观看至少2部动漫即可获得推荐

### 技术实现

```
TF-IDF向量化 (1000维)
    ↓
三组件融合算法
    ├─ 全局相似度 (40%)
    ├─ 局部最大相似 (40%)
    └─ 多样性奖励 (20%)
    ↓
Temperature调节 (T=2.0)
    ↓
个性化推荐结果
```

---

## 🏗️ 技术架构

```
┌─────────────────┐      IPC       ┌─────────────────┐      HTTP       ┌─────────────────┐
│   React 前端    │ ◄────────────► │  Rust 网关层    │ ◄─────────────► │ Python FastAPI  │
│   (Vite)        │                │  (Tauri 2)      │                 │   Backend       │
└─────────────────┘                └─────────────────┘                 └─────────────────┘
                                          │                                    │
                                          │                                    ▼
                                          │                            ┌─────────────────┐
                                          │                            │ 推荐引擎 (TF-IDF)│
                                          │                            │ 数据持久化       │
                                          └────► 窗口 / 托盘管理         │ SQLite 数据库    │
                                                                        └─────────────────┘
```

### 三层架构说明

| 层级 | 技术 | 职责 |
|------|------|------|
| **前端** | React 19 + TypeScript + TailwindCSS | UI 渲染、用户交互 |
| **网关** | Rust + Tauri 2 | 窗口管理、进程管理、HTTP 转发 |
| **业务** | Python + FastAPI | 推荐引擎、数据持久化 |

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1.0 | UI 框架 |
| TypeScript | 5.8.3 | 类型安全 |
| Vite | 7.0.4 | 构建工具 |
| TailwindCSS | 4.1.18 | 样式框架 |
| Framer Motion | 12.23.26 | 动画库 |
| Lucide React | 0.562.0 | 图标库 |

### Python 后端技术栈

| 技术 | 用途 |
|------|------|
| FastAPI | REST API 框架 |
| Uvicorn | ASGI 服务器 |
| SQLite | 数据持久化 |
| NumPy | 向量计算 |
| scikit-learn | TF-IDF 向量化 + Cosine 相似度 |
| SciPy | 稀疏矩阵运算 |

---

## 🚀 快速开始

### 前置条件

- **Node.js** 18+
- **Rust** (最新稳定版)
- **Python** 3.11+
- **pnpm / npm / yarn**

### 安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd anime-filter

# 2. 安装前端依赖
npm install

# 3. 设置 Python 后端
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. 预计算推荐特征（首次运行）
python scripts/precompute_recommendation_features.py

# 5. 返回项目根目录
cd ..

# 6. 开发模式运行
./scripts/dev.sh

# 或者分开运行：
# 终端 1 - Python 后端
cd backend && source venv/bin/activate && python -m backend.main --dev

# 终端 2 - Tauri 应用
npm run tauri dev
```

### 生产构建

```bash
# 1. 打包 Python 为可执行文件
./scripts/build_python.sh

# 2. 构建 Tauri 应用
npm run tauri build
```

---

## 📁 项目结构

```
anime-filter/
├── src/                          # React 前端
│   ├── App.tsx                   # 主应用组件（状态管理）
│   ├── main.tsx                  # 入口文件
│   ├── index.css                 # 全局样式 + CSS 变量
│   ├── components/               # UI 组件
│   │   ├── anime-card.tsx        # 动漫卡片（可滑动）
│   │   ├── anime-grid.tsx        # 动漫网格（核心逻辑）
│   │   ├── navbar.tsx            # 导航栏
│   │   ├── filter-panel.tsx      # 筛选面板
│   │   ├── info-modal.tsx        # 详情弹窗
│   │   └── ui/                   # 基础 UI 组件库
│   └── lib/                      # 工具函数
│       ├── api.ts                # Tauri API 封装
│       └── utils.ts              # 通用工具
│
├── src-tauri/                    # Rust 网关层
│   ├── src/
│   │   ├── main.rs               # 应用入口 + 进程管理
│   │   ├── commands.rs           # Tauri Commands（HTTP 转发）
│   │   ├── state.rs              # AppState（端口 + HTTP Client）
│   │   └── sidecar.rs            # Python 进程生命周期管理
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
│
├── backend/                      # Python FastAPI Backend
│   ├── main.py                   # 入口（动态端口 + 握手协议）
│   ├── requirements.txt          # Python 依赖
│   ├── core/
│   │   ├── config.py             # 配置管理
│   │   ├── lifespan.py           # 启动/关闭钩子
│   │   ├── logging.py            # 结构化日志
│   │   └── error_handlers.py     # 错误处理中间件
│   ├── db/
│   │   ├── database.py           # SQLite 操作 + 推荐系统数据
│   │   └── recommendation_schema.sql  # 推荐系统表结构
│   ├── routers/
│   │   ├── health.py             # /health 健康检查
│   │   └── anime.py              # /api/anime/* 动漫操作 + 推荐
│   └── services/
│       ├── anime_service.py      # 动漫业务逻辑
│       └── recommendation_service.py  # 推荐引擎核心
│
├── scripts/
│   ├── dev.sh                    # 开发启动脚本
│   ├── precompute_recommendation_features.py  # TF-IDF预计算
│   └── test_recommendation_system.py  # 推荐系统测试
│
├── public/
│   └── full_data.csv             # 动漫数据源（14,256部）
│
├── docs/
│   ├── ARCHITECTURE.md           # 详细架构文档
│   ├── RECOMMENDATION_TEST_REPORT.md  # 推荐系统测试报告
│   └── DEVELOPMENT_STATUS.md     # 当前开发状态
│
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
└── tsconfig.json
```

---

## ⌨️ 键盘快捷键

| 快捷键 | 功能 | 描述 |
|--------|------|------|
| **Q** | Skip Page | 跳过当前页面所有卡片 |
| **E** | Confirm & Next | 确认当前选择并进入下一页 |
| **R** | Undo / Previous | 撤销上一步操作或返回上一页 |
| **ESC** | Close | 关闭弹窗或筛选面板 |

> 💡 当焦点在输入框时，快捷键不生效

---

## 💾 数据存储

### 开发环境存储

| 数据类型 | 路径 |
|----------|------|
| SQLite 数据库 | `.dev_data/animepick.db` |
| 推荐特征向量 | 数据库 `anime_features` 表 |
| Session历史 | 数据库 `user_recommendation_sessions` 表 |

### 生产环境存储

| 数据类型 | 路径 |
|----------|------|
| SQLite 数据库 | `~/Library/Application Support/com.zcan.anime-filter/animepick.db` |
| Legacy CSV | `~/Library/Application Support/com.zcan.anime-filter/user_actions.csv` |

---

## 🔌 API 接口

### Python 后端 (FastAPI)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/anime/list` | GET | 获取动漫列表（支持推荐排序） |
| `/api/anime/mark` | POST | 标记动漫状态（自动追踪session） |
| `/api/anime/batch-mark` | POST | 批量标记 |
| `/api/anime/user-logs` | GET | 获取用户操作日志 |

#### 推荐排序参数

```bash
GET /api/anime/list?sort_by=recommended&session_id=<uuid>

Query参数:
- sort_by: "recommended" (启用推荐排序)
- session_id: 用户session ID（可选，自动生成）
- status_filter: 状态筛选（all/watched/unwatched/interested/skipped）
- limit: 返回数量（默认100）

响应:
{
  "filtered_ids": [30055, 85799, ...],  // 推荐排序后的ID列表
  "session_id": "uuid-string",
  "count": 14251
}
```

### Rust 转发命令 (Tauri)

| 命令 | 描述 |
|------|------|
| `get_backend_port` | 获取 Python 后端端口 |
| `forward_health_check` | 转发健康检查 |
| `forward_get_anime_list` | 转发获取动漫列表 |
| `forward_mark_anime` | 转发标记动漫 |

---

## 🧪 测试

### 运行推荐系统测试

```bash
# 1. 启动后端（开发模式）
cd backend && source venv/bin/activate
python -m backend.main --dev

# 2. 在另一个终端运行测试
python scripts/test_recommendation_system.py
```

### 测试覆盖

- ✅ Session创建和管理
- ✅ 滞后响应机制验证
- ✅ 推荐质量检查
- ✅ 性能基准测试（66ms平均响应）
- ✅ 降级处理（无历史时）

完整测试报告: `docs/RECOMMENDATION_TEST_REPORT.md`

---

## 📋 更新日志

### v0.3.0 (2026-01-09) - 推荐系统发布

**新功能**:
- 🎯 TF-IDF向量化推荐引擎
- 🔄 滞后响应机制（防茧房）
- 📊 三组件融合算法（全局+局部+多样性）
- 💾 Session持久化管理
- ⚡ 向量化性能优化（300倍提升）

**技术改进**:
- 数据库迁移: CSV → SQLite
- 推荐特征预计算脚本
- 端到端测试套件
- 结构化日志系统

### v0.2.0 (2026-01-09)

- 🏗️ 架构重构：Rust 网关 + Python Sidecar
- 🐍 新增 FastAPI 后端
- 📦 动态端口绑定 + 进程生命周期管理
- 📁 优化前端目录结构

### v0.1.0 (2026-01-01)

- ✅ 基础滑动卡片功能
- ✅ 多选批量操作
- ✅ 标签筛选系统
- ✅ 高级筛选面板
- ✅ 数据持久化
- ✅ 键盘快捷键支持

---

## 📖 文档

- [架构文档](docs/ARCHITECTURE.md) - 详细技术架构说明
- [推荐系统测试报告](docs/RECOMMENDATION_TEST_REPORT.md) - 性能和功能测试
- [开发状态](docs/DEVELOPMENT_STATUS.md) - 当前开发进度
- [前后端联调计划](frontend_integration_plan.md) - 前端集成计划

---

## 🛠️ 开发指南

### 查看后端日志

```bash
# 后端日志打印到 stderr（结构化JSON格式）
# 启动握手信号: SERVER_PORT:12345
```

### 预计算推荐特征

```bash
cd backend && source venv/bin/activate
python scripts/precompute_recommendation_features.py

# 输出:
# ✓ Loaded 14,256 anime
# ✓ TF-IDF matrix shape: (14256, 1000)
# ✓ Vocabulary size: 1000
# ✓ Saved 14,256 anime features
```

### 查看数据库

```bash
# SQLite CLI
sqlite3 .dev_data/animepick.db

# 查看推荐特征
SELECT subject_id, json_extract(tfidf_vector, '$.indices')
FROM anime_features LIMIT 5;

# 查看Session历史
SELECT * FROM user_recommendation_sessions;
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

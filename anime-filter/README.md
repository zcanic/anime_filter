# AnimePick - AI 原生动漫筛选应用

一款基于 **Tauri 2 + React + Python** 构建的桌面动漫筛选应用。通过直观的滑动手势和丰富的筛选功能，帮助用户高效地管理和标记自己的动漫观看记录。支持本地 AI 推荐（Apple Silicon 优化）。

---

## ✨ 功能亮点

| 功能 | 描述 |
|------|------|
| 🎴 **卡片滑动** | 左滑跳过，右滑标记为已看 |
| ✅ **批量选择** | 点击卡片多选，一键确认 |
| 🏷️ **标签筛选** | 按标签筛选动漫（如"日本"、"搞笑"等） |
| 🔍 **高级筛选** | 按评分、年份、观看状态进行筛选 |
| 💾 **数据持久化** | 所有操作自动保存到本地 CSV 文件 |
| ↩️ **撤销功能** | 支持撤销最近的操作 |
| 👀 **视图切换** | 在"全部"和"已看"视图间切换 |
| 📐 **布局调整** | 支持小/中/大三种卡片布局 |
| 🤖 **AI 推荐** | 基于本地模型的智能推荐（开发中） |

### 用户状态类型

- **Watched（已看）**: 用户已观看的动漫
- **Interested（想看）**: 用户感兴趣，想要观看的动漫
- **Skipped（跳过）**: 用户不感兴趣，已跳过的动漫

---

## 🏗️ 技术架构

```
┌─────────────────┐      IPC       ┌─────────────────┐      HTTP       ┌─────────────────┐
│   React 前端    │ ◄────────────► │  Rust 网关层    │ ◄─────────────► │ Python Sidecar  │
│   (Vite)        │                │  (Tauri 2)      │                 │  (FastAPI)      │
└─────────────────┘                └─────────────────┘                 └─────────────────┘
                                          │                                    │
                                          │                                    ▼
                                          │                            ┌─────────────────┐
                                          │                            │   AI 推理引擎    │
                                          │                            │   数据爬虫       │
                                          └────► 窗口 / 托盘管理         │   SQLite/CSV    │
                                                                        └─────────────────┘
```

### 三层架构说明

| 层级 | 技术 | 职责 |
|------|------|------|
| **前端** | React 19 + TypeScript + TailwindCSS | UI 渲染、用户交互 |
| **网关** | Rust + Tauri 2 | 窗口管理、进程管理、HTTP 转发 |
| **业务** | Python + FastAPI | AI 推理、爬虫、数据持久化 |

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
| PyTorch | 深度学习框架 |
| sentence-transformers | 文本嵌入 |
| MLX | Apple Silicon LLM 推理 |
| aiohttp | 异步爬虫 |

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
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 4. 开发模式运行（推荐使用脚本）
./scripts/dev.sh

# 或者分开运行：
# 终端 1 - Python 后端
cd backend && source .venv/bin/activate && python main.py --dev

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
│   │   ├── keyboard-guide.tsx    # 快捷键提示
│   │   └── ui/                   # 基础 UI 组件库
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   └── lib/                      # 工具函数
│       ├── api.ts                # Tauri API 封装
│       └── utils.ts              # 通用工具
│
├── src-tauri/                    # Rust 网关层
│   ├── src/
│   │   ├── main.rs               # 应用入口 + 进程管理
│   │   ├── lib.rs                # 库入口（移动端支持）
│   │   ├── commands.rs           # Tauri Commands（HTTP 转发）
│   │   ├── state.rs              # AppState（端口 + HTTP Client）
│   │   ├── sidecar.rs            # Python 进程生命周期管理
│   │   ├── database.rs           # SQLite 操作（legacy）
│   │   ├── csv_parser.rs         # CSV 解析（legacy）
│   │   └── models.rs             # 数据模型
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
│
├── backend/                      # Python FastAPI Sidecar
│   ├── main.py                   # 入口（动态端口 + 握手协议）
│   ├── requirements.txt          # Python 依赖
│   ├── core/
│   │   ├── config.py             # 配置管理
│   │   └── lifespan.py           # 启动/关闭钩子
│   ├── routers/
│   │   ├── health.py             # /health 健康检查
│   │   ├── anime.py              # /api/anime/* 动漫操作
│   │   └── ai.py                 # /api/ai/* AI 推理
│   └── services/
│       ├── anime_service.py      # 动漫业务逻辑
│       └── ai_service.py         # AI 服务
│
├── scripts/
│   ├── dev.sh                    # 开发启动脚本
│   └── build_python.sh           # Python 打包脚本
│
├── public/
│   └── full_data.csv             # 动漫数据源
│
├── ARCHITECTURE.md               # 详细架构文档
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

### 存储位置

| 数据类型 | 路径 |
|----------|------|
| 用户操作日志 | `~/Library/Application Support/com.zcan.anime-filter/user_actions.csv` |
| 动漫数据源 | `public/full_data.csv` |

### CSV 日志格式

```csv
subject_id,status,timestamp
290709,interested,2025-12-31T17:17:16.027Z
27885,watched,2025-12-31T17:17:17.628Z
30055,skipped,2025-12-31T17:17:29.066Z
```

---

## 🔌 API 接口

### Python 后端 (FastAPI)

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/anime/list` | GET | 获取动漫列表 |
| `/api/anime/mark` | POST | 标记动漫状态 |
| `/api/anime/user-logs` | GET/POST | 用户操作日志 |
| `/api/ai/recommend` | POST | AI 推荐 |

### Rust 转发命令 (Tauri)

| 命令 | 描述 |
|------|------|
| `get_backend_port` | 获取 Python 后端端口 |
| `forward_health_check` | 转发健康检查 |
| `forward_get_anime_list` | 转发获取动漫列表 |
| `forward_mark_anime` | 转发标记动漫 |
| `forward_save_user_logs` | 转发保存用户日志 |
| `forward_get_recommendations` | 转发 AI 推荐 |

---

## 🔄 数据流

```
用户操作 (滑动/选择/标记)
         │
         ▼
┌─────────────────────────┐
│     AnimeGrid.tsx       │  处理 UI 事件，维护本地状态
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│       App.tsx           │  管理全局状态，乐观更新 UI
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     src/lib/api.ts      │  封装 Tauri invoke 调用
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Tauri IPC (invoke)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   commands.rs (Rust)    │  HTTP 转发到 Python
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Python FastAPI        │  业务逻辑处理
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   user_actions.csv      │  持久化存储
└─────────────────────────┘
```

---

## 🧪 开发调试

### 查看 Python 后端日志

```bash
# Python 后端会打印到 stderr
# 启动握手信号打印到 stdout: SERVER_PORT:12345
```

### 运行后端测试

项目包含基于 `pytest` 的后端测试套件。

```bash
cd backend
# 确保已安装测试依赖
pip install -r requirements.txt

# 运行测试
export PYTHONPATH=$PYTHONPATH:$(pwd) && python -m pytest tests -v
```

> **注意**: 目前的测试套件在并发运行时可能会遇到 `sqlite3` 文件锁定问题（详见架构文档）。


### 查看数据文件

```bash
# 查看用户操作日志
cat ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 实时监控
tail -f ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 按状态统计
grep "watched" ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv | wc -l
```

---

## 📋 更新日志

### v0.2.0 (2026-01-09)

- 🏗️ 架构重构：Rust 网关 + Python Sidecar
- 🐍 新增 FastAPI 后端，支持 AI 推理
- 📦 动态端口绑定 + 进程生命周期管理
- 🍎 Apple Silicon (MPS) 优化支持
- 📁 优化前端目录结构

### v0.1.0 (2026-01-01)

- ✅ 基础滑动卡片功能
- ✅ 多选批量操作
- ✅ 标签筛选系统
- ✅ 高级筛选面板
- ✅ 数据持久化到 CSV
- ✅ 撤销功能
- ✅ 视图模式切换
- ✅ 键盘快捷键支持

---

## 📄 许可证

MIT License

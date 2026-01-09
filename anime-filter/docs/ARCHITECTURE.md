# AnimePick 架构文档

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React 前端 (Vite)                              │
│                         localhost:1420                                   │
│                                                                          │
│  • AnimeGrid.tsx - 核心网格交互                                           │
│  • App.tsx - 状态管理                                                     │
│  • lib/api.ts - Tauri invoke 封装                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Tauri IPC (invoke)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Rust 网关层 (Tauri 2)                               │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │   main.rs       │  │   sidecar.rs    │  │   commands.rs   │          │
│  │   程序入口        │  │   进程管理        │  │   HTTP 转发      │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  职责: 窗口管理 | Python 生命周期 | 请求转发 (无业务逻辑)                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP (localhost:动态端口)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Python Sidecar (FastAPI)                              │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │   main.py       │  │   db/database   │  │   services/     │          │
│  │   入口 + 端口握手  │  │   SQLite + 缓存  │  │   业务逻辑       │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  职责: 所有业务逻辑 | 数据持久化 | AI 推理 (未来)                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │     animepick.db       │
                    │     (SQLite)           │
                    └────────────────────────┘
```

## 目录结构

```
anime-filter/
├── src/                          # React 前端
│   ├── App.tsx                   # 主应用 (状态管理)
│   ├── main.tsx                  # 入口
│   ├── index.css                 # 样式
│   ├── components/               # UI 组件
│   ├── hooks/                    # 自定义 Hooks
│   └── lib/
│       ├── api.ts                # Tauri API 封装
│       └── utils.ts
│
├── src-tauri/                    # Rust 网关层
│   ├── src/
│   │   ├── main.rs               # 入口 + 进程管理
│   │   ├── lib.rs                # 库入口 (移动端)
│   │   ├── commands.rs           # HTTP 转发命令 (无业务逻辑)
│   │   ├── state.rs              # AppState + HTTP Client
│   │   └── sidecar.rs            # Python 进程生命周期
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── backend/                      # Python 业务层
│   ├── main.py                   # FastAPI 入口
│   ├── requirements.txt
│   ├── core/
│   │   ├── config.py             # 配置
│   │   └── lifespan.py           # 启动/关闭
│   ├── db/
│   │   └── database.py           # SQLite + 内存缓存
│   ├── routers/
│   │   ├── health.py             # /health
│   │   ├── anime.py              # /api/anime/*
│   │   └── ai.py                 # /api/ai/*
│   └── services/
│       ├── anime_service.py      # 动漫业务逻辑
│       └── ai_service.py         # AI 服务 (占位)
│
├── scripts/
│   ├── dev.sh                    # 开发启动脚本
│   └── build_python.sh           # 打包脚本
│
└── public/
    └── full_data.csv             # 动漫数据源
```

## 数据流

### 写操作 (例: 标记动漫)

```
1. 用户右滑卡片
   ↓
2. AnimeGrid.tsx 触发 handleSwipe("watched")
   ↓
3. App.tsx.handleAction() 乐观更新 UI
   ↓
4. api.ts 调用 invoke("forward_save_user_logs", {...})
   ↓
5. commands.rs.forward_save_user_logs()
   ↓ HTTP POST /api/anime/user-logs
6. anime.py → anime_service.py → database.py
   ↓
7. SQLite 持久化 + 内存缓存更新
```

### 读操作 (例: 加载历史)

```
1. App.tsx useEffect 启动时
   ↓
2. api.ts 调用 invoke("forward_load_user_logs")
   ↓
3. commands.rs.forward_load_user_logs()
   ↓ HTTP GET /api/anime/user-logs
4. anime.py → anime_service.py → database.py
   ↓ (从内存缓存读取，极快)
5. 返回 JSON → App.tsx 更新状态
```

## 性能优化

### SQLite + 内存缓存策略

```python
# backend/db/database.py

class Database:
    # 内存缓存: subject_id -> {status, marked_at, ...}
    _status_cache: dict[int, dict] = {}

    def load_cache(self):
        """启动时一次性加载所有状态到内存"""
        # SELECT * FROM user_status → _status_cache

    def get_user_status(self, subject_id):
        """读操作: O(1) 从内存读取"""
        return self._status_cache.get(subject_id)

    def save_user_action(self, subject_id, status):
        """写操作: 同时更新 SQLite 和缓存"""
        # INSERT INTO SQLite
        # UPDATE _status_cache
```

**优势**:
- 读操作 O(1)，无磁盘 I/O
- 写操作同步更新缓存，无延迟
- SQLite WAL 模式，高并发写入

## 进程通信协议

### 握手协议

```
Rust                           Python
  |                               |
  |-- spawn python main.py ------>|
  |                               |
  |                               |-- bind port 0
  |                               |-- print "SERVER_PORT:12345"
  |<-- stdout: SERVER_PORT:12345 -|
  |                               |
  |-- GET /health --------------->|
  |<-- 200 OK --------------------|
  |                               |
  |   [通信就绪]                    |
```

### API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/anime/list` | GET | 获取动漫列表 (含筛选) |
| `/api/anime/mark` | POST | 标记单个动漫 |
| `/api/anime/batch-mark` | POST | 批量标记 |
| `/api/anime/user-logs` | GET | 获取所有操作日志 |
| `/api/anime/user-logs` | POST | 保存操作日志 |
| `/api/anime/user-logs/{id}` | DELETE | 删除操作 (撤销) |
| `/api/anime/stats` | GET | 获取统计 |
| `/api/ai/recommend` | POST | AI 推荐 (占位) |

## 测试策略

### 单元测试 (Python)

使用 `pytest` 对后端业务逻辑进行测试。

```bash
# 激活环境
source .venv/bin/activate

# 运行测试
export PYTHONPATH=$PYTHONPATH:$(pwd) && python -m pytest backend/tests -v
```

### 测试范围

*   **Database**: SQLite 单例模式、CRUD 操作、缓存一致性
*   **Migration**: CSV 到 SQLite 的数据迁移逻辑
*   **API Flow**: 端点请求响应、状态码验证

### 已知问题 (Known Issues)

*   **测试隔离性**: 由于 `database.py` 使用单例模式 (`Database` class)，在并发测试或连续测试中可能会出现 `sqlite3.OperationalError: unable to open database file` 错误。这是因为测试 fixture 尝试清理临时目录时，旧的单例实例可能仍持有文件句柄。
    *   *Workaround*: 暂时单独运行关键测试，或在未来的重构中改为依赖注入模式 (`get_db` dependancy injection) 以替代全局单例。

## 已删除的冗余代码

### Rust 端 (已删除)
- `database.rs` - SQLite 操作 → 移至 Python
- `csv_parser.rs` - CSV 解析 → 移至 Python
- `models.rs` - 数据模型 → 移至 Python

### Cargo.toml 依赖 (已删除)
- `rusqlite` - 不再需要
- `csv` - 不再需要
- `anyhow` - 简化错误处理
- `chrono` - Python 处理时间戳

## 开发指南

### 启动开发环境

```bash
# 方式 1: 使用脚本 (推荐)
./scripts/dev.sh

# 方式 2: 分开启动
# 终端 1 - Python
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py --dev

# 终端 2 - Tauri
npm run tauri dev
```

### 添加新功能

1. **Python 端**: 在 `services/` 添加业务逻辑，在 `routers/` 添加 API 端点
2. **Rust 端**: 在 `commands.rs` 添加转发命令 (仅 HTTP 转发，无逻辑)
3. **前端**: 在 `lib/api.ts` 添加 TypeScript 封装


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
│   │   ├── lifespan.py           # 启动/关闭 + 推荐引擎初始化
│   │   ├── logging.py            # 结构化日志
│   │   └── error_handlers.py     # 错误处理中间件
│   ├── db/
│   │   ├── database.py           # SQLite + 内存缓存 + 推荐数据
│   │   └── recommendation_schema.sql  # 推荐系统表结构
│   ├── routers/
│   │   ├── health.py             # /health
│   │   └── anime.py              # /api/anime/* + 推荐排序
│   └── services/
│       ├── anime_service.py      # 动漫业务逻辑
│       └── recommendation_service.py  # TF-IDF 推荐引擎
│
├── scripts/
│   ├── dev.sh                    # 开发启动脚本
│   ├── build_python.sh           # 打包脚本
│   ├── precompute_recommendation_features.py  # TF-IDF 预计算
│   └── test_recommendation_system.py  # 推荐系统测试
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
| `/api/anime/list` | GET | 获取动漫列表 (支持推荐排序) |
| `/api/anime/mark` | POST | 标记单个动漫 (自动追踪session) |
| `/api/anime/batch-mark` | POST | 批量标记 |
| `/api/anime/user-logs` | GET | 获取所有操作日志 |
| `/api/anime/user-logs` | POST | 保存操作日志 |
| `/api/anime/user-logs/{id}` | DELETE | 删除操作 (撤销) |
| `/api/anime/stats` | GET | 获取统计 |

#### 推荐排序 API

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

---

## 推荐系统架构

### 系统概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     推荐引擎启动流程                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────┐
        │   1. 应用启动 (lifespan.startup)       │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │   2. 初始化 RecommendationEngine       │
        │      - 连接数据库                      │
        │      - 加载 TF-IDF 词汇表              │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │   3. load_features_to_memory()        │
        │      - 加载 14,256 个特征向量          │
        │      - 存储到内存 (~1.4MB)             │
        │      - 构建稀疏向量索引                │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │   4. 引擎就绪，接受推荐请求             │
        └───────────────────────────────────────┘
```

### 推荐流程

```
用户请求推荐排序
        │
        ▼
┌───────────────────────────────────────┐
│  1. 获取/创建 Session                  │
│     - localStorage 中的 session_id    │
│     - 或自动生成新 session            │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  2. 应用滞后机制                       │
│     - history = [watched_1, ..., watched_n] │
│     - effective_history = history[:-lag_steps] │
│     - 第 k+1 次推荐基于前 k-lag 次选择  │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  3. 向量化批量计算                     │
│     ┌─────────────────────────────┐   │
│     │ 候选矩阵 (N x 1000)          │   │
│     │ 历史矩阵 (M x 1000)          │   │
│     │ 用户平均向量 (1 x 1000)      │   │
│     └─────────────────────────────┘   │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  4. 三组件融合算法                     │
│     ┌─────────────────────────────┐   │
│     │ 全局相似度 (40%)             │   │
│     │ - cosine_sim(candidate, avg) │   │
│     │ - 评分惩罚                   │   │
│     │ - 年份奖励                   │   │
│     ├─────────────────────────────┤   │
│     │ 局部最大相似 (40%)           │   │
│     │ - max(cosine_sim(candidate, history_i)) │
│     │ - 热度因子                   │   │
│     ├─────────────────────────────┤   │
│     │ 多样性奖励 (20%)             │   │
│     │ - 1 - avg(similarity)        │   │
│     └─────────────────────────────┘   │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  5. Temperature 调节                  │
│     - T = 2.0 (高温度增加多样性)       │
│     - Softmax(scores / T)             │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  6. 返回排序后的 ID 列表               │
│     - 耗时: ~30-40ms                  │
│     - 结果: [id1, id2, ..., id_n]     │
└───────────────────────────────────────┘
```

### 数据库表结构

#### anime_features (TF-IDF 特征)

```sql
CREATE TABLE anime_features (
    subject_id INTEGER PRIMARY KEY,
    tfidf_vector TEXT NOT NULL,        -- 稀疏向量 JSON: {indices: [], values: []}
    avg_score REAL DEFAULT 0.0,
    year INTEGER DEFAULT 0,
    popularity REAL DEFAULT 0.0,
    completion_rate REAL DEFAULT 0.0,
    raw_tags TEXT,
    feature_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### tfidf_vocabulary (词汇表)

```sql
CREATE TABLE tfidf_vocabulary (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT UNIQUE NOT NULL,
    idf_value REAL NOT NULL,
    document_frequency INTEGER DEFAULT 0,
    tag_category TEXT,                 -- 'genre', 'type', 'region', 'source'
    category_weight REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### user_recommendation_sessions (Session 管理)

```sql
CREATE TABLE user_recommendation_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    lag_steps INTEGER DEFAULT 1,
    window_size INTEGER DEFAULT 50,
    temperature REAL DEFAULT 2.0,
    config_version TEXT DEFAULT 'balanced'
);
```

#### user_session_actions (Session 行为历史)

```sql
CREATE TABLE user_session_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,         -- 'watched', 'interested', 'skipped'
    sequence_order INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_recommendation_sessions(session_id)
);
```

### 性能优化策略

#### 1. 预计算 TF-IDF 向量

```bash
# 离线预计算（首次运行）
python scripts/precompute_recommendation_features.py

输出:
✓ Loaded 14,256 anime
✓ TF-IDF matrix shape: (14256, 1000)
✓ Vocabulary size: 1000
✓ Saved 14,256 anime features
```

#### 2. 稀疏向量存储

```python
# 存储格式
{
  "indices": [12, 45, 78, 123, 456],      # 非零位置
  "values": [0.52, 0.31, 0.28, 0.19, 0.15]  # 对应权重
}

# 优势:
# - 平均每个动漫只存储 9.14 个非零值
# - 相比 dense vector 节省 99% 空间
# - 重建 dense vector 时间: O(nnz), nnz << 1000
```

#### 3. 向量化批量计算

```python
# 优化前（逐个计算）
for candidate in candidates:  # 14,251 次循环
    for history in history_items:  # 每次 14 次向量重建
        score = compute_similarity(candidate, history)
# 耗时: ~20秒

# 优化后（批量矩阵运算）
candidate_matrix = np.array([reconstruct(c) for c in candidates])  # (14251, 1000)
history_matrix = np.array([reconstruct(h) for h in history])       # (14, 1000)
similarity_matrix = cosine_similarity(candidate_matrix, history_matrix)  # (14251, 14)
# 耗时: ~30-40ms (300倍提升)
```

#### 4. 内存缓存策略

```python
# RecommendationEngine 内存布局
{
    '_feature_cache': {
        30055: {'avg_score': 8.5, 'year': 2010, 'popularity': 0.8, ...},
        85799: {...},
        ...  # 14,256 entries
    },
    '_feature_vectors': {
        30055: (indices_array, values_array),  # Sparse representation
        85799: (...),
        ...
    },
    '_vocabulary_size': 1000,
    '_active_sessions': {
        'uuid-1': RecommendationHistory(...),
        ...
    }
}

# 总内存占用: ~1.4MB
```

### 推荐算法详解

#### 全局相似度 (40% 权重)

```python
def _compute_global_similarity(candidate_id, history_ids):
    # 1. 构建用户平均向量
    user_avg_vector = mean([reconstruct(hid) for hid in history_ids])

    # 2. 计算余弦相似度
    cosine_sim = cosine_similarity(candidate_vector, user_avg_vector)

    # 3. 评分惩罚（prefer similar quality）
    score_penalty = max(0, 1 - abs(candidate_score - user_avg_score) / 3.0)

    # 4. 年份新鲜度奖励 (up to +20%)
    year_bonus = max(0, 1 - year_diff / 10.0) * 0.2

    return cosine_sim * score_penalty + year_bonus
```

#### 局部最大相似 (40% 权重)

```python
def _compute_local_max_similarity(candidate_id, history_ids):
    # 1. 计算与每个历史item的相似度
    similarities = [cosine_similarity(candidate, hist) for hist in history_ids]

    # 2. 取最大值（最相似的一个）
    max_similarity = max(similarities)

    # 3. 热度因子（prevent only obscure anime）
    popularity_normalized = min(1.0, popularity / 10000.0)

    return max_similarity * (0.8 + 0.2 * popularity_normalized)
```

#### 多样性奖励 (20% 权重)

```python
def _compute_diversity_bonus(candidate_id, history_ids):
    # 1. 计算平均相似度
    avg_similarity = mean([cosine_similarity(candidate, hist) for hist in history_ids])

    # 2. 反转为多样性分数（低相似度 = 高多样性）
    diversity_score = 1.0 - avg_similarity

    return clip(diversity_score, 0.0, 1.0)
```

#### Temperature 调节

```python
def _apply_temperature(scores, temperature=2.0):
    # Softmax with temperature
    exp_scores = exp(scores / temperature)
    probabilities = exp_scores / sum(exp_scores)

    # Convert back to scores (preserve relative order)
    adjusted_scores = probabilities * len(scores)

    return adjusted_scores
```

### 滞后响应机制

```python
class RecommendationHistory:
    def __init__(self, session_id, lag_steps=1, window_size=50):
        self.session_id = session_id
        self.lag_steps = lag_steps  # 滞后步数
        self.window_size = window_size  # 历史窗口大小
        self.session_history = []  # [watched_1, watched_2, ...]

    def get_recommendation_snapshot(self):
        """获取有效历史（应用滞后）"""
        # 排除最近 lag_steps 个选择
        if len(self.session_history) <= self.lag_steps:
            return []  # 历史不足

        effective_history = self.session_history[:-self.lag_steps]

        # 应用窗口大小限制
        if len(effective_history) > self.window_size:
            effective_history = effective_history[-self.window_size:]

        return [item['subject_id'] for item in effective_history]

# 示例:
# 用户观看: [A, B, C, D, E]
# lag_steps = 1
#
# 第1次推荐请求: [] (历史不足)
# 第2次推荐请求: [A] (排除 B)
# 第3次推荐请求: [A, B] (排除 C)
# 第4次推荐请求: [A, B, C] (排除 D)
# 第5次推荐请求: [A, B, C, D] (排除 E)
```

---

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


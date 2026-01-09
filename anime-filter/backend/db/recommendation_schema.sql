-- AnimePick 推荐系统数据库Schema
-- 创建时间: 2026-01-09

-- ============================================================
-- 1. 动漫特征向量表
-- ============================================================
CREATE TABLE IF NOT EXISTS anime_features (
    subject_id INTEGER PRIMARY KEY,

    -- TF-IDF稀疏向量（JSON格式）
    -- 格式: {"indices": [12, 45, 78], "values": [0.5, 0.3, 0.2]}
    tfidf_vector TEXT NOT NULL,

    -- 元数据特征
    avg_score REAL DEFAULT 0.0,
    year INTEGER DEFAULT 0,
    popularity REAL DEFAULT 0.0,  -- 收藏数 / (看过数 + 1)
    completion_rate REAL DEFAULT 0.0,  -- 完成率

    -- 原始tags（用于调试和展示）
    raw_tags TEXT,

    -- 版本控制
    feature_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 性能索引
CREATE INDEX IF NOT EXISTS idx_anime_features_score ON anime_features(avg_score);
CREATE INDEX IF NOT EXISTS idx_anime_features_year ON anime_features(year);
CREATE INDEX IF NOT EXISTS idx_anime_features_popularity ON anime_features(popularity);


-- ============================================================
-- 2. TF-IDF词汇表
-- ============================================================
CREATE TABLE IF NOT EXISTS tfidf_vocabulary (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT UNIQUE NOT NULL,
    idf_value REAL NOT NULL,  -- IDF权重
    document_frequency INTEGER DEFAULT 0,  -- 出现在多少部动漫中
    tag_category TEXT,  -- 'genre', 'type', 'region', 'source', 'studio', 'stopword'
    category_weight REAL DEFAULT 1.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tfidf_vocab_name ON tfidf_vocabulary(tag_name);
CREATE INDEX IF NOT EXISTS idx_tfidf_vocab_category ON tfidf_vocabulary(tag_category);


-- ============================================================
-- 3. 用户推荐Session管理
-- ============================================================
CREATE TABLE IF NOT EXISTS user_recommendation_sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER DEFAULT 1,  -- 单用户应用，默认为1
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,

    -- 配置参数（可选，支持A/B测试）
    lag_steps INTEGER DEFAULT 1,
    window_size INTEGER DEFAULT 50,
    temperature REAL DEFAULT 2.0,
    config_version TEXT DEFAULT 'balanced'
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rec_sessions_active ON user_recommendation_sessions(is_active, last_activity);


-- ============================================================
-- 4. Session操作历史
-- ============================================================
CREATE TABLE IF NOT EXISTS user_session_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,  -- 'watched', 'interested', 'skipped'
    sequence_order INTEGER NOT NULL,  -- 第几次操作（从1开始）
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES user_recommendation_sessions(session_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_session_actions_sid ON user_session_actions(session_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_session_actions_timestamp ON user_session_actions(session_id, timestamp);


-- ============================================================
-- 5. 推荐配置表（支持A/B测试）
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_configs (
    config_name TEXT PRIMARY KEY,
    global_weight REAL DEFAULT 0.4,
    local_weight REAL DEFAULT 0.4,
    diversity_weight REAL DEFAULT 0.2,
    temperature REAL DEFAULT 2.0,
    lag_steps INTEGER DEFAULT 1,
    window_size INTEGER DEFAULT 50,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- 插入默认配置
INSERT OR IGNORE INTO recommendation_configs (config_name, global_weight, local_weight, diversity_weight, temperature, description, is_active)
VALUES
    ('balanced', 0.4, 0.4, 0.2, 2.0, '平衡版：准确性和多样性平衡', 1),
    ('conservative', 0.5, 0.5, 0.0, 1.0, '保守版：高准确性，低多样性', 0),
    ('exploratory', 0.3, 0.3, 0.4, 2.5, '探索版：高多样性，鼓励发现', 0),
    ('local_focus', 0.2, 0.6, 0.2, 1.8, '局部优先版：强化细粒度匹配', 0);


-- ============================================================
-- 6. 推荐性能指标（可选，用于监控）
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_metrics (
    metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    page_number INTEGER,
    computation_time_ms REAL,  -- 推荐计算耗时（毫秒）
    candidate_count INTEGER,   -- 候选动漫数
    history_count INTEGER,     -- 用户历史数
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES user_recommendation_sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rec_metrics_session ON recommendation_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rec_metrics_time ON recommendation_metrics(timestamp);

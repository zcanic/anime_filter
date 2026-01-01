# AnimePick - 动漫筛选应用

一款基于 **Tauri + React + TypeScript** 构建的桌面动漫筛选应用。通过直观的滑动手势和丰富的筛选功能，帮助用户高效地管理和标记自己的动漫观看记录。

## 📋 目录

- [功能概述](#功能概述)
- [技术架构](#技术架构)
- [安装与运行](#安装与运行)
- [数据存储](#数据存储)
- [界面组件详解](#界面组件详解)
- [交互操作指南](#交互操作指南)
- [键盘快捷键](#键盘快捷键)
- [API 接口](#api-接口)
- [数据流架构](#数据流架构)
- [测试指南](#测试指南)
- [项目结构](#项目结构)

---

## 功能概述

### 核心功能

| 功能 | 描述 |
|------|------|
| **卡片滑动** | 左滑跳过，右滑标记为已看 |
| **多选模式** | 点击卡片进行多选，批量确认 |
| **标签筛选** | 按标签筛选动漫（如"日本"、"搞笑"等） |
| **高级筛选** | 按评分、年份、观看状态进行筛选 |
| **数据持久化** | 所有操作自动保存到本地 CSV 文件 |
| **撤销功能** | 支持撤销最近的操作 |
| **视图切换** | 在"全部"和"已看"视图间切换 |
| **布局调整** | 支持小/中/大三种卡片布局 |

### 用户状态类型

- **Watched（已看）**: 用户已观看的动漫
- **Interested（想看）**: 用户感兴趣，想要观看的动漫
- **Skipped（跳过）**: 用户不感兴趣，已跳过的动漫

---

## 技术架构

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1.0 | UI 框架 |
| TypeScript | 5.8.3 | 类型安全 |
| Vite | 7.0.4 | 构建工具 |
| TailwindCSS | 4.1.18 | 样式框架 |
| Framer Motion | 12.23.26 | 动画库 |
| Lucide React | 0.562.0 | 图标库 |
| PapaParse | 5.5.3 | CSV 解析 |

### 后端技术栈

| 技术 | 用途 |
|------|------|
| Tauri 2 | 桌面应用框架 |
| Rust | 后端逻辑处理 |
| SQLite | 本地数据库存储 |
| CSV | 用户操作日志存储 |

---

## 安装与运行

### 前置条件

- Node.js 18+
- Rust (最新稳定版)
- pnpm / npm / yarn

### 安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd anime-filter

# 2. 安装依赖
npm install

# 3. 开发模式运行（仅前端）
npm run dev

# 4. 运行 Tauri 桌面应用
npm run tauri dev

# 5. 构建生产版本
npm run tauri build
```

### 开发模式访问地址

- **前端开发服务器**: http://localhost:5173
- **Tauri 应用**: http://localhost:1420

---

## 数据存储

### 存储位置

| 数据类型 | 存储路径 |
|----------|----------|
| SQLite 数据库 | `~/Library/Application Support/com.zcan.anime-filter/anime_filter.db` |
| 用户操作日志 | `~/Library/Application Support/com.zcan.anime-filter/user_actions.csv` |
| 动漫数据源 | `/public/full_data.csv` |

### CSV 日志格式

```csv
subject_id,status,timestamp
290709,interested,2025-12-31T17:17:16.027Z
27885,watched,2025-12-31T17:17:17.628Z
30055,skipped,2025-12-31T17:17:29.066Z
```

### 字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `subject_id` | number | 动漫的唯一标识符 |
| `status` | string | 状态：`watched` / `interested` / `skipped` |
| `timestamp` | string | ISO 8601 格式的时间戳 |

---

## 界面组件详解

### 1. Navbar（导航栏）

**文件位置**: `src/interface-template/components/navbar.tsx`

#### 功能特性

| 功能 | 描述 | 位置 |
|------|------|------|
| **品牌标识** | 显示 "AnimePick" 标识 | 左侧 |
| **搜索框** | 支持文字搜索和标签语法 `$tag$` | 中部 |
| **视图切换** | All / Watched 两种视图模式 | 中部 |
| **布局切换** | Small / Medium / Large 三种布局 | 中部 |
| **筛选按钮** | 打开高级筛选面板 | 右侧 |
| **状态信息** | 显示页码、选中数量、进度 | 右侧 |

#### 搜索功能详解

- **普通搜索**: 直接输入文字，匹配动漫标题（英文/日文）
- **标签搜索**: 使用 `$标签名$` 语法，按 Enter 添加为筛选标签
  - 示例: 输入 `$日常$` 后按 Enter，添加"日常"标签

#### 状态信息格式

```
Page X | N selected | X / Y reviewed
```
- X = 当前页码
- N = 当前选中的卡片数量
- X / Y = 已标注数量 / 符合筛选条件的总数量

---

### 2. AnimeCard（动漫卡片）

**文件位置**: `src/interface-template/components/anime-card.tsx`

#### 卡片结构

```
┌─────────────────────┐
│ ✓ (选中标记)    (i) │  ← 信息按钮
│                     │
│    [封面图片]        │
│                     │
│  [年份]             │  ← 底部左侧
├─────────────────────┤
│ 标题                │
│ 日文标题      ★ 8.5 │  ← 评分
└─────────────────────┘
```

#### 交互方式

| 操作 | 触发方式 | 效果 |
|------|----------|------|
| **选中/取消选中** | 点击卡片 | 切换选中状态（显示/隐藏勾选标记） |
| **左滑跳过** | 向左拖动超过 100px | 标记为 Skipped，替换为新卡片 |
| **右滑标记** | 向右拖动超过 100px | 标记为 Watched，替换为新卡片 |
| **查看详情** | 点击 (i) 按钮 | 打开详情弹窗 |

#### 视觉反馈

- **拖动时**: 卡片随手指移动，微微旋转，透明度变化
- **左滑时**: 左侧显示红色箭头指示器
- **右滑时**: 右侧显示绿色箭头指示器
- **选中时**: 卡片边框变为主色调，显示勾选标记

#### 技术细节

- 滑动阈值: **100px**
- 动画配置: Spring 弹性动画（stiffness: 500, damping: 40）
- 防误触: 拖动状态下不触发点击事件

---

### 3. AnimeGrid（动漫网格）

**文件位置**: `src/interface-template/components/anime-grid.tsx`

#### 核心功能

1. **网格布局管理**
   - 每页显示 10 张卡片
   - 自动补充：当卡片被移除后，自动从候选池补充新卡片
   - 智能筛选：检查候选卡片是否符合当前筛选条件

2. **状态管理**
   ```typescript
   // 本地状态
   selectedIds: number[]       // 当前选中的卡片ID
   localSkipped: number[]      // 本地临时跳过的ID（用于即时UI更新）
   gridPositions: number[]     // 当前网格中的卡片ID顺序
   history: HistoryEntry[]     // 操作历史（用于撤销）
   ```

3. **筛选逻辑**
   - 搜索匹配：标题（英文/日文）
   - 标签匹配：所有选中标签必须全部匹配
   - 评分筛选：大于等于最低评分
   - 年份筛选：在指定年份范围内
   - 观看状态：全部/已看/未看/想看

#### 布局配置

| 模式 | 桌面端列数 | 平板列数 | 手机列数 |
|------|-----------|---------|---------|
| Small | 6 | 5 | 3-4 |
| Medium | 5 | 4 | 2-3 |
| Large | 4 | 3 | 2 |

---

### 4. InfoModal（详情弹窗）

**文件位置**: `src/interface-template/components/info-modal.tsx`

#### 显示内容

| 区域 | 内容 |
|------|------|
| 头部 | 大尺寸封面图片 + 渐变遮罩 |
| 标题区 | 英文标题 + 日文标题 |
| 数据区 | ★ 评分 | 集数 | 年份 |
| 标签区 | 所有标签列表 |
| 简介区 | 动漫简介（如有） |
| 操作区 | "Add to Want to Watch" 按钮 |

#### 交互操作

| 操作 | 触发方式 |
|------|----------|
| 关闭弹窗 | 点击 X 按钮 / 点击背景遮罩 / 按 ESC 键 |
| 标记想看 | 点击 "Add to Want to Watch" 按钮 |

---

### 5. FilterPanel（筛选面板）

**文件位置**: `src/interface-template/components/filter-panel.tsx`

#### 筛选选项

| 筛选项 | 类型 | 描述 |
|--------|------|------|
| **Minimum Rating** | 滑动条 | 0-10，步长 0.5 |
| **Year Range** | 数字输入 | 起始年份 - 结束年份 |
| **Tags** | 标签输入 | 添加/删除多个标签 |
| **Watch Status** | 按钮组 | All / Watched / Unwatched / Interested |

#### 面板动画

- 从右侧滑入
- 半透明背景遮罩 + 模糊效果
- Spring 弹性动画（damping: 30, stiffness: 300）

---

### 6. KeyboardGuide（快捷键提示）

**文件位置**: `src/interface-template/components/keyboard-guide.tsx`

**位置**: 屏幕右下角固定显示

---

## 交互操作指南

### 基本工作流程

```
1. 应用加载
   └── 从 CSV 加载动漫数据
   └── 从 user_actions.csv 加载用户历史记录
   └── 初始化网格显示 10 张卡片

2. 浏览与筛选
   ├── 使用导航栏搜索/筛选
   └── 调整布局大小

3. 标记动漫
   ├── 方式 A: 滑动单张卡片
   │   ├── 左滑 → Skipped
   │   └── 右滑 → Watched
   │
   └── 方式 B: 批量选择
       ├── 点击多张卡片选中
       ├── 点击 "Confirm & Next"
       │   └── 选中 → Watched, 未选中 → Skipped
       └── 点击 "Skip Page"
           └── 当前页全部 → Skipped

4. 查看详情 & 标记想看
   ├── 点击卡片上的 (i) 按钮
   ├── 查看动漫详细信息
   └── 点击 "Add to Want to Watch" → Interested

5. 撤销操作
   └── 按 R 键或点击撤销按钮
       └── 恢复上一张卡片到网格
       └── 从 CSV 中删除对应记录

6. 查看已标记
   └── 切换到 "Watched" 视图
       └── 仅显示已标记为 Watched 的动漫
```

### 滑动交互详解

#### 左滑（跳过）

```
[卡片] ←←←← (拖动超过 100px)
   ↓
卡片飞出屏幕左侧
   ↓
记录到 skipped 状态
   ↓
保存到 CSV 文件
   ↓
新卡片滑入填补位置
```

#### 右滑（标记已看）

```
[卡片] →→→→ (拖动超过 100px)
   ↓
卡片飞出屏幕右侧
   ↓
记录到 watched 状态
   ↓
保存到 CSV 文件
   ↓
新卡片滑入填补位置
```

### 批量操作详解

#### Confirm & Next

```
当前网格: [A, B, C, D, E, F, G, H, I, J]
选中状态: [✓, ✗, ✓, ✗, ✓, ✗, ✗, ✗, ✗, ✗]
          ↓ 点击 "Confirm & Next"
Watched:  [A, C, E]    ← 保存到 CSV
Skipped:  [B, D, F, G, H, I, J]  ← 保存到 CSV
          ↓
加载新的 10 张卡片
```

#### Skip Page

```
当前网格: [A, B, C, D, E, F, G, H, I, J]
          ↓ 点击 "Skip Page"
Skipped:  [A, B, C, D, E, F, G, H, I, J]  ← 全部保存到 CSV
          ↓
加载新的 10 张卡片
```

---

## 键盘快捷键

| 快捷键 | 功能 | 描述 |
|--------|------|------|
| **Q** | Skip Page | 跳过当前页面所有卡片 |
| **E** | Confirm & Next | 确认当前选择并进入下一页 |
| **R** | Undo / Previous | 撤销上一步操作或返回上一页 |
| **ESC** | Close | 关闭弹窗或筛选面板 |

### 快捷键作用域

- 当焦点在输入框或文本框时，快捷键**不生效**
- 快捷键在任何视图模式下都可用

---

## API 接口

### 前端 API 函数

**文件位置**: `src/lib/api.ts`

#### saveUserLogs

```typescript
async function saveUserLogs(actions: SimpleUserAction[]): Promise<void>
```

**功能**: 批量保存用户操作到 CSV 文件

**参数**:
```typescript
interface SimpleUserAction {
  subject_id: number;    // 动漫ID
  status: string;        // "watched" | "interested" | "skipped"
  timestamp: string;     // ISO 8601 时间戳
}
```

#### loadUserLogs

```typescript
async function loadUserLogs(): Promise<UserAnimeData[]>
```

**功能**: 加载所有用户历史操作记录

**返回值**:
```typescript
interface UserAnimeData {
  subject_id: number;
  status: string;
  rating?: number;
  tags?: string;
  marked_at: string;
}
```

#### deleteUserLog

```typescript
async function deleteUserLog(subject_id: number): Promise<void>
```

**功能**: 删除指定动漫的操作记录（用于撤销）

---

### 后端 Tauri 命令

**文件位置**: `src-tauri/src/commands.rs`

| 命令 | 功能 | 参数 |
|------|------|------|
| `save_user_log_csv` | 追加用户操作到 CSV | `actions: Vec<SimpleUserAction>` |
| `load_user_log_csv` | 读取所有 CSV 记录 | 无 |
| `delete_user_log` | 删除指定 ID 的记录 | `subject_id: i64` |
| `get_all_anime` | 获取所有动漫数据 | 无 |
| `mark_anime` | 标记单个动漫状态 | `subject_id, status, rating` |
| `batch_mark_anime` | 批量标记动漫 | `subject_ids, status` |
| `get_user_status` | 获取单个动漫状态 | `subject_id` |
| `get_all_user_status` | 获取所有用户状态 | 无 |
| `get_stats` | 获取统计数据 | 无 |

---

## 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                         用户操作                              │
│  (选择, 滑动, 标记想看, 撤销)                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AnimeGrid.tsx                           │
│  • 处理 UI 事件                                               │
│  • 维护本地状态 (localSkipped, selectedIds)                   │
│  • 调用父组件回调                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  • 管理全局状态 (watchedIds, interestedIds, skippedIds)       │
│  • 乐观更新 UI (立即 setState)                                │
│  • 调用 API 函数持久化到后端                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     src/lib/api.ts                           │
│  • TypeScript 封装 Tauri invoke                              │
│  • 错误处理和日志记录                                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tauri IPC (invoke)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                src-tauri/src/commands.rs                     │
│  • save_user_log_csv() - 追加到 CSV                          │
│  • load_user_log_csv() - 读取所有记录                         │
│  • delete_user_log() - 删除特定记录                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               user_actions.csv (文件系统)                     │
│  ~/Library/Application Support/com.zcan.anime-filter/        │
│  格式: subject_id, status, timestamp                         │
└─────────────────────────────────────────────────────────────┘
```

### 状态同步机制

1. **乐观更新**: UI 立即响应用户操作
2. **异步持久化**: 后台保存到 CSV
3. **启动时恢复**: 应用启动时从 CSV 加载历史状态

---

## 测试指南

### 功能测试用例

#### TC01: 标签筛选与网格交互

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 启动应用 | 网格加载 10 张卡片，默认标签为"日本" |
| 2 | 添加"搞笑"标签 | 网格刷新，只显示同时包含"日本"和"搞笑"标签的动漫 |
| 3 | 移除"搞笑"标签 | 网格恢复，显示所有"日本"标签动漫 |

#### TC02: 滑动操作与持久化

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 左滑一张卡片 | 卡片飞出，新卡片填入，已审阅计数 +1 |
| 2 | 右滑一张卡片 | 卡片飞出，新卡片填入，已审阅计数 +1 |
| 3 | 重新加载页面 | 计数保持不变，被滑动的卡片不再出现 |

#### TC03: 撤销功能

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 右滑一张卡片标记为已看 | 卡片移除，状态更新 |
| 2 | 点击撤销按钮或按 R | 卡片恢复到原位置，CSV 中记录被删除 |
| 3 | 可以重新与该卡片交互 | 卡片可滑动或选择 |

#### TC04: 视图模式

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 切换到 "Watched" 视图 | 只显示已标记为 Watched 的动漫 |
| 2 | 尝试滑动卡片 | 卡片不可滑动（静态展示） |

#### TC05: 多选操作

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 点击 3 张卡片选中 | 卡片显示勾选标记，底部按钮显示 (3) |
| 2 | 点击 "Confirm & Next" | 选中的 3 张 → Watched，其余 7 张 → Skipped，加载新页面 |

### 手动验证命令

```bash
# 查看 CSV 文件位置
ls -la ~/Library/Application\ Support/com.zcan.anime-filter/

# 查看 CSV 内容
cat ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 统计记录数
wc -l ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 实时监控 CSV 变化
tail -f ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 按状态统计
grep "watched" ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv | wc -l
grep "interested" ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv | wc -l
grep "skipped" ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv | wc -l

# 备份 CSV
cp ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv ~/Desktop/backup.csv

# 清空数据测试（谨慎使用）
# rm ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv
```

---

## 项目结构

```
anime-filter/
├── src/                          # 前端源码
│   ├── App.tsx                   # 主应用组件
│   ├── main.tsx                  # 入口文件
│   ├── index.css                 # 全局样式
│   ├── lib/
│   │   ├── api.ts               # Tauri API 封装
│   │   └── utils.ts             # 工具函数
│   └── interface-template/
│       └── components/
│           ├── anime-card.tsx    # 动漫卡片组件
│           ├── anime-grid.tsx    # 动漫网格组件
│           ├── navbar.tsx        # 导航栏组件
│           ├── filter-panel.tsx  # 筛选面板组件
│           ├── info-modal.tsx    # 详情弹窗组件
│           ├── keyboard-guide.tsx # 快捷键提示组件
│           └── ui/               # UI 基础组件库
│
├── src-tauri/                    # Tauri 后端
│   ├── src/
│   │   ├── lib.rs               # Tauri 入口
│   │   ├── commands.rs          # Tauri 命令定义
│   │   ├── database.rs          # 数据库操作
│   │   ├── csv_parser.rs        # CSV 解析
│   │   └── models.rs            # 数据模型
│   ├── Cargo.toml               # Rust 依赖配置
│   └── tauri.conf.json          # Tauri 配置
│
├── public/
│   └── full_data.csv            # 动漫数据源
│
├── package.json                 # Node 依赖配置
├── vite.config.ts              # Vite 配置
├── tailwind.config.cjs         # Tailwind 配置
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 本文档
```

---

## 已知问题与注意事项

### 数据处理

1. **重复条目**: 同一动漫可能有多条记录（如先标记 interested 再标记 watched），以最新状态为准
2. **大数据量**: 当 CSV 超过 1000+ 条时，建议关注加载性能

### 兼容性

- 仅在 macOS 上完整测试
- Windows/Linux 数据存储路径会有所不同

### 已解决的问题

- ✅ 撤销后数据正确从 CSV 删除
- ✅ 网格自动补充逻辑
- ✅ 筛选条件变化时网格正确刷新

---

## 更新日志

### v0.1.0 (2026-01-01)

- ✅ 基础滑动卡片功能
- ✅ 多选批量操作
- ✅ 标签筛选系统
- ✅ 高级筛选面板
- ✅ 数据持久化到 CSV
- ✅ 撤销功能
- ✅ 视图模式切换
- ✅ 键盘快捷键支持
- ✅ 进度显示（已审阅/总数）

---

## 许可证

MIT License

# AnimePick 综合测试用例

本文档包含黑盒测试和白盒测试相结合的测试用例，专注于发现卡片交互、批量交互、搜索筛选、模式转换等功能中的 Bug 和不合理设计。

---

## 📋 测试目录

1. [卡片滑动交互测试](#1-卡片滑动交互测试)
2. [批量操作测试](#2-批量操作测试)  
3. [撤销功能测试](#3-撤销功能测试)
4. [搜索与筛选测试](#4-搜索与筛选测试)
5. [视图模式切换测试](#5-视图模式切换测试)
6. [数据持久化测试](#6-数据持久化测试)
7. [状态冲突测试](#7-状态冲突测试)
8. [并发与竞态条件测试](#8-并发与竞态条件测试)
9. [边界条件测试](#9-边界条件测试)
10. [键盘交互测试](#10-键盘交互测试)

---

## 1. 卡片滑动交互测试

### 🔴 TC1.1 快速连续滑动（竞态条件）

**类型**: 白盒测试 - 基于代码分析发现的潜在问题

**代码分析**:
```typescript
// anime-card.tsx:128-131
setTimeout(() => {
  onSwipeLeft(anime.id)
  x.set(0)
}, 150)
```
滑动动画有 150ms 延迟，如果用户在此期间再次操作，可能导致问题。

**测试步骤**:
1. 快速滑动卡片 A 向左（在 150ms 内）
2. 立即尝试滑动相邻的卡片 B

**预期结果**: 两次操作都应该正确执行，不应有卡片状态混乱

**潜在 Bug**: 
- 卡片 A 的操作可能未完成就被覆盖
- 同一张卡片可能被标记两次

---

### 🔴 TC1.2 滑动过程中点击信息按钮

**类型**: 黑盒测试 - 用户误操作场景

**测试步骤**:
1. 开始拖动卡片（不超过阈值）
2. 在拖动过程中，快速点击卡片右上角的 (i) 信息按钮
3. 释放卡片

**预期结果**: 
- 卡片应返回原位（未超过阈值）
- 信息弹窗是否弹出？

**代码分析**:
```typescript
// anime-card.tsx:162-168
const handleInfoClick = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation()  // 阻止事件冒泡
    onShowInfo(anime)
  },
  [onShowInfo, anime],
)
```

**潜在问题**: `stopPropagation` 只阻止点击冒泡，但拖动事件仍在进行中

---

### 🔴 TC1.3 滑动到边界后反向拖动

**类型**: 黑盒测试 - 边缘交互

**测试步骤**:
1. 将卡片向左拖动超过 100px（触发阈值）
2. 在释放之前，快速反向拖动到右侧超过 100px
3. 释放卡片

**预期结果**: 卡片应该按照**释放时的位置**决定操作（标记为 watched）

**代码验证点**:
```typescript
// anime-card.tsx:124-142
// handleDragEnd 使用 info.offset.x 来判断，这是最终偏移位置
```

---

### 🔴 TC1.4 在 Watched 视图中尝试滑动

**类型**: 白盒测试 - 基于 `interactive` 属性

**代码分析**:
```typescript
// anime-grid.tsx:431
interactive={viewMode === "all"}

// anime-card.tsx:196
drag={interactive ? "x" : false}
```

**测试步骤**:
1. 标记几张卡片为 Watched
2. 切换到 "Watched" 视图
3. 尝试滑动已标记的卡片

**预期结果**: 卡片不应响应滑动手势

**潜在问题**: 如果卡片仍然可以滑动，会导致状态混乱

---

### 🔴 TC1.5 滑动到恰好 100px 临界值

**类型**: 边界值测试

**代码分析**:
```typescript
// anime-card.tsx:71
const SWIPE_THRESHOLD = 100

// anime-card.tsx:125, 132
if (info.offset.x < -SWIPE_THRESHOLD)  // -100 不触发
else if (info.offset.x > SWIPE_THRESHOLD)  // 100 不触发
```

**测试步骤**:
1. 精确拖动卡片到 -100px 位置并释放
2. 精确拖动卡片到 +100px 位置并释放
3. 拖动到 -101px 并释放
4. 拖动到 +101px 并释放

**预期结果**:
- ±100px: 卡片应返回原位（未触发操作）
- ±101px: 卡片应触发对应操作

**注意**: 条件是 `< -100` 和 `> 100`，不是 `<=` 和 `>=`

---

### 🔴 TC1.6 没有替换候选时滑动

**类型**: 白盒测试 - 边界条件

**代码分析**:
```typescript
// anime-grid.tsx:257-274
if (availableAnime.length > 0) {
  // 只有有可用动漫时才替换
  const newAnime = availableAnime[0]
  // ...
}
// 没有 else 分支！如果没有可用动漫，什么都不做
```

**测试步骤**:
1. 设置筛选条件使得只剩 10 张卡片符合条件
2. 滑动掉其中一张卡片

**预期结果**: 
- 卡片应该被标记为 skipped/watched
- 网格位置应该如何处理？变成 9 张？还是保持空位？

**状态**: ✅ 已修复 (Fixed)
**修复方案**: 当没有可用动漫时，使用 ID -1 作为占位符，使卡片位置显示为空。

---

## 2. 批量操作测试

### 🔴 TC2.1 Confirm 时 selectedIds 包含不在网格中的 ID

**类型**: 白盒测试 - 状态不一致

**代码分析**:
```typescript
// anime-grid.tsx:340-346
const handleConfirm = () => {
  const unselected = gridPositions.filter(id => !selectedIds.includes(id));
  if (unselected.length > 0 && onIgnore) {
    onIgnore(unselected);
  }
  onSubmit(selectedIds);  // selectedIds 可能包含已不在网格中的 ID
}
```

**测试步骤**:
1. 选中卡片 A、B、C
2. 滑动卡片 A 向左跳过（A 应该从 selectedIds 移除）
3. 不选新补充的卡片
4. 点击 "Confirm & Next"

**预期结果**: 
- A: 应该只记录一次 skipped（滑动时）
- B、C: 标记为 watched
- 剩余未选中的卡片: 标记为 skipped

**代码验证**:
```typescript
// anime-grid.tsx:295
setSelectedIds((prev) => prev.filter((i) => i !== id))
// 滑动时会从 selectedIds 移除 ✓
```

---

### 🔴 TC2.2 Skip Page 后立即 Confirm

**类型**: 竞态条件测试

**测试步骤**:
1. 点击 "Skip Page"
2. 页面跳转过程中（动画期间），快速按 E 键触发 Confirm

**预期结果**: 两个操作不应该同时生效

**代码分析**:
```typescript
// anime-grid.tsx:348-353
const handleSkipPage = () => {
  if (onIgnore) {
    onIgnore(gridPositions);  // 标记全部为 skipped
  }
  onSkip();  // 翻页
}
```

**潜在 Bug**: 如果 Confirm 在 Skip 完成前执行，可能导致同一批卡片被双重标记

---

### 🔴 TC2.3 不选择任何卡片直接 Confirm

**类型**: 黑盒测试 - 空输入

**测试步骤**:
1. 确保没有选中任何卡片（selectedIds = []）
2. 点击 "Confirm & Next"

**代码分析**:
```typescript
// anime-grid.tsx:340-346
const handleConfirm = () => {
  const unselected = gridPositions.filter(id => !selectedIds.includes(id));
  // unselected = gridPositions（全部）
  if (unselected.length > 0 && onIgnore) {
    onIgnore(unselected);  // 全部标记为 skipped
  }
  onSubmit(selectedIds);  // 传入空数组
}

// App.tsx:140-143
onSubmit={(selectedIds) => {
  handleAction(selectedIds, "watched");  // 空数组
  setPage(p => p + 1);
})
```

**预期结果**: 
- 效果应该等同于 "Skip Page"
- 全部卡片标记为 skipped
- 页面跳转

**实际行为**: 功能正确，但这是否符合 UX 预期？用户可能误操作

---

### 🔴 TC2.4 全选后 Confirm

**类型**: 边界值测试

**测试步骤**:
1. 点击所有 10 张卡片全部选中
2. 点击 "Confirm & Next"

**代码分析**:
```typescript
const unselected = gridPositions.filter(id => !selectedIds.includes(id));
// unselected = [] 空数组
if (unselected.length > 0 && onIgnore) {
  // 不执行！没有卡片被标记为 skipped
}
onSubmit(selectedIds);  // 全部标记为 watched
```

**预期结果**: 
- 全部 10 张标记为 watched
- 没有 skipped 记录

---

### 🔴 TC2.5 页面切换时 selectedIds 清空验证

**类型**: 白盒测试 - 状态重置

**代码分析**:
```typescript
// anime-grid.tsx:84-86
useEffect(() => {
  setSelectedIds([])
}, [page])
```

**测试步骤**:
1. 选中 3 张卡片
2. 点击 "Skip Page"（不点 Confirm）
3. 检查新页面的选中状态

**预期结果**: 新页面的 selectedIds 应该为空

**潜在问题**: 如果切换页面前选中的卡片已被处理（滑动掉），它们的选中状态是否正确清除？

---

## 3. 撤销功能测试

### 🔴 TC3.1 连续多次撤销

**类型**: 白盒测试 - 历史栈管理

**代码分析**:
```typescript
// anime-grid.tsx:115
const [history, setHistory] = useState<HistoryEntry[]>([])

// anime-grid.tsx:337
setHistory((prev) => prev.slice(0, -1))  // 移除最后一项
```

**测试步骤**:
1. 滑动 3 张卡片（A、B、C）
2. 按 R 撤销 → C 应该回来
3. 按 R 撤销 → B 应该回来
4. 按 R 撤销 → A 应该回来
5. 再次按 R 撤销

**预期结果**: 
- 第四次撤销应该触发返回上一页（如果 page > 1）
- 如果 page = 1，应该无操作

**代码验证**:
```typescript
// anime-grid.tsx:312-318
if (history.length === 0) {
  if (onPrevious && page > 1) {
    onPrevious()
  }
  return
}
```

---

### 🔴 TC3.2 撤销后被撤销的卡片位置恢复

**类型**: 白盒测试 - 位置恢复逻辑

**代码分析**:
```typescript
// anime-grid.tsx:322-327
setGridPositions((prev) => {
  const newPositions = [...prev]
  newPositions[lastAction.position!] = lastAction.previousAnimeId!
  return newPositions
})
```

**测试步骤**:
1. 滑动位置 5 的卡片 A（被 B 替换）
2. 滑动位置 3 的卡片 C（被 D 替换）
3. 撤销一次

**预期结果**: 
- C 应该回到位置 3
- B 仍然应该在位置 5
- D 应该消失

**潜在 Bug**: 撤销恢复的是 `previousAnimeId`，但替换上来的卡片（D）去哪了？会被直接替换掉，但如果 D 已经被选中呢？

---

### 🔴 TC3.3 撤销右滑（watched）的卡片

**类型**: 白盒测试 - 状态回滚

**代码分析**:
```typescript
// anime-grid.tsx:332-334
if (onUndoAction && lastAction.previousAnimeId) {
  onUndoAction(lastAction.previousAnimeId);
}

// App.tsx:118-128
const handleUndoAction = (id: number) => {
  setWatchedIds(prev => prev.filter(i => i !== id));
  setInterestedIds(prev => prev.filter(i => i !== id));
  setSkippedIds(prev => prev.filter(i => i !== id));
  // 从所有列表中移除
  deleteUserLog(id);  // 从 CSV 删除
}
```

**测试步骤**:
1. 右滑卡片 A 标记为 watched
2. 撤销

**预期结果**:
- A 从 watchedIds 中移除 ✓
- A 从 CSV 中删除 ✓
- A 恢复到网格原位置 ✓

---

### 🔴 TC3.4 撤销左滑（skipped）的卡片

**类型**: 白盒测试 - localSkipped vs skippedIds

**代码分析**:
```typescript
// anime-grid.tsx:329
setLocalSkipped((prev) => prev.filter((id) => id !== lastAction.previousAnimeId))

// 但是 handleSwipeLeft 调用了 onIgnore：
// anime-grid.tsx:293
if (onIgnore) onIgnore([id]);  // 这会触发 App.tsx 的 handleAction
```

**问题识别**: 
- `localSkipped` 是本地状态，被正确清除
- 但 `skippedIds` 是通过 `onIgnore` → `handleAction` 设置的
- 撤销时，`handleUndoAction` 会从 `skippedIds` 中移除 ✓

**测试步骤**:
1. 左滑卡片 A 标记为 skipped
2. 验证 CSV 中有 skipped 记录
3. 撤销
4. 验证 CSV 中 A 的记录被删除

---

### 🔴 TC3.5 撤销时历史记录与实际状态不一致

**类型**: 白盒测试 - 危险场景

**测试步骤**:
1. 滑动卡片 A
2. 改变筛选条件，使得替换上来的卡片 B 不符合筛选
3. 撤销

**代码分析**: 撤销会恢复 A 到原位置，但 B 呢？

```typescript
// anime-grid.tsx:269-273
setGridPositions((prev) => {
  const newPositions = [...prev]
  newPositions[lastAction.position!] = lastAction.previousAnimeId!
  return newPositions
})
```

B 直接被覆盖，不会触发任何状态更新。

**潜在问题**: 如果 B 已经被选中（在 selectedIds 中），撤销后 B 不在网格中了，但 selectedIds 中仍有 B
**状态**: ✅ 已修复 / 安全 (Safe)
**验证**: `handleUndo` 代码中 explicitly 检查了 replacement id 是否被选中，如果是则取消选中。
```typescript
const currentReplacingId = gridPositions[lastAction.position]
if (currentReplacingId) {
  setSelectedIds((prev) => prev.filter((id) => id !== currentReplacingId))
}
```
并且被替换的卡片 B 只是回到了"available pool"（因为它不在 `usedIds` 中了），下次可以再次出现。这符合预期。

---

### 🔴 TC3.6 Confirm/Skip 操作无法撤销

**类型**: 设计验证测试

**代码分析**:
```typescript
// 只有 replaceCardAtPosition 会添加历史记录
// handleConfirm 和 handleSkipPage 不添加历史记录
```

**测试步骤**:
1. 点击 "Confirm & Next"
2. 尝试撤销

**预期结果**: 无法撤销，返回上一页（如果 page > 1）

**设计问题**: 是否应该支持撤销 Confirm/Skip Page 操作？

---

### 🔴 TC3.7 跨页面撤销导致网格损坏 (Cross-Page Undo Corruption)

**类型**: 严重 Bug - 数据/UI 不一致

**场景描述**:
1. 用户在 Page 1 滑动卡片 A（被 B 替换）。历史记录: `[{id: A, pos: 0}]`
2. 用户切换到 Page 2。`gridPositions` 更新为 Page 2 的卡片。历史记录保持不变。
3. 用户按 R 撤销。

**Bug 表现**:
- `handleUndo` 读取最后一条历史记录 `A` (Page 1, pos 0)。
- 它将 Page 2 grid 的位置 0 强制替换为 `A`。
- 结果: Page 2 混合了 Page 1 的卡片，且系统认为该操作已撤销。

**修复状态**: ✅ 已修复 (Fixed)
**修复方案**:
- 在历史记录中增加 `page` 字段。
- 此 `handleUndo` 检查 `lastAction.page` 是否等于当前 `page`。
- 如果不匹配，调用 `onPrevious()` 或 `onSkip()` 跳转页面，而不执行数据恢复。
- 用户跳转后再次按 R 即可正确撤销。

---

## 4. 搜索与筛选测试

### 🔴 TC4.1 特殊字符搜索

**类型**: 黑盒测试 - 输入验证

**测试输入**:
1. `<script>alert('xss')</script>`
2. `' OR 1=1 --`
3. `\n\r\t`
4. 空格或只有空格
5. 超长字符串（1000+ 字符）
6. Unicode 特殊字符：`🎌 アニメ 动漫`
7. 正则表达式特殊字符：`.*+?^${}()|[]\`

**代码分析**:
```typescript
// anime-grid.tsx:144-145
anime.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
anime.japaneseTitle.includes(searchQuery)
```

**预期结果**: 
- 不应报错
- 应该正确过滤（大多数情况下返回 0 结果）

---

### 🔴 TC4.2 标签语法边界测试

**类型**: 白盒测试 - 解析逻辑

**代码分析**:
```typescript
// anime-grid.tsx:140
const isTagInput = searchQuery.startsWith("$") && searchQuery.endsWith("$")
```

**测试输入**:
1. `$`（只有一个 $）
2. `$$`（两个 $，空标签）
3. `$tag`（没有结尾 $）
4. `tag$`（没有开头 $）
5. `$a$b$`（多个 $）
6. `$ tag $`（标签内有空格）
7. `$日常$`（中文标签）

**预期结果**:
- `$`: 不被识别为标签，作为普通搜索
- `$$`: 被识别为标签语法，但标签名为空
- `$a$b$`: 被识别为标签（startsWith $ && endsWith $）

**代码问题**: 
```typescript
// navbar.tsx:71-77
if (e.key === "Enter" && searchQuery.startsWith("$") && searchQuery.endsWith("$")) {
  const tag = searchQuery.slice(1, -1).trim()  // 提取标签名并 trim
  if (tag) {
    onAddTag(tag)  // 只有非空才添加
  }
}
```

---

### 🔴 TC4.3 添加不存在的标签

**类型**: 黑盒测试 - 边缘场景

**测试步骤**:
1. 输入 `$不可能存在的标签名12345$` 并按 Enter
2. 检查筛选结果

**预期结果**: 
- 标签被添加到 selectedTags
- 网格应该为空（无匹配动漫）
- 应显示 "No anime found matching your filters"

---

### 🔴 TC4.4 筛选条件矛盾

**类型**: 黑盒测试 - 逻辑冲突

**测试步骤**:
1. 设置 Filter Panel 中的 Watch Status 为 "Watched"
2. 切换 View Mode 到 "Watched"
3. 再切回 View Mode "All"

**代码分析**:
```typescript
// anime-grid.tsx:147
const matchesViewMode = viewMode === "all" || (viewMode === "watched" && watchedIds.includes(anime.id))

// anime-grid.tsx:153-160
if (filters.watchStatus === "watched") {
  matchesWatchStatus = watchedIds.includes(anime.id)
}
```

**问题**: viewMode 和 filters.watchStatus 都可以筛选 watched，两者是什么关系？

---

### 🔴 TC4.5 评分筛选边界值

**类型**: 边界值测试

**代码分析**:
```typescript
// anime-grid.tsx:149
const matchesRating = anime.score >= filters.minRating
```

**测试场景**:
1. minRating = 0: 所有动漫都应该通过
2. minRating = 10: 只有评分正好 10 的通过
3. minRating = 10.5: 没有动漫能通过（评分上限是 10）
4. 动漫评分为 null/undefined: 是否通过？

**代码问题**: 如果 `anime.score` 是 `null` 或 `undefined`：
```typescript
null >= 0  // false
undefined >= 0  // false
```

**潜在 Bug**: 评分为空的动漫会被意外过滤掉

---

### 🔴 TC4.6 年份筛选逻辑验证

**类型**: 白盒测试 - 条件逻辑

**代码分析**:
```typescript
// anime-grid.tsx:150-151
const matchesYearStart = !filters.yearStart || anime.year >= filters.yearStart
const matchesYearEnd = !filters.yearEnd || anime.year <= filters.yearEnd
```

**测试场景**:
1. yearStart = 2020, yearEnd = 2019（起始年 > 结束年）
2. yearStart = 2020, yearEnd = 2020（同一年）
3. anime.year 为 null/undefined

**预期结果**:
- 矛盾条件应该返回空结果
- 同一年应该只显示那一年的动漫

---

### 🔴 TC4.7 筛选条件改变时网格刷新

**类型**: 白盒测试 - 状态同步

**代码分析**:
```typescript
// anime-grid.tsx:188-226
useEffect(() => {
  if (data.length === 0 || viewMode !== "all") return  // 关键！
  
  setGridPositions((currentPositions) => {
    // ...替换不符合条件的卡片
  })    
}, [data, doesAnimeMatchFilters, selectedTags, filters, searchQuery, viewMode, allSkipped, watchedIds])
```

**问题**: 当 `viewMode !== "all"` 时，筛选条件改变**不会**触发网格刷新

**测试步骤**:
1. 切换到 "Watched" 视图
2. 添加一个标签筛选
3. 切换回 "All" 视图

**预期结果**: 网格应该正确反映新的筛选条件

---

## 5. 视图模式切换测试

### 🔴 TC5.1 Watched 视图为空时切换

**类型**: 边缘条件测试

**测试步骤**:
1. 确保没有任何动漫被标记为 watched
2. 切换到 "Watched" 视图

**预期结果**: 应该显示空状态提示 "No anime found matching your filters"

---

### 🔴 TC5.2 在 Watched 视图中操作后切换回 All

**类型**: 状态一致性测试

**测试步骤**:
1. 标记 5 张卡片为 watched
2. 切换到 "Watched" 视图
3. 点击卡片（虽然不能滑动，但能选中吗？）
4. 切换回 "All" 视图

**代码分析**:
```typescript
// anime-card.tsx:201
onClick={handleClick}  // 点击事件始终存在

// anime-card.tsx:153-157
const handleClick = useCallback(() => {
  if (!isDragging) {
    onSelect(anime.id)  // 始终会触发选中！
  }
}, [isDragging, onSelect, anime.id])
```

**潜在问题**: 在 Watched 视图中卡片仍然可以被选中，但选中后无法执行任何操作

---

### 🔴 TC5.3 频繁切换视图模式

**类型**: 竞态条件测试

**测试步骤**:
1. 快速连续点击 "All" → "Watched" → "All" → "Watched" (10 次)

**预期结果**: 界面应该稳定，不应出现闪烁或状态混乱

---

### 🔴 TC5.4 视图切换时保持筛选条件

**类型**: 状态持久化测试

**测试步骤**:
1. 在 "All" 视图中设置：
   - 标签：日常
   - 最低评分：7
   - 年份：2020-2023
2. 切换到 "Watched" 视图
3. 切换回 "All" 视图

**预期结果**: 所有筛选条件应该保持不变

---

## 6. 数据持久化测试

### 🔴 TC6.1 CSV 中同一 subject_id 多条记录

**类型**: 白盒测试 - 数据一致性

**代码分析**:
```typescript
// App.tsx:68-73
logs.forEach(log => {
  const id = Number(log.subject_id);
  if (log.status === "watched") watched.add(id);
  else if (log.status === "interested") interested.add(id);
  else if (log.status === "skipped") skipped.add(id);
});
```

**问题**: 使用 Set 存储，同一 ID 多次出现会被去重。但如果同一 ID 有不同状态呢？

**测试场景**:
```csv
123,interested,2025-12-31T10:00:00Z
123,watched,2025-12-31T11:00:00Z
```

**预期行为**: ID 123 会同时出现在 `interested` 和 `watched` 两个 Set 中！

**潜在 Bug**: 状态冲突，动漫同时是 "interested" 和 "watched"

---

### 🔴 TC6.2 删除操作删除所有同 ID 记录

**类型**: 白盒测试 - 后端逻辑

**代码分析**:
```typescript
// commands.rs:194
if record_id != subject_id {
  kept_records.push(record);
}
// 删除所有匹配 subject_id 的记录，不管状态
```

**测试步骤**:
1. 将动漫 A 标记为 interested
2. 将动漫 A 标记为 watched
3. 撤销最后一次操作

**预期结果**: 只应该删除 watched 记录，保留 interested 记录

**实际行为**: 两条记录都会被删除！

**状态**: ✅ 已修复 (Fixed) / 已验证无误
**代码检查**: `delete_user_log` 函数使用逆序查找并只删除最后一条匹配记录，不会删除所有记录。

---

### 🔴 TC6.3 CSV 文件损坏恢复

**类型**: 异常处理测试

**测试步骤**:
1. 手动修改 CSV 文件，添加损坏行：
   ```csv
   123,watched,2025-12-31
   invalid_line_without_comma
   456,skipped,2025-12-31
   ```
2. 重启应用

**代码分析**:
```typescript
// commands.rs:152-168
for result in rdr.records() {
  if let Ok(record) = result {  // 忽略解析失败的行
    if record.len() >= 3 {
      // 处理
    }
  }
}
```

**预期结果**: 应用应该跳过损坏行，正常加载其他数据

---

### 🔴 TC6.4 并发写入 CSV

**类型**: 竞态条件测试

**测试步骤**:
1. 快速连续操作多张卡片（滑动、选择、确认）
2. 检查 CSV 文件完整性

**代码分析**: 
```typescript
// 前端使用 saveUserLogs 异步保存
// 每次保存是独立的 invoke 调用
```

**潜在问题**: 多个写入操作可能同时发生

---

### 🔴 TC6.5 应用崩溃后数据恢复

**类型**: 可靠性测试

**测试步骤**:
1. 执行一些操作后强制退出应用（⌘Q 或 Force Quit）
2. 重新打开应用
3. 验证数据完整性

**关键点**: 由于使用 append 模式写入，即使崩溃也不会丢失已写入的数据

---

## 7. 状态冲突测试

### 🔴 TC7.1 同一动漫多种状态

**类型**: 业务逻辑测试

**测试步骤**:
1. 右滑动漫 A（标记为 watched）
2. 撤销
3. 打开 A 的信息弹窗，点击 "Add to Want to Watch"
4. 检查 A 的最终状态

**代码分析**:
```typescript
// App.tsx:84-92
if (status === "watched") {
  setWatchedIds(prev => [...new Set([...prev, ...ids])]);
} else if (status === "interested") {
  setInterestedIds(prev => [...new Set([...prev, ...ids])]);
} else if (status === "skipped") {
  setSkippedIds(prev => [...new Set([...prev, ...ids])]);
}
```

**问题**: 状态之间不是互斥的！一个动漫可以同时是 watched 和 interested

---

### 🔴 TC7.2 先 interested 后 watched

**类型**: 状态覆盖测试

**测试步骤**:
1. 点击卡片 A 的信息按钮
2. 点击 "Add to Want to Watch"（标记为 interested）
3. 右滑卡片 A（标记为 watched）

**预期结果**: 
- A 应该同时在 watchedIds 和 interestedIds 中
- 这是设计预期还是 Bug？

---

### 🔴 TC7.3 已 skipped 的动漫再次出现

**类型**: 过滤逻辑测试

**代码分析**:
```typescript
// anime-grid.tsx:192
const usedIds = new Set([...currentPositions, ...Array.from(allSkipped), ...watchedIds])

// anime-grid.tsx:196
const validCandidates = data.filter(
  (a) => doesAnimeMatchFilters(a) && !usedIds.has(a.id)
)
```

**测试步骤**:
1. 跳过动漫 A（左滑或 Skip Page）
2. 改变筛选条件
3. 继续浏览

**预期结果**: A 不应该再出现在网格中

**验证**: `allSkipped` 包含 `skippedIds` 和 `localSkipped`，两者都应该被排除

---

## 8. 并发与竞态条件测试

### 🔴 TC8.1 快速连续 API 调用

**类型**: 前后端同步测试

**测试步骤**:
1. 使用自动化工具快速连续执行 20 次滑动操作
2. 检查 CSV 文件中的记录数

**预期结果**: CSV 应该有 20 条记录

---

### 🔴 TC8.2 网络延迟模拟

**类型**: 异步操作测试

**测试步骤**:
1. 使用开发者工具模拟慢速网络（仅适用于 Web 模式）
2. 执行操作后立即刷新页面

**预期结果**: 
- Tauri 应用是本地的，不受网络影响
- 但 CSV 文件 I/O 可能有延迟

---

### 🔴 TC8.3 加载过程中的操作

**类型**: 初始化时序测试

**代码分析**:
```typescript
// App.tsx:104-113
if (loading || data.length === 0) {
  return (
    <div>Loading anime data...</div>
  );
}
```

**测试步骤**: 
1. 应用启动时，在加载画面尝试按快捷键

**预期结果**: 没有任何响应（因为组件未渲染）

---

## 9. 边界条件测试

### 🔴 TC9.1 数据量边界

| 场景 | 测试条件 |
|------|----------|
| 空数据 | full_data.csv 为空 |
| 少量数据 | 只有 5 条动漫（< 每页 10 条） |
| 大量数据 | 10000+ 条动漫 |
| 刚好 10 条 | 正好填满一页 |

---

### 🔴 TC9.2 每页数据不足

**类型**: 白盒测试 - 分页逻辑

**测试步骤**:
1. 使用严格筛选条件，使得符合条件的动漫 < 10
2. 检查网格显示

**代码分析**:
```typescript
// anime-grid.tsx:236-243
for(let i=0; i<CARDS_PER_PAGE; i++) {
  if (i < candidates.length) {
    newGrid.push(candidates[i].id);
  } else {
    if (prev[i]) newGrid.push(prev[i]);  // 保留旧卡片？
  }
}
```

**潜在问题**: 如果候选不足，会保留旧卡片，但旧卡片可能不符合当前筛选条件！

---

### 🔴 TC9.3 所有动漫都已标记

**类型**: 终态测试

**测试步骤**:
1. 持续操作直到所有动漫都被标记（watched 或 skipped）
2. 尝试继续操作

**预期结果**: 
- 网格可能为空
- 应该显示适当的完成提示

---

### 🔴 TC9.4 负数 ID 处理

**类型**: 异常输入测试

**场景**: 如果 CSV 中有负数 subject_id

```csv
-1,watched,2025-12-31
```

**预期结果**: 应该正常处理或忽略

---

## 10. 键盘交互测试

### 🔴 TC10.1 在输入框中按快捷键

**类型**: 上下文感知测试

**代码分析**:
```typescript
// anime-grid.tsx:360-361
if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return
```

**测试步骤**:
1. 点击搜索框
2. 在输入框内按 Q、E、R 键

**预期结果**: 应该输入字符，不应触发快捷键操作

---

### 🔴 TC10.2 Filter Panel 中的输入

**类型**: 组件交互测试

**测试步骤**:
1. 打开 Filter Panel
2. 在年份输入框中按 Q 键

**预期结果**: 输入 Q 字符，不触发 Skip Page

---

### 🔴 TC10.3 弹窗打开时的 ESC 行为

**类型**: 层级控制测试

**代码分析**:
```typescript
// anime-grid.tsx:373-376
case "escape":
  if (modalAnime) setModalAnime(null)
  if (isFilterOpen) setIsFilterOpen(false)
  break
```

**测试步骤**:
1. 打开 Filter Panel
2. 在 Filter Panel 中打开 Info Modal（如果可能）
3. 按 ESC

**预期结果**: 应该关闭最上层的弹窗

**问题**: 两个 if 是独立的，可能同时关闭两个弹窗

---

### 🔴 TC10.4 快捷键与系统快捷键冲突

**类型**: 兼容性测试

**测试场景**:
- ⌘+Q：macOS 退出
- ⌘+R：刷新页面
- ⌘+E：可能有其他功能

**预期结果**: 应用快捷键不应该与系统快捷键冲突

---

## 📊 Bug 汇总

### 已确认的 Bug

| ID | 严重程度 | 描述 | 相关测试用例 |
|----|----------|------|--------------|
| B01 | **高** | 撤销操作会删除同一 subject_id 的所有记录，而不是只删除最新的 | TC6.2 |
| B02 | **中** | 状态不互斥，同一动漫可以同时是 watched 和 interested | TC7.1, TC7.2 |
| B03 | **中** | 候选动漫不足时，网格可能保留不符合筛选条件的旧卡片 | TC9.2 |
| B04 | **低** | ESC 可能同时关闭多个弹窗 | TC10.3 |

### 设计待讨论项

| ID | 描述 | 相关测试用例 |
|----|------|--------------|
| D01 | Confirm 空选择与 Skip Page 行为相同，是否需要确认？ | TC2.3 |
| D02 | Confirm/Skip Page 操作无法撤销 | TC3.6 |
| D03 | Watched 视图中卡片仍可被选中，但无实际操作 | TC5.2 |
| D04 | 评分为空的动漫会被最低评分筛选过滤掉 | TC4.5 |

---

## 运行测试命令

```bash
# 监控 CSV 变化（在另一个终端运行）
tail -f ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 备份当前数据
cp ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv ~/Desktop/test_backup.csv

# 恢复数据
cp ~/Desktop/test_backup.csv ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv

# 清空数据开始新测试
rm ~/Library/Application\ Support/com.zcan.anime-filter/user_actions.csv
```

---

**文档版本**: 1.0  
**创建日期**: 2026-01-01  
**最后更新**: 2026-01-01

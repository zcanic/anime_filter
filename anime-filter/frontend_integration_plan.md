# AnimePick 推荐系统前后端联调计划

**创建时间**: 2026-01-09
**目标**: 将已实现的推荐系统集成到前端UI，完成端到端用户体验

---

## 当前状态

### ✅ 后端实现状态
- [x] 推荐引擎核心算法（TF-IDF + 三组件融合）
- [x] 滞后响应机制（lag_steps=1）
- [x] API端点：`/api/anime/list?sort_by=recommended&session_id=xxx`
- [x] Session管理和持久化
- [x] 性能优化（66ms响应时间）
- [x] 端到端测试（5/5通过）

### ❌ 前端集成状态
- [ ] Session ID生成和管理
- [ ] 推荐排序UI控件
- [ ] API调用时传递session_id
- [ ] 观看行为追踪（X-Session-ID header）
- [ ] 前后端联调测试

---

## 实施阶段

### Phase 1: Session管理实现 [pending]
**目标**: 实现前端session持久化和传递

**任务**:
1. 生成UUID session_id（首次访问时）
2. 存储到localStorage（键名：`animepick_session_id`）
3. 创建utility函数：`getOrCreateSessionId()`
4. 在API调用中传递session_id

**文件修改**:
- `src/lib/session.ts` (新建)
- `src/lib/api.ts` (修改)

**验证标准**:
- localStorage中存在session_id
- 重新加载页面session_id保持不变
- API请求携带正确的session_id

---

### Phase 2: 推荐排序UI控件 [pending]
**目标**: 在FilterPanel添加排序选项

**任务**:
1. 扩展FilterConfig类型，添加`sortBy`字段
2. 在FilterPanel添加排序选择器：
   - "推荐排序"（recommended）
   - "评分排序"（score）
   - "年份排序"（year）
3. 添加排序方向（升序/降序）
4. UI提示：推荐排序需要观看历史

**文件修改**:
- `src/components/filter-panel.tsx`
- `src/App.tsx` (传递sortBy参数)

**UI设计**:
```
┌─ 排序方式 ─────────────┐
│ ○ 推荐排序 (需要历史)   │
│ ○ 评分排序             │
│ ○ 年份排序             │
└────────────────────────┘
```

**验证标准**:
- UI控件正确显示
- 选择不同排序方式时state更新
- 推荐排序提示正确显示

---

### Phase 3: API集成和调用 [pending]
**目标**: 前端调用推荐API并处理响应

**任务**:
1. 修改`loadUserLogs()`传递session_id
2. 修改`markAnime()`传递X-Session-ID header
3. 创建新函数`getRecommendedAnime(sessionId, filters)`
4. 处理API响应中的filtered_ids
5. 根据filtered_ids排序前端anime列表

**文件修改**:
- `src/lib/api.ts`
- `src/App.tsx` (调用推荐API)

**API调用示例**:
```typescript
// 获取推荐排序结果
const response = await fetch(
  `/api/anime/list?sort_by=recommended&session_id=${sessionId}`
);
const { filtered_ids } = await response.json();

// 根据filtered_ids重排序data
const sortedData = filtered_ids
  .map(id => data.find(a => a.id === id))
  .filter(Boolean);
```

**验证标准**:
- API调用成功返回filtered_ids
- 前端根据filtered_ids正确排序
- 错误处理（无历史时降级到默认排序）

---

### Phase 4: 观看行为追踪 [pending]
**目标**: 用户标记"watched"时自动追踪到session

**任务**:
1. 修改`markAnime()`函数，添加X-Session-ID header
2. 确保每次标记watched都传递session_id
3. 验证后端正确接收并记录到session

**文件修改**:
- `src/lib/api.ts`

**代码修改**:
```typescript
export async function markAnime(
  subjectId: number,
  status: string,
  sessionId: string
) {
  return fetch(`/api/anime/mark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId  // 新增
    },
    body: JSON.stringify({ subject_id: subjectId, status })
  });
}
```

**验证标准**:
- 标记watched时后端日志显示session更新
- 后续推荐结果反映新的观看历史
- 滞后机制正常工作（排除最近标记）

---

### Phase 5: 前后端联调测试 [pending]
**目标**: 验证完整用户流程

**测试场景**:
```
用户流程:
1. 首次访问 → 生成session_id
2. 浏览动漫 → 标记3部为"watched"
3. 选择"推荐排序" → 查看推荐结果
4. 验证推荐基于前2部历史（滞后机制）
5. 标记更多watched → 推荐更新
6. 刷新页面 → session保持，推荐一致
```

**验证清单**:
- [ ] Session持久化工作正常
- [ ] 推荐排序返回合理结果
- [ ] 滞后机制生效（排除最近选择）
- [ ] 观看更多动漫后推荐更新
- [ ] 页面刷新后状态保持
- [ ] 无推荐历史时降级处理正确
- [ ] 性能满足要求（<1秒加载）

**测试工具**:
- Chrome DevTools Network面板
- 后端日志（查看session更新）
- localStorage inspector

---

### Phase 6: 用户体验优化 [pending]
**目标**: 提升推荐功能的用户体验

**任务**:
1. 添加Loading状态（加载推荐时）
2. 空状态提示："观看至少2部动漫后获得推荐"
3. 推荐结果计数："基于X部观看历史的推荐"
4. 添加"刷新推荐"按钮（手动触发）
5. 推荐排序Badge："个性化"标识

**文件修改**:
- `src/components/anime-grid.tsx`
- `src/components/filter-panel.tsx`

**UI改进**:
```
┌─────────────────────────────────┐
│ 🎯 个性化推荐                    │
│ 基于您观看的 5 部动漫             │
│ [刷新推荐]                       │
└─────────────────────────────────┘
```

**验证标准**:
- Loading状态正确显示
- 空状态提示友好且准确
- 推荐信息清晰可见
- 刷新推荐功能正常

---

## 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Session存储位置 | localStorage | 跨页面持久化，简单可靠 |
| Session ID格式 | UUID v4 | 标准格式，足够随机 |
| 默认排序方式 | 评分排序 | 无历史时的降级策略 |
| 推荐最小历史 | 2部动漫 | 与后端lag_steps=1匹配 |
| API调用时机 | 选择推荐排序时 | 按需加载，避免浪费 |

---

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 用户无观看历史 | 推荐无法生成 | 降级到评分排序 + 友好提示 |
| Session ID丢失 | 推荐历史丢失 | 自动重新生成，影响有限 |
| API性能问题 | 用户体验差 | 已验证66ms响应时间，可接受 |
| 跨设备session不同步 | 推荐不一致 | 预期行为，未来可加用户系统 |

---

## 成功标准

- [ ] 用户可以选择"推荐排序"
- [ ] 推荐结果基于观看历史
- [ ] 滞后机制正确工作（排除最近选择）
- [ ] Session跨页面持久化
- [ ] 无历史时降级到默认排序
- [ ] 性能满足要求（<1秒响应）
- [ ] UI友好且信息清晰

---

## 预估工作量

| 阶段 | 预估时间 | 复杂度 |
|------|---------|--------|
| Phase 1: Session管理 | 30分钟 | 简单 |
| Phase 2: UI控件 | 45分钟 | 中等 |
| Phase 3: API集成 | 1小时 | 中等 |
| Phase 4: 观看追踪 | 20分钟 | 简单 |
| Phase 5: 联调测试 | 1小时 | 中等 |
| Phase 6: UX优化 | 45分钟 | 简单 |

**总计**: 约4小时

---

## 下一步行动

**立即开始**: Phase 1 - Session管理实现

1. 创建 `src/lib/session.ts`
2. 实现 `getOrCreateSessionId()` 函数
3. 测试localStorage存储

**等待用户确认**: 是否继续执行此计划？

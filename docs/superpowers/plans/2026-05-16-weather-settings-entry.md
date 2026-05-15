# 天气设置二级页面入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把“我的”页面里的天气设置卡片收起为一个“天气设置”入口，并新增独立二级页面承接原有天气位置配置。

**Architecture:** 资料页只保留入口和跳转方法，原本展示在资料页里的天气模式、位置、更新时间、当前位置刷新与手动区县选择，迁移到新的 `pages/weather-settings` 页面。天气读写逻辑继续复用现有 `utils/weather.js` 和 `utils/storage.js`，不改业务协议。

**Tech Stack:** 微信原生小程序页面、`utils/weather.js`、`utils/storage.js`、轻量 Node 回归脚本

---

### Task 1: 先写入口回归检查

**Files:**
- Create: `pages/weather-settings/review.test.js`

- [ ] **Step 1: 写失败测试**

检查三件事：
- `app.json` 已注册 `pages/weather-settings/weather-settings`
- `pages/profile/profile.js` 暴露 `goWeatherSettings`
- `pages/weather-settings/weather-settings.js` 暴露 `useCurrentWeatherLocation` 与 `onManualRegionChange`

- [ ] **Step 2: 运行一次，确认在页面文件创建前失败**

Run: `node pages/weather-settings/review.test.js`

- [ ] **Step 3: 再进入实现**

### Task 2: 迁移资料页入口

**Files:**
- Modify: `pages/profile/profile.wxml`
- Modify: `pages/profile/profile.js`
- Modify: `pages/profile/profile.wxss`

- [ ] **Step 1: 删除资料页内联天气卡片**
- [ ] **Step 2: 在设置区新增“天气设置”入口**
- [ ] **Step 3: 补跳转方法 `goWeatherSettings`**

### Task 3: 新建天气设置二级页

**Files:**
- Create: `pages/weather-settings/weather-settings.json`
- Create: `pages/weather-settings/weather-settings.js`
- Create: `pages/weather-settings/weather-settings.wxml`
- Create: `pages/weather-settings/weather-settings.wxss`
- Modify: `app.json`

- [ ] **Step 1: 创建页面注册与导航栏配置**
- [ ] **Step 2: 迁入天气设置展示与交互**
- [ ] **Step 3: 保持现有天气刷新 / 手动区县逻辑可复用**

### Task 4: 跑回归检查

**Files:**
- Test: `pages/weather-settings/review.test.js`

- [ ] **Step 1: 运行回归脚本**

Run: `node pages/weather-settings/review.test.js`

- [ ] **Step 2: 跑语法检查**

Run:
- `node --check pages/profile/profile.js`
- `node --check pages/weather-settings/weather-settings.js`

- [ ] **Step 3: 确认最终结果**

预期：
- 资料页只剩“天气设置”入口
- 新页面可独立承接天气设置
- 页面注册完整，无编译缺页问题

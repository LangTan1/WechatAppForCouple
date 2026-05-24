# 时光相册单张删除与滑动预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让时光相册支持预览中删除单张照片，并在预览层左右切换上一张 / 下一张。

**Architecture:** 改动集中在 `pages/album` 页面。页面新增预览索引和手势处理，删除照片时仍通过 `storage.getAlbums()` / `storage.setAlbums()` 写入，继续复用现有 canonical fileID 与展示 URL 分层。

**Tech Stack:** 微信原生小程序 WXML/WXSS/JS、Node 轻量回归脚本。

---

## 文件结构

- Create: `pages/album/review.test.js`
  - 使用轻量 Page harness 载入 `pages/album/album.js`，验证预览索引、左右切换和单张删除行为。
- Modify: `pages/album/album.js`
  - 增加 `previewPhotoIndex`、预览辅助方法、左右切换、单张照片删除。
- Modify: `pages/album/album.wxml`
  - 预览层增加滑动绑定、上一张 / 下一张按钮、删除照片按钮。
- Modify: `pages/album/album.wxss`
  - 增加预览操作按钮和删除按钮样式。

## Task 1: 写相册行为回归测试

**Files:**
- Create: `pages/album/review.test.js`

- [ ] **Step 1: 创建测试 harness**

写入 `pages/album/review.test.js`，用 `global.Page` 捕获页面对象，用 stub storage 和 wx 验证行为。

- [ ] **Step 2: 覆盖预览打开与左右切换**

测试打开第二张图后，`previewPhotoIndex` 为 1；调用下一张切到 2；调用上一张切回 1。

- [ ] **Step 3: 覆盖删除单张照片**

测试删除中间照片后，相册只移除目标照片，预览切到相邻照片；删除最后一张照片后，空相册保留且预览关闭。

- [ ] **Step 4: 运行测试确认先失败**

Run: `node pages\album\review.test.js`

Expected: FAIL，原因是 `previewPhotoIndex`、`showNextPhoto`、`deletePreviewPhoto` 等行为尚未实现。

## Task 2: 实现预览索引与左右切换

**Files:**
- Modify: `pages/album/album.js`
- Modify: `pages/album/album.wxml`
- Modify: `pages/album/album.wxss`
- Test: `pages/album/review.test.js`

- [ ] **Step 1: 在页面 data 增加预览状态**

在 `data` 中加入 `previewPhotoIndex: -1` 和 `previewTouchStartX: 0`。

- [ ] **Step 2: 提取预览照片构建方法**

新增 `_buildPreviewPhoto(photo)`，保留现有 `displayUrl || url || fileID` 的展示 URL 选择规则。

- [ ] **Step 3: 改造 `viewPhoto`**

从 `e.currentTarget.dataset.index` 读取索引，设置 `previewPhoto` 和 `previewPhotoIndex`。

- [ ] **Step 4: 新增 `showPreviewPhotoAt(index)`、`showPrevPhoto()`、`showNextPhoto()`**

基于 `currentAlbum.photos` 切换照片，边界不越界，切换时重置 `previewScale` 和 `commentText`。

- [ ] **Step 5: 新增触摸滑动处理**

新增 `onPreviewTouchStart(e)` 和 `onPreviewTouchEnd(e)`，横向滑动超过 60px 时切换照片。

- [ ] **Step 6: 更新 WXML 和样式**

预览层绑定触摸事件，增加上一张 / 下一张按钮，并用 `previewPhotoIndex` 控制按钮是否显示。

- [ ] **Step 7: 运行测试**

Run: `node pages\album\review.test.js`

Expected: 预览切换相关断言通过，删除相关断言仍失败。

## Task 3: 实现单张照片删除

**Files:**
- Modify: `pages/album/album.js`
- Modify: `pages/album/album.wxml`
- Modify: `pages/album/album.wxss`
- Test: `pages/album/review.test.js`

- [ ] **Step 1: 增加删除入口**

在预览底部增加“删除照片”按钮，绑定 `deletePreviewPhoto`。

- [ ] **Step 2: 实现 `deletePreviewPhoto`**

弹出 `wx.showModal` 二次确认，确认后调用 `_deletePhotoById(previewPhoto.id)`。

- [ ] **Step 3: 实现 `_deletePhotoById(photoId)`**

从 `storage.getAlbums()` 取 canonical 数据，只删除当前相册里的目标照片；如果封面来自被删照片，则改为剩余第一张照片或空字符串。

- [ ] **Step 4: 删除后刷新展示数据**

调用 `storage.setAlbums(albums)` 后，用 `_decorateAlbumsForDisplay(albums)` 更新 `albums` / `currentAlbum`。如果相册还有照片，预览切到相邻索引；如果空了，关闭预览。

- [ ] **Step 5: 运行测试确认通过**

Run: `node pages\album\review.test.js`

Expected: PASS。

## Task 4: 最终验证

**Files:**
- Verify: `pages/album/album.js`
- Verify: `pages/album/review.test.js`

- [ ] **Step 1: 语法检查**

Run: `node --check pages\album\album.js`

Expected: PASS。

- [ ] **Step 2: 跑相册回归测试**

Run: `node pages\album\review.test.js`

Expected: PASS。

- [ ] **Step 3: 检查改动范围**

Run: `git diff -- pages\album\album.js pages\album\album.wxml pages\album\album.wxss pages\album\review.test.js`

Expected: 只包含相册预览、删除单张照片和测试相关改动，不触碰 `storage.js` 或云函数。

## Self-Review

- Spec 覆盖：单张删除由 Task 3 覆盖；左右预览由 Task 2 覆盖；图片链路保护由任务范围和 Task 4 diff 检查覆盖。
- Placeholder 扫描：无 TODO/TBD。
- 类型一致性：统一使用 `previewPhotoIndex`、`previewTouchStartX`、`showPreviewPhotoAt`、`deletePreviewPhoto`、`_deletePhotoById`。

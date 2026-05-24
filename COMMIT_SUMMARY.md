# 版本更新记录 v5.7

## 更新总览

本次更新聚焦 **时光相册体验优化**，在保持现有云图片同步链路不变的前提下，补齐两个常用操作：

1. **支持单独删除相册中的某一张照片**
2. **照片预览支持上一张 / 下一张切换与左右滑动**

建议提交标题：

- `feat: 优化时光相册照片删除和滑动预览`

可选简短标题：

- `feat: 相册支持单张删除和滑动看图`

---

## 一、相册内单张照片删除

### 背景

之前时光相册只能删除整个相册，无法单独删除某张已经上传的照片。用户如果只想移除一张照片，必须删除整本相册，操作成本高且容易误删其它回忆。

### 方案

在照片预览层新增“删除照片”入口，用户看清当前照片后再删除，并通过二次确认降低误触风险。

### 行为细节

- 点击相册照片进入预览后，底部显示“删除照片”
- 点击删除后弹出确认弹窗
- 确认后只从当前相册的 `photos` 数组中移除该照片
- 如果相册还有照片，预览自动切到相邻照片
- 如果删除后相册为空，则关闭预览，保留空相册
- 删除整个相册的能力保持不变，仍在“编辑相册”弹窗中执行

---

## 二、照片预览左右切换

### 背景

之前查看相册照片时，看完一张必须关闭预览，再回到网格里点另一张，连续浏览体验不顺。

### 方案

预览层新增当前照片索引 `previewPhotoIndex`，打开照片时记录所在位置，并支持：

- 点击左 / 右按钮切换上一张 / 下一张
- 在预览层左右滑动切换照片
- 第一张和最后一张自动限制边界，不会越界
- 切换照片时重置缩放状态和评论输入框

---

## 三、图片链路保护

本次刻意不改动相册图片的云同步协议：

- 未修改 `utils/storage.js`
- 未修改 `cloudfunctions/coupleOps`
- 继续保留 canonical `cloud://` fileID 作为真实存储值
- 继续只在展示层消费 `displayUrl` / `displayCoverUrl`
- 保存相册仍走 `storage.setAlbums()`，由既有净化逻辑防止临时 URL 写回云端

---

## 四、变更文件

```text
pages/album/album.js                         # 单张删除、预览索引、上一张/下一张、左右滑动
pages/album/album.wxml                       # 预览层新增切换按钮和删除照片按钮
pages/album/album.wxss                       # 预览按钮和删除按钮样式
pages/album/review.test.js                   # 相册行为回归测试
docs/superpowers/specs/2026-05-24-album-photo-delete-swipe-design.md # 设计说明
docs/superpowers/plans/2026-05-24-album-photo-delete-swipe.md        # 实施计划
README.md                                    # 更新日志补充
COMMIT_SUMMARY.md                            # 本文档
```

注意：当前工作区里 `CLAUDE.md` 和 `pages/profile/profile.wxml` 也处于 modified 状态，但它们不是本次相册功能改动的一部分，提交时建议不要一起加入。

---

## 五、已验证内容

```powershell
node --check pages\album\album.js
node pages\album\review.test.js
node utils\storage.review.test.js
```

验证结果：

- 相册页面 JS 语法检查通过
- 单张删除、预览索引、按钮切换、左右滑动回归测试通过
- storage 相册图片净化与云文件展示回归测试通过

---

## 六、建议提交范围

建议本次只提交以下文件：

```powershell
git add pages\album\album.js `
        pages\album\album.wxml `
        pages\album\album.wxss `
        pages\album\review.test.js `
        docs\superpowers\plans\2026-05-24-album-photo-delete-swipe.md `
        README.md `
        COMMIT_SUMMARY.md

git commit -m "feat: 优化时光相册照片删除和滑动预览"
```

如果需要把已经创建的设计说明也推到 GitHub，请确认本地提交 `e3d8cc3 docs: design album photo delete and swipe preview` 会一起 push。

---

# 历史版本更新记录 v5.6

## 更新总览

本次更新包含两条主线：

1. **云文件解析改用云函数 + 相册/头像展示修复**（Codex + Claude 协作）
2. **全局错误处理 + 天气定位修复**（Claude）

建议提交标题：

- `feat: 云文件解析改用云函数 + 全局错误处理 + 天气定位修正`

可选简短标题：

- `fix: 图片跨设备显示 + 天气定位 + 全局稳定性`

---

## 一、云文件解析改用云函数（Codex + Claude）

### 背景
客户端 `wx.cloud.getTempFileURL` 在非上传者设备上返回 `STORAGE_EXCEED_AUTHORITY` 权限错误，导致头像和相册照片对方看不见。

### 方案
将 cloud fileID → HTTP URL 的解析从客户端迁移到云函数 `coupleOps`，利用服务端管理员权限绕过客户端限制。

### 变更文件

#### `cloudfunctions/coupleOps/index.js`
- 新增 `resolveFileURLs` action
- 接收 `docId` + `fileIDs` 数组，验证调用者属于目标 couple
- 去重 + 分批（每批 50 个）调用 `cloud.getTempFileURL`
- 返回 `{ success, fileList: [{ fileID, tempFileURL, status }] }`

#### `utils/storage.js`
- `_resolveCloudFileIDs` 改为调用云函数 `resolveFileURLs`，不再直接使用客户端 `wx.cloud.getTempFileURL`
- `_sanitizePhotoForStorage` 写入前清除 `displayUrl` 字段，只保留 canonical `fileID` 和 `url`

#### `pages/album/album.js`
- 新增 `_isCloudFileID` 工具方法
- 新增 `_decorateAlbumsForDisplay` 方法：为相册数据生成 `displayUrl`/`displayCoverUrl` 展示态字段
- `loadAlbums` 改为 async，调用装饰方法后再 setData
- 照片上传成功后立即用本地 `tempPath` 作为 `displayUrl`
- `viewPhoto` 预览时使用已解析的 `displayUrl`
- `onShow` 调整为先 `syncFromCloud` 再 `loadAlbums`，确保数据就绪

#### `pages/album/album.wxml`
- 相册封面：`src` 优先使用 `{{item.displayCoverUrl || item.cover}}`
- 照片列表：`src` 优先使用 `{{item.displayUrl || item.url}}`
- 预览大图：`src` 优先使用 `{{previewPhoto.displayUrl || previewPhoto.url}}`

#### `pages/profile/profile.js`
- 头像上传成功后 `setData` 使用本地 `tempPath` 而非 cloud fileID，避免刚上传就黑屏

---

## 二、全局 loadFromCloud 错误处理（Claude）

### 背景
各页面 `syncFromCloud` 直接 `await storage.loadFromCloud()` 无 try/catch，网络异常时 Promise rejection 未捕获，可能导致页面白屏或功能中断。

### 方案
所有 11 个页面的 `syncFromCloud` 添加 try/catch，错误仅 console.error，不影响页面使用本地数据。

### 变更文件

| 文件 | 改动 |
|------|------|
| `pages/achievement/achievement.js` | `syncFromCloud` 添加 try/catch |
| `pages/angry/angry.js` | 同上 |
| `pages/avoid/avoid.js` | 同上 |
| `pages/diary/diary.js` | 同上 |
| `pages/learn/learn.js` | 同上 |
| `pages/menu/menu.js` | 同上 |
| `pages/mood/mood.js` | 同上 |
| `pages/profile/profile.js` | 同上 |
| `pages/reflection/reflection.js` | 同上 |
| `pages/sweet/sweet.js` | 同上 |
| `pages/weather-settings/weather-settings.js` | 同上 |
| `pages/whisper/whisper.js` | 同上 |
| `pages/wishlist/wishlist.js` | 同上 |

统一格式：
```javascript
async syncFromCloud() {
  try { await storage.loadFromCloud(); } catch (e) { console.error('[page] loadFromCloud failed:', e); }
  this.loadData();
}
```

---

## 三、天气设置超时处理（Claude）

### 背景
天气设置页点击"使用当前位置"或选择手动区县后，和风天气 API 请求可能长时间无响应，用户得不到任何反馈。

### 方案
添加 15 秒超时（`Promise.race`），超时后弹出详细错误 Modal。

### 变更文件

#### `pages/weather-settings/weather-settings.js`
- `useCurrentWeatherLocation`：添加 `Promise.race` 15 秒超时，失败时弹 `wx.showModal` 显示具体错误原因（定位超时 / 网络错误 / 其他）
- `onRegionChange`：手动区县设置同样添加 15 秒超时

---

## 四、天气定位坐标系修正（Claude）

### 背景
`wx.getFuzzyLocation` 使用 `wgs84` 坐标系，但和风天气 GeoAPI 以及微信/高德地图体系使用 `gcj02` 坐标系。坐标系不匹配导致定位解析出的城市可能有偏差。

### 变更文件

#### `utils/weather.js`
- `getLocation` 函数：`type: 'wgs84'` → `type: 'gcj02'`

---

## 部署须知

1. **云函数需重新部署**：`cloudfunctions/coupleOps` 新增了 `resolveFileURLs` action，需在微信开发者工具中右键 → 上传并部署
2. **域名白名单**：和风天气域名 `https://p86heymt7v.re.qweatherapi.com` 需在微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名 中添加
3. **无数据库 schema 变更**：本次更新不涉及 `couples` 集合结构变更

---

## 涉及文件清单（24 个）

```
cloudfunctions/coupleOps/index.js          # 新增 resolveFileURLs
utils/storage.js                           # 云函数调用 + displayUrl 清理
utils/weather.js                           # gcj02 坐标系
pages/album/album.js                       # displayUrl 装饰 + 上传优化
pages/album/album.wxml                     # 渲染层优先 displayUrl
pages/profile/profile.js                   # 头像 tempPath + try/catch
pages/weather-settings/weather-settings.js # 超时处理 + try/catch
pages/achievement/achievement.js           # try/catch
pages/angry/angry.js                       # try/catch
pages/avoid/avoid.js                       # try/catch
pages/diary/diary.js                       # try/catch
pages/learn/learn.js                       # try/catch
pages/menu/menu.js                         # try/catch
pages/mood/mood.js                         # try/catch
pages/reflection/reflection.js             # try/catch
pages/sweet/sweet.js                       # try/catch
pages/whisper/whisper.js                   # try/catch
pages/wishlist/wishlist.js                 # try/catch
COMMIT_SUMMARY.md                          # 本文档
CLAUDE.md                                  # 项目文档更新
README.md                                  # 版本日志更新
```

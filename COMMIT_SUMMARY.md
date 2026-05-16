# 版本更新记录 v5.6

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

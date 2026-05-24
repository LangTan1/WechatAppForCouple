# 时光相册单张删除与滑动预览设计

## 目标

在不破坏现有云图片展示链路的前提下，给时光相册补两个能力：

- 已创建相册内可以单独删除某一张照片
- 打开照片预览后，可以左右切换上一张 / 下一张，不需要关闭后再点另一张

整本相册删除能力保持现状：进入相册后点“编辑”，在编辑弹窗中删除相册。

## 约束

相册图片链路保持现有设计：

- 云端和本地持久化数据继续保存 canonical `cloud://` fileID
- `displayUrl` / `displayCoverUrl` 只作为页面展示字段
- `storage.setAlbums()` 继续负责写入前净化，不把临时 HTTP URL 写回云端
- 不改 `utils/storage.js` 的图片净化逻辑
- 不改 `cloudfunctions/coupleOps` 的 `resolveFileURLs`

本次实现范围集中在 `pages/album/album.js`、`pages/album/album.wxml`、`pages/album/album.wxss`，只在需要回归测试时新增页面级测试脚本。

## 交互设计

### 单张照片删除

删除入口放在照片预览层底部，用户看清当前照片后再删除。

流程：

1. 用户点击相册内某张照片进入预览
2. 预览底部显示“删除照片”
3. 点击后弹出二次确认
4. 确认后，从当前相册 `photos` 数组中移除该照片
5. 调用 `storage.setAlbums(albums)` 保存

删除后的状态：

- 如果相册还有照片，预览自动切到相邻照片
- 如果删除的是最后一张，则切到新的最后一张
- 如果相册被删空，则关闭预览，保留空相册
- 相册封面继续由第一张照片派生；空相册封面为空

### 左右滑动预览

预览层记录当前照片索引 `previewPhotoIndex`。

流程：

1. 点击照片时，从 `data-index` 读取当前索引
2. 预览层保存 `previewPhoto` 和 `previewPhotoIndex`
3. 用户左右滑动时，根据方向切换索引
4. 切换照片时重置 `previewScale` 和 `commentText`

边界行为：

- 第一张向右滑时不越界
- 最后一张向左滑时不越界
- 如果当前照片列表为空，关闭预览

## 数据流

读取：

- 页面继续从 `storage.getAlbums()` 读取相册
- `loadAlbums()` 继续调用 `_decorateAlbumsForDisplay()` 生成展示数据
- 预览照片使用已装饰后的 `displayUrl || url`

写入：

- 删除照片时先基于 `storage.getAlbums()` 获取 canonical 数据
- 按相册 id 和照片 id 删除目标照片
- 如果相册封面等于被删除照片的 `fileID` / `url`，封面更新为剩余第一张照片的 `fileID` / `url`；无剩余照片则清空
- 保存仍走 `storage.setAlbums()`，由现有净化逻辑兜底清理 `displayUrl`

## 测试策略

新增轻量 Node 回归测试，覆盖页面核心纯逻辑：

- 打开照片预览时记录当前索引，并使用可展示 URL
- 切换下一张 / 上一张时更新 `previewPhoto` 和索引
- 删除中间照片后预览切到相邻照片
- 删除最后一张照片后相册保留但预览关闭
- 保存前不要求手动处理 `displayUrl`，继续依赖 `storage.setAlbums()` 的既有净化路径

同时运行：

- `node --check pages/album/album.js`
- 新增的相册回归测试

## 不做的事

- 不批量删除照片
- 不移动照片顺序
- 不重写相册预览为 `wx.previewImage`
- 不删除云存储中的物理文件，只从相册数据中移除引用
- 不改相册云同步协议

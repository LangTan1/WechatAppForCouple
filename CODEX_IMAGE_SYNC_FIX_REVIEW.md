# 图片同步修复说明

## 目的

这份文档用于给 Claude Code 做二次检查，说明本次“修改头像后对方经常看不到”和“时光相册上传图片后对方经常看不到”的问题背景、根因、修复方案和验证结果。

## 本次改动范围

涉及文件：

- `utils/storage.js`
- `utils/storage.review.test.js`（新增）

本次没有修改头像页和相册页的业务流程，主要修复的是底层存储与同步逻辑。

## 现象描述

用户反馈的现象主要有两类：

1. 修改头像后，当前设备能看到，但另一方设备过一段时间后经常看不到。
2. 在时光相册上传图片后，当前设备能看到，但另一方设备有时看不到图片或相册封面。

这类问题的特点是：

- 刚上传或刚同步时看起来正常
- 过一段时间后容易失效
- 更像“地址过期”而不是“上传失败”

## 根因分析

根因在 `utils/storage.js` 的云文件处理逻辑。

### 1. `cloud fileID` 和临时 URL 被混用了

微信云存储的图片有两种表现形式：

- `cloud://...`：稳定的文件标识，适合持久化存储和跨设备同步
- `https://...` 临时 URL：适合页面展示，但会过期

项目原来的逻辑是：

1. 云端同步回来后，调用 `wx.cloud.getTempFileURL`
2. 拿到临时 URL 后，直接覆盖本地存储中的头像和相册图片字段
3. 后续页面再次保存这些数据时，把临时 URL 当成正式数据又写回云端

这样就会导致：

- 云端原本应该保存 `cloud://...`
- 但实际被覆盖成了会过期的 `https://...`
- 另一方设备稍后同步到这些数据时，拿到的是已经过期或即将过期的地址

### 2. 相册问题比表面上更隐蔽

相册照片结构里虽然有 `fileID` 字段，但原来的读取逻辑会把 `url` 替换成临时 URL，再把整个相册对象重新保存。

只要后续触发以下任一操作，就可能把污染后的数据重新写回云端：

- 新增评论
- 编辑相册
- 新增照片
- 任何读取后再 `setAlbums(...)` 的流程

### 3. 头像问题更脆弱

头像本身只有一个主字段，原来的同步逻辑会直接把它覆盖成临时 URL。

这意味着头像一旦被污染：

- 后续再同步或再保存时没有独立的 canonical `fileID` 可以兜底
- 更容易出现另一方彻底看不到的情况

## 修复思路

核心原则只有一条：

**持久化层只保存 canonical 数据，展示层才使用临时 URL。**

也就是：

- 本地持久化和云端文档里，头像/相册都尽量保存 `cloud://...`
- 页面显示时，再把 `cloud://...` 映射成临时 URL
- 临时 URL 不允许反向污染存储层

## 具体修改

### 1. 给头像增加展示层缓存

在 `utils/storage.js` 中新增了本地缓存键：

- `MY_AVATAR_TEMP_URL`
- `PARTNER_AVATAR_TEMP_URL`

现在头像逻辑分成两层：

- `my_avatar` / `partner_avatar`：持久化层，保留 canonical 值
- `my_avatar_temp_url` / `partner_avatar_temp_url`：展示层，只存临时 URL

这样页面调用 `getMyAvatar()` / `getPartnerAvatar()` 时，拿到的是可显示的值；但真正写回云端时，仍然使用 canonical `fileID`。

### 2. 给相册增加文件 URL 缓存

新增了：

- `FILE_URL_CACHE`

这个缓存保存的是：

- `cloud fileID -> 临时 URL`

现在相册数据本身仍然以 canonical 形式存储，例如：

- `photo.fileID`
- `photo.url`
- `album.cover`

这些字段在持久化层会尽量保持 `cloud://...`。

页面读取相册时，再通过缓存把它们转成临时 URL 用于展示。

### 3. 读取相册时返回展示数据，写入相册时先做净化

新增了两类处理函数：

- `_sanitizeAlbumsForStorage(...)`
- `_buildDisplayAlbums(...)`

现在：

- `getAlbums()` 返回展示用数据
- `setAlbums()` 写入前先还原/净化为 canonical 数据

这样页面层即使拿到的是展示用临时 URL，再保存时也不会把这些临时 URL 回传到云端。

### 4. 头像 setter 增加兜底保护

更新了：

- `setMyAvatar(...)`
- `setPartnerAvatar(...)`

即使未来某段代码误把展示 URL 传进头像 setter：

- 也会优先保留已有的 canonical `fileID`
- 不会把临时 URL 直接写回本地持久化层和云端

### 5. 从云端同步到本地时，不再用临时 URL 覆盖正式数据

更新了 `_resolveCloudFileIDs(...)` 的行为：

- 仍然会去解析临时 URL
- 但只写入展示缓存
- 不再把头像字段和相册字段本身覆盖成临时 URL

这是本次修复最关键的一点。

### 6. 写回云端前统一做 canonical 兜底

更新了：

- `saveToCloud(...)`
- `saveBatchToCloud(...)`

现在在真正提交给云函数前，会再次做一层 canonical 化处理，避免页面上游传入展示值时污染云端数据。

## 新增回归测试

新增文件：

- `utils/storage.review.test.js`

当前覆盖的重点场景：

1. 云端同步后，本地持久化中的头像仍然保留 `cloud://...`
2. 云端同步后，本地持久化中的相册封面和照片 `url` 仍然保留 `cloud://...`
3. 页面读取头像和相册时，依然能拿到可展示的临时 URL
4. 相册再次保存时，写回云端的数据仍然是 canonical `fileID`
5. 头像 setter 即使收到展示 URL，也不会把 canonical 值丢掉

## 我实际做过的验证

执行通过：

- `node --check utils/storage.js`
- `node --check pages/profile/profile.js`
- `node --check pages/album/album.js`
- `node utils/storage.review.test.js`
- `NODE_PATH=... node cloudfunctions/coupleOps/review.test.js`

说明：

- 最后一条主要是确认之前的云函数修复没有被这次改动影响
- 这次图片同步修复本身主要由 `utils/storage.review.test.js` 覆盖

## 修复后的预期效果

修复后，正常流程下：

1. 用户上传头像或相册图片
2. 云端保存的是 `cloud://...`
3. 各设备本地展示时动态换成临时 URL
4. 后续再次编辑、评论、同步，也不会把临时 URL 反写回云端

因此另一方设备再同步时，仍然能基于稳定的 `fileID` 重新获取可用地址。

## 仍然存在的限制

这次修复能防止“以后继续污染”。

但如果历史云数据里已经被写成了失效的临时 URL，而且没有保留对应的 `cloud fileID`，那这部分旧数据无法自动恢复出真实文件标识。

具体来说：

- 旧头像如果已经只有过期 URL，没有原始 `fileID`，通常需要重新上传
- 旧相册照片因为多数还带有 `fileID`，自愈概率更高

## 建议 Claude Code 重点复查的问题

建议重点看下面这些点：

1. `getAlbums()` 返回展示态、`setAlbums()` 写入 canonical 态，这种双层设计在当前项目里是否足够稳妥？
2. 现在 `album.cover` 也走了 canonical 化，是否还有遗漏的相册字段会被展示 URL 污染？
3. 头像 setter 的兜底策略是否合理，是否会在某些极端情况下保留了错误的旧值？
4. 是否还有别的业务模块也在做“读取展示值后再整包写回”的操作，存在同类风险？
5. 当前 `FILE_URL_CACHE` 是否需要补充过期淘汰策略，还是保持简单缓存即可？

## 结论

这次问题的本质不是上传失败，而是“展示层临时 URL 反向污染了持久化层”。

本次修复已经把这两层拆开：

- 持久化层负责稳定同步
- 展示层负责临时访问

如果 Claude Code 复查没有发现新的边界问题，这个方向应该就是正确的。

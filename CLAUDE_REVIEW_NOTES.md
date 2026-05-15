# Claude Code 审查说明

## 审查目标
请重点帮我检查这次“双人天气 + 天气设置页拆分 + 图片同步修复 + 云函数权限修复”改动是否存在：
- 功能回归
- 数据同步错误
- 角色映射错误
- 云函数权限遗漏
- 小程序页面注册或跳转问题

## 本次改动重点

### 1. 双人天气系统
- 新增双方独立天气字段：
  - `devWeatherProfile`
  - `userWeatherProfile`
  - `devWeatherSnapshot`
  - `userWeatherSnapshot`
- 相关文件：
  - `utils/storage.js`
  - `utils/weather.js`
  - `cloudfunctions/coupleOps/index.js`
  - `pages/index/index.js`
  - `pages/index/index.wxml`
  - `pages/index/index.wxss`

### 2. 天气设置页拆分
- 原本资料页中的天气设置卡片已移除
- 现在在“我的”页的“设置”区域新增入口：
  - `天气设置`
- 新建二级页：
  - `pages/weather-settings/weather-settings`
- 相关文件：
  - `app.json`
  - `pages/profile/profile.js`
  - `pages/profile/profile.wxml`
  - `pages/weather-settings/weather-settings.js`
  - `pages/weather-settings/weather-settings.wxml`

### 3. 图片同步问题修复
- 修复头像和相册图片把临时 URL 写回存储/云端的问题
- 相关文件：
  - `utils/storage.js`
  - `utils/storage.review.test.js`

### 4. 云函数安全修复
- `coupleOps` 增加授权校验与字段白名单
- 删除权限限制为开发者角色
- 公开查询结果收窄
- 相关文件：
  - `cloudfunctions/coupleOps/index.js`
  - `cloudfunctions/coupleOps/review.test.js`

## 希望重点检查的问题

### A. 天气数据映射是否正确
- 开发者端是否稳定映射到：
  - `devWeatherProfile`
  - `devWeatherSnapshot`
- 使用者端是否稳定映射到：
  - `userWeatherProfile`
  - `userWeatherSnapshot`
- 对方天气读取是否存在角色反转风险

### B. 天气设置页逻辑是否完整
- `goWeatherSettings()` 跳转是否正确
- 新页面是否缺少必要的刷新时机
- 使用当前位置与手动区县设置是否都能正确回写

### C. 首页天气展示是否有边界问题
- `weather.mine` / `weather.partner` 缺数据时是否会出现渲染问题
- 1 小时缓存逻辑是否存在过期判断偏差
- 自动定位失败后的手动兜底是否可靠

### D. 图片同步修复是否有遗漏
- 是否还有其他地方会把展示用临时 URL 写回存储
- 头像、相册、封面图等是否都已覆盖

### E. 云函数权限是否仍有口子
- 是否还有字段可被同空间成员越权修改
- 是否还有查询结果泄露内部敏感字段

## 已跑过的本地验证
- `node --check utils/storage.js`
- `node --check utils/weather.js`
- `node --check pages/index/index.js`
- `node --check pages/profile/profile.js`
- `node --check pages/weather-settings/weather-settings.js`
- `node --check cloudfunctions/coupleOps/index.js`
- `node utils/storage.review.test.js`
- `node utils/weather.review.test.js`
- `node pages/weather-settings/review.test.js`
- `node cloudfunctions/coupleOps/review.test.js`

## 额外说明
- 之前首页模板重写时曾触发过微信开发者工具误报“`pages/index/index.wxml` 找不到”，后来已回到稳定结构并恢复编译。
- 这次希望重点关注“逻辑正确性”和“是否还有潜在回归”，而不是纯样式问题。

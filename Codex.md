# Codex 工作日志

## 记录时间
- 2026-05-15 至 2026-05-16

## 本次目标
- 为项目补齐“双人天气 + 区县位置 + 自动定位优先 / 手动兜底 + 1 小时缓存”能力
- 修复图片同步中“头像/相册对方看不到”的问题
- 修复云函数权限与绑定恢复相关风险
- 优化首页天气卡片占用空间
- 将“我的”页中的天气设置下沉为二级页面，减少主页面高度

---

## 一、天气系统功能改造

### 1. 双人天气数据模型
- 在情侣共享数据中新增双方独立天气字段：
  - `devWeatherProfile`
  - `userWeatherProfile`
  - `devWeatherSnapshot`
  - `userWeatherSnapshot`
- 作用：
  - `WeatherProfile` 用来保存位置来源、城市、区县、和风天气 `locationId`、更新时间等
  - `WeatherSnapshot` 用来保存最近一次天气结果，供首页直接展示

### 2. storage 层改造
- 修改文件：
  - `utils/storage.js`
  - `utils/storage.review.test.js`
- 主要内容：
  - 新增天气相关本地 key
  - 增加“我 / 对方”的天气 profile 与 snapshot 读写方法
  - 增加天气快照过期判断方法
  - 扩展云端字段映射，使天气数据可以按角色自动同步
  - 云端加载后可按当前角色把开发者/使用者天气数据分别落到本地“我 / 对方”字段中

### 3. weather 模块重构
- 修改文件：
  - `utils/weather.js`
  - `utils/weather.review.test.js`
- 主要内容：
  - 新增 `WEATHER_CACHE_TTL = 1 小时`
  - 支持自动定位获取区县级位置
  - 支持手动输入省市区后解析到和风天气 locationId
  - 支持以下刷新链路：
    - 优先自动定位
    - 自动失败时使用手动位置
    - 再失败时降级为本地模拟天气
  - 首页展示不再使用单份天气对象，而是返回：
    - `weather.mine`
    - `weather.partner`

### 4. 云函数白名单扩展
- 修改文件：
  - `cloudfunctions/coupleOps/index.js`
  - `cloudfunctions/coupleOps/review.test.js`
- 主要内容：
  - 放开 4 个天气字段的受控同步
  - 确保天气字段不会被现有白名单过滤掉

---

## 二、首页天气展示改造

### 1. 首页双人天气展示
- 修改文件：
  - `pages/index/index.js`
  - `pages/index/index.wxml`
  - `pages/index/index.wxss`
- 主要内容：
  - 首页进入时先显示缓存天气
  - 若“我的天气”超过 1 小时未更新，则自动刷新
  - 首页天气展示改为“我 / TA”双栏
  - 展示内容包括：
    - 名字
    - 区县位置
    - 天气图标
    - 当前温度
    - 温差范围
    - 天气描述
    - 我的穿衣建议

### 2. 首页天气 UI 压缩
- 需求来源：
  - 天气模块在首页占高过大
- 最终处理：
  - 改为更紧凑的双人天气卡片
  - 名字和位置放左侧
  - 温度和图标放右侧
  - 收紧上下边距与穿衣建议高度
- 结果：
  - 首页首屏留白减少
  - 模块层级仍然清楚

---

## 三、资料页天气设置拆分为二级页面

### 1. 资料页入口收缩
- 修改文件：
  - `pages/profile/profile.js`
  - `pages/profile/profile.wxml`
  - `pages/profile/profile.wxss`
- 主要内容：
  - 删除原先嵌在“我的”页里的整块天气设置卡片
  - 在“设置”区域新增一条入口：
    - `天气设置`
  - 新增跳转方法：
    - `goWeatherSettings()`

### 2. 新增天气设置二级页
- 新增文件：
  - `pages/weather-settings/weather-settings.json`
  - `pages/weather-settings/weather-settings.js`
  - `pages/weather-settings/weather-settings.wxml`
  - `pages/weather-settings/weather-settings.wxss`
  - `pages/weather-settings/review.test.js`
- 主要内容：
  - 新页面独立展示：
    - 当前模式
    - 当前位置
    - 更新时间
  - 新页面独立提供操作：
    - `使用当前位置`
    - `手动设置区县`
- 同时在 `app.json` 中注册新页面：
  - `pages/weather-settings/weather-settings`

### 3. 这样调整后的收益
- “我的”页面显著变短
- 天气设置能力更聚焦
- 后续若要继续增加权限说明、同步说明、天气策略说明，会更容易扩展

---

## 四、图片同步问题修复

### 问题现象
- 修改头像后，对方有时看不到
- 时光相册上传图片后，对方有时看不到

### 根因
- 临时 URL 被当成正式数据写回了本地和云端
- 临时 URL 过期后，对方设备同步到的是失效地址

### 修改内容
- 修改文件：
  - `utils/storage.js`
  - `utils/storage.review.test.js`
- 主要处理：
  - 将云文件 `fileID` 与临时展示 URL 分离
  - 本地持久层只保存 `cloud://` 形式的 canonical 数据
  - 展示时按需把 `fileID` 转换为临时 URL
  - 防止展示 URL 再次回写到云端污染正式数据

---

## 五、云函数权限与数据安全修复

### 1. 权限过宽问题
- 修改文件：
  - `cloudfunctions/coupleOps/index.js`
  - `cloudfunctions/coupleOps/review.test.js`
- 修复内容：
  - `loadCouple`、`saveField`、`saveBatch`、`unbindCouple` 增加授权校验
  - 只有该情侣空间参与者才能访问对应文档
  - 删除权限进一步收紧为仅开发者可执行

### 2. 数据暴露问题
- 修复内容：
  - `findCoupleByCode`、`findCoupleByOpenid`、`findAllCouplesByOpenid` 不再向前端返回完整敏感文档
  - 仅返回必要公开字段

### 3. 恢复旧空间不稳定问题
- 修复内容：
  - 多个情侣空间记录时，改为按最新记录优先恢复
  - 不再依赖“数组第一个”这种不稳定行为

### 4. 重绑 loading 状态错误
- 修改文件：
  - `pages/setup/setup.js`
- 修复内容：
  - `confirmRebind` 失败时清理正确的 loading 状态，避免页面卡住

---

## 六、编译问题排查与恢复

### 问题现象
- 微信开发者工具报错：
  - `app.json: ["pages"][1] could not find the corresponding file: "pages/index/index.wxml"`

### 实际根因
- 不是文件真的不存在
- 而是首页模板重写过程中引入了会让微信开发者工具解析失败的内容
- 微信开发者工具把模板解析失败错误转译成了“页面文件找不到”的误导性提示

### 最终处理
- 重新整理首页模板
- 回到更稳定的页面结构
- 只保留天气卡片的紧凑改动
- 恢复编译成功

---

## 七、本次新增或修改的重点文件

### 新增
- `pages/weather-settings/weather-settings.json`
- `pages/weather-settings/weather-settings.js`
- `pages/weather-settings/weather-settings.wxml`
- `pages/weather-settings/weather-settings.wxss`
- `pages/weather-settings/review.test.js`
- `utils/weather.review.test.js`
- `utils/storage.review.test.js`
- `cloudfunctions/coupleOps/review.test.js`
- `docs/superpowers/plans/2026-05-16-weather-settings-entry.md`

### 重点修改
- `app.json`
- `utils/storage.js`
- `utils/weather.js`
- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`
- `pages/profile/profile.js`
- `pages/profile/profile.wxml`
- `pages/profile/profile.wxss`
- `pages/setup/setup.js`
- `cloudfunctions/coupleOps/index.js`
- `README.md`

---

## 八、已执行验证

### 语法检查
- `node --check utils/storage.js`
- `node --check utils/weather.js`
- `node --check pages/index/index.js`
- `node --check pages/profile/profile.js`
- `node --check pages/weather-settings/weather-settings.js`
- `node --check cloudfunctions/coupleOps/index.js`

### 回归脚本
- `node utils/storage.review.test.js`
- `node utils/weather.review.test.js`
- `node pages/weather-settings/review.test.js`
- `NODE_PATH=... node cloudfunctions/coupleOps/review.test.js`

### 配置检查
- `app.json` JSON 解析通过

---

## 九、当前状态
- 双人天气功能已接通
- 首页天气显示已压缩
- “我的”页天气设置已下沉为二级页面
- 图片同步问题已修复
- 云函数权限问题已修复
- 当前代码已恢复到可正常编译状态

---

## 十、后续建议
- 在微信开发者工具里继续做真机联调，重点验证：
  - 双方天气同步是否稳定
  - 定位失败后是否正确回退到手动位置
  - 天气设置页的交互与返回路径是否顺畅
  - 头像和相册图片跨设备显示是否持续正常
- 后续若继续做安全治理，建议把“爱心币、订单、菜单管理”这类高风险写操作继续拆成专用云函数动作，而不是完全依赖通用字段写入。

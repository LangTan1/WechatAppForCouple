# 琳浪小栈 - 情侣专属微信小程序

## 项目概述
微信原生小程序，为情侣定制的多功能生活记录应用。底部4个Tab：首页/商城/记录/我的。

## 技术栈
- 原生 WXML + WXSS + JS，无框架
- 本地存储（wx.Storage）+ 微信云开发（NoSQL数据库同步）
- 基础库 3.15.2，`es6: false`（关闭Babel转译避免babel-helper缺失）
- `lazyCodeLoading` 已移除（与Babel转译产物冲突导致defineProperty报错）
- 天气使用和风天气API（utils/weather.js），需配置API Key和API Host
- 已申请 wx.getFuzzyLocation 权限用于获取位置

## 目录结构
```
├── app.js/json/wxss          # 全局入口、TabBar配置(4Tab：首页/商城/记录/我的)
├── cloudfunctions/
│   ├── coupleOps/             # 情侣空间数据库操作云函数（管理员权限）
│   └── getOpenid/             # 获取openid云函数
├── utils/
│   ├── storage.js             # 全部数据持久化+云同步（核心模块，通过coupleOps云函数）
│   ├── weather.js             # 纯本地季节模拟天气
│   └── love-quotes.js         # 300句每日情话
├── components/card/           # 公共卡片组件
└── pages/
    ├── setup/                 # 访问控制（密钥验证+名字性别设置+邀请码绑定+Pin锁）
    ├── index/                 # 首页：天数+天气+情话+心情+纪念日+消息提醒红点+重置通知
    ├── menu/                  # 商城（双模式：使用者购物/开发者管理）
    ├── record/                # 记录入口（日记/悄悄话/相册/心情/更多）
    ├── profile/               # 我的：头像+信息+爱心币管理+成就+设置+查看邀请码
    ├── diary/                 # 恋爱日记
    ├── whisper/               # 悄悄话（气泡聊天，左右对齐，3秒轮询）
    ├── album/                 # 时光相册（云存储照片+评论+缩放预览）
    ├── anniversary/           # 纪念日
    ├── wishlist/              # 愿望清单
    ├── mood/                  # 每日心情打卡
    ├── achievement/           # 恋爱成就（25个成就·4等级）
    ├── angry/                 # 气气本（记录生气瞬间）
    ├── reflection/            # 醒醒贴（自我反省）
    └── learn/                 # 学学好（记录好习惯）
```

## 双角色体系
- **开发者**：通过 devKey（默认`langdev520`）进入。拥有商品管理、订单处理、发币/扣币等权限
- **使用者**：通过邀请码绑定进入。购物、许愿、充值申请
- 角色通过 `storage.getCurrentRole()` 判断
- **角色不可切换**：使用者不能切换到开发者，开发者不能切换到使用者
- 开发者"我的"页有"重新设置"和"查看邀请码"，使用者有"重新绑定"
- 查看邀请码：读取本地缓存的 `last_invite_code`，支持一键复制到剪贴板

## 通用名字+性别体系
- 双方各自输入自己的名字和性别（🧑男/👩女），不再硬编码"浪/琳琳"
- 本地存储：`my_name`/`partner_name`，`my_gender`/`partner_gender`
- 云字段：`devName`/`userName`，`devGender`/`userGender`
- 角色感知映射：dev设备 `my_name`→`devName`，user设备 `my_name`→`userName`
- `_syncCloudToLocal` 只同步对方的名字/性别，不覆盖自己的
- 性别决定默认头像emoji：男→🧑，女→👩
- 双方都可在"我的"页修改自己的昵称，修改后自动同步到云端

## 云同步架构
### 技术实现
- 微信云开发环境：`cloud1-d0gzs51l9cbf4b9bc`
- 云数据库集合：`couples`（单文档存储所有共享数据）
- 数据库安全规则：`"read": "auth != null", "write": "auth != null"`（所有已登录用户可读写）
- **所有跨设备数据库操作通过云函数 `coupleOps` 执行**（管理员权限，绕过安全规则）

### 云函数 coupleOps
- 位置：`cloudfunctions/coupleOps/`
- 通过 `wx.cloud.callFunction({ name: 'coupleOps', data: { action, ... } })` 调用
- openid 从服务端 `wxContext.OPENID` 获取，不依赖客户端传参
- 支持操作：`createCouple`、`bindCouple`、`loadCouple`、`saveField`、`saveBatch`、`findCoupleByOpenid`、`unbindCouple`

### 绑定流程
1. **创建者**：输入开发者密钥→输入名字+性别+日期→创建云端文档→生成6位邀请码
2. **加入者**：点击「我有邀请码」→输入名字+性别+邀请码→绑定成功

### 数据同步机制
- `set()`函数自动同步：修改本地storage时，自动fire-and-forget写入云端
- `_syncingFromCloud`标志：防止云端→本地→云端回环
- **轮询同步**：首页/商城每5秒、悄悄话每3秒自动 `loadFromCloud`
- `_syncCloudToLocal`：角色感知映射，只同步对方数据不覆盖自己的

### 重置流程
- **只有开发者可以重置**：开发者"重新设置"→删除云端文档→清除本地→回到初始界面
- 使用者"重新绑定"：清除本地 `couple_doc_id` + `last_role` → 进入邀请码输入界面
- 使用者检测失效：首页轮询时 `loadFromCloud` 失败 + `couple_doc_id` 被清除 → 弹窗提示"对方已重置" → 跳转绑定页

### 关键函数（storage.js，全部通过云函数coupleOps执行）
- `createCouple(openid, info)`：创建情侣文档，info含devName/devGender/togetherDate
- `bindCouple(inviteCode, userName, userGender)`：绑定对方（openid由云函数从服务端获取）
- `loadFromCloud()`：从云端加载，验证inviteCode字段，失败时清除本地绑定
- `saveToCloud(storageKey, value)`：角色感知的单字段云同步
- `saveBatchToCloud(updates)`：批量保存多个字段到云端
- `unbindCouple()`：删除云端文档+清除本地绑定
- `getMyName()/setMyName()/getPartnerName()/setPartnerName()`
- `getMyGender()/setMyGender()/getPartnerGender()/setPartnerGender()`
- `getLastViewTimestamps()/updateLastView(type)`：消息提醒系统

## 商城系统（原菜单）
### 三级分类结构
- 一级分类：🍽️食品 / 🍎水果 / 💑情侣互动
- 食品二级分类：正餐 / 甜品 / 小吃
- 情侣互动二级分类：居家服务 / 约会活动 / 甜蜜亲密
- 水果：直接显示商品列表

### 默认商品（始终显示，删除后自动恢复）
- 正餐（10种）：家常菜、火锅、烤肉、西餐、日料、披萨、汉堡、面条、炒饭、麻辣烫
- 甜品（5种）：蛋糕、奶茶、冰淇淋、布丁、巧克力
- 小吃（5种）：炸鸡、薯条、烤串、关东煮、糖葫芦
- 水果（10种）：苹果、香蕉、葡萄、西瓜、草莓、樱桃、桃子、芒果、菠萝、橙子
- 居家服务（5种）：做饭、洗碗、打扫卫生、洗衣服、按摩服务
- 约会活动（5种）：陪看电影、陪逛街、陪散步、陪玩游戏、陪旅行
- 甜蜜亲密（5种）：亲亲、抱抱、说爱你、撒娇、哄你睡觉

### 使用者模式
- 一级Tab切换（食品/水果/情侣互动），食品和情侣互动有二级Tab
- 点餐扣币，帮我决定（随机选择，仅食品）
- 许愿功能（所有分类可用）
- 负价格商品：不扣币，提交订单给开发者，确认后发放爱心币
- 我的订单：查看状态(pending/cooking/done/rejected)

### 开发者模式
- Tab「商品管理」：按分类添加/编辑/删除商品，价格-9999~9999，支持负数（用户拍下后开发者确认发放爱心币）
- 价格输入使用 `type="text"` 键盘（允许输入负号 `-`）
- Tab「订单队列」：接受→标记完成。负价格订单显示"确认发放💖"
- Tab「请求处理」：食物许愿+充值请求

### 订单红点
- 开发者：新订单数(pending)
- 使用者：进行中(pending+cooking)
- TabBar红点：`wx.setTabBarBadge({index:1})`

## 爱心币系统
- 存储：`girl_coins`（使用者余额），双方都读取此值
- 开发者管理：自由输入数值+增加/减少切换+留言，200以上二次确认
- 交易记录：`coin_transactions` 存储历史，含金额/类型/留言/操作人/时间
- 使用者可查看最近5条交易记录及留言
- 充值申请：使用者填写币数+交换条件→开发者审批

## 消息提醒系统（首页红点）
- `last_view_timestamps`：记录各模块最后查看时间
- 检测对方新内容：日记/悄悄话/订单/愿望/心情
- 红点显示在首页"今天想…"三个按钮和心情卡片上
- 进入对应子页面时 `updateLastView()` 清除红点
- 子页面 `onShow` 自动清除对应红点

## 悄悄话
- 气泡聊天式：对方消息靠左白色，自己消息靠右粉色
- 时间显示在气泡上方（5分钟内连续消息不重复显示）
- 发送者名字在气泡下方
- 3秒轮询自动刷新，键盘弹出自适应滚动到底部

## 时光相册
- 照片上传到微信云存储（`wx.cloud.uploadFile`），存储fileID
- 支持双指缩放预览（`movable-area` + `movable-view`）
- 照片评论功能：评论存在照片的 `comments` 数组中，随相册同步

## 头像系统
- 头像上传到微信云存储（`wx.cloud.uploadFile`），存储 cloud fileID（如 `cloud://xxx/avatars/my_xxx.jpg`）
- cloud fileID 全局可访问，任何设备都能加载，解决本地临时路径跨设备不可用的问题
- 同步到云端的是 fileID 而非本地路径，对方设备可正常显示
- `<image src="cloudFileID">` 原生支持 cloud fileID，无需额外处理

## 心情打卡系统
- 5种心情：😊开心/🥰甜蜜/😌平静/😢难过/😤生气
- 数据结构：`{ id, role, date, mood, note, time, createdAt }`
- 首页心情卡片显示双方实际昵称（非"我/TA"）

## 恋爱成就系统
- 4等级：🥉铜7/🥈银11/🥇金6/💎铂1
- 成就定义在 `pages/achievement/achievement.js`，运行时状态存storage
- `unlockAchievement(id)` 幂等解锁

## Storage Key 清单（38个）
角色/身份：`setup_done`, `dev_key`, `user_key`, `current_role`, `last_role`, `lock_enabled`, `lock_pin`
情侣信息：`together_date`, `my_name`, `partner_name`, `my_avatar`, `partner_avatar`, `my_gender`, `partner_gender`, `boy_coins`, `girl_coins`
功能数据：`custom_diaries`, `custom_whispers`, `custom_wishes`, `custom_anniversaries`, `custom_menu_items`, `custom_album`, `custom_moods`, `custom_achievements`, `custom_angry`, `custom_reflection`, `custom_learn`
订单系统：`order_queue`, `food_requests`, `coin_requests`, `order_total_count`, `coin_transactions`
云同步：`couple_doc_id`
其他：`last_quote_date`, `last_quote_index`, `weather_cache`, `last_view_timestamps`, `last_invite_code`

## 云字段映射
静态映射（CLOUD_FIELDS）：`together_date`→`togetherDate`, `boy_coins`→`devCoins`, `girl_coins`→`userCoins`, `custom_menu_items`→`menuItems`, `custom_diaries`→`diaries`, `custom_whispers`→`whispers`, `custom_wishes`→`wishes`, `custom_anniversaries`→`anniversaries`, `custom_album`→`albums`, `custom_moods`→`moods`, `custom_achievements`→`achievements`, `order_queue`→`orderQueue`, `food_requests`→`foodRequests`, `coin_requests`→`coinRequests`, `order_total_count`→`orderTotalCount`, `coin_transactions`→`coinTransactions`, `custom_angry`→`angry`, `custom_reflection`→`reflection`, `custom_learn`→`learn`
角色感知映射（`_getCloudFieldFor`）：`my_name`↔`devName`/`userName`, `partner_name`↔`userName`/`devName`, `my_avatar`↔`devAvatar`/`userAvatar`, `my_gender`↔`devGender`/`userGender`

## 注意事项
- 微信隐私限制：无法通过 openid 读取对方的微信昵称/头像，只能靠用户自己填写的名字识别身份
- 所有弹窗使用 `catchtap="noop"` + JS中 `noop(){}` 阻止穿透
- storage.js 是唯一数据源
- 成就定义常量在 achievement.js 中，不存storage
- 天气缓存30分钟，但名字始终读最新值
- 悄悄话/首页/商城有自动轮询，onHide/onUnload时停止
- 实时天气使用和风天气API，需在 `utils/weather.js` 中配置 `QWEATHER_KEY` 和 `QWEATHER_HOST`
- app.json 中需声明 `wx.getFuzzyLocation` 权限和 `requiredPrivateInfos`

## 断线恢复机制
### 根因
`loadFromCloud` 原先在任何错误时都清除 `couple_doc_id`，导致网络临时故障（如冷启动）时绑定丢失，用户被迫重新输入密钥/邀请码。

### 修复策略
- **loadFromCloud**：仅在文档确认被删除（errCode=-1 或 errMsg含"not exist"）时清除绑定，网络错误保留 `couple_doc_id`
- **onLoad 重试**：`loadFromCloud` 失败后等1.5秒重试，重试仍失败但 `couple_doc_id` 存在时用本地数据正常进入
- **邀请码本地缓存**：绑定成功后保存 `last_invite_code`，用于断线恢复
- **用户恢复（rebind）**：`setup_done` 为 true 但 `couple_doc_id` 丢失且有本地名字时，显示简化恢复界面（预填邀请码+已有名字性别），无需重填全部信息
- **开发者恢复**：`_createCoupleIfNeeded` 先通过 `findCoupleByOpenid` 查找云端已有文档，找到则恢复绑定而非创建新文档，防止开发者因网络错误创建重复空间导致使用者被孤立

### 关键函数
- `findCoupleByOpenid(openid)`：按 devOpenid 查询云端已有情侣文档
- `getLastInviteCode() / setLastInviteCode(code)`：邀请码本地缓存
- `_afterCloudLoaded()`：云端加载成功后的统一处理
- `_enterAfterCloudFail()`：网络失败但绑定保留时的降级进入
- `confirmRebind()`：用户确认恢复绑定
- `showFullBindInput()`：用户切换到完整绑定界面（新邀请码）

## 部署注意事项
- `cloudfunctions/coupleOps` 需要在微信开发者工具中右键→上传并部署（云端安装依赖）
- `couples` 集合安全规则需设为 `"read": "auth != null", "write": "auth != null"`

## 已知待修复问题
（暂无）

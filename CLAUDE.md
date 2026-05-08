# 琳浪小栈 - 情侣专属微信小程序

## 项目概述
微信原生小程序，为情侣（浪 & 琳琳）定制的多功能生活记录应用。底部4个Tab：首页/菜单/记录/我的。

## 技术栈
- 原生 WXML + WXSS + JS，无框架
- 本地存储（wx.Storage）+ 微信云开发（NoSQL数据库同步）
- 基础库 3.15.2，`es6: false`（关闭Babel转译避免babel-helper缺失）
- `lazyCodeLoading` 已移除（与Babel转译产物冲突导致defineProperty报错）
- 禁止使用 wx.request / wx.getLocation / wx.getFuzzyLocation（均无权限/会超时）
- 天气使用纯本地季节模拟（utils/weather.js），无网络调用

## 目录结构
```
├── app.js/json/wxss          # 全局入口、TabBar配置(4Tab)、全局样式
├── project.config.json        # es6:false, urlCheck:true, cloudfunctionRoot:cloudfunctions/
├── cloudfunctions/
│   └── getOpenid/             # 云函数：获取用户openid（备用方案，主要用数据库方式）
├── utils/
│   ├── storage.js             # 全部数据持久化+云同步（核心模块，30+key，60+函数）
│   ├── weather.js             # 纯本地季节模拟天气
│   └── love-quotes.js         # 300句每日情话
├── components/card/           # 公共卡片组件（index/profile/record/wishlist/mood/achievement使用）
└── pages/
    ├── setup/                 # 访问控制（首次密钥验证+信息设置+Pin锁+邀请码绑定）
    ├── index/                 # 首页：天数+天气+情话+心情状态+纪念日提醒+菜单入口+动态
    ├── menu/                  # 菜单（双模式：使用者点餐 / 开发者管理）
    ├── record/                # 记录入口（5个子功能导航：日记/悄悄话/相册/心情/更多）
    ├── profile/               # 我的：头像+信息+爱心币+成就摘要+设置+角色切换
    ├── diary/                 # 恋爱日记（列表+新增）
    ├── whisper/               # 悄悄话（气泡聊天式留言板）
    ├── album/                 # 时光相册（二级：相册列表→照片网格+描述）
    ├── anniversary/           # 纪念日（CRUD+倒计时+在一起天数可设）
    ├── wishlist/              # 愿望清单（进度条+勾选）
    ├── mood/                  # 每日心情打卡（5种emoji+备注+对方心情+7天历史）
    └── achievement/           # 恋爱成就（25个成就·4等级徽章+进度条+等级筛选）
```

## 双角色体系
- **开发者（浪）**：通过 devKey（默认`langdev520`）进入。拥有菜单管理、订单处理、发币、密钥管理等权限
- **使用者（琳琳）**：通过邀请码绑定进入。点餐、许愿、充值申请
- 角色通过 `storage.getCurrentRole()` 判断，页面不再显示角色标签
- 角色切换：我的页→切换角色→输入对应密钥

## 云同步架构（情侣绑定+数据互通）
### 技术实现
- 微信云开发环境：`cloud1-d0gzs51l9cbf4b9bc`
- 云数据库集合：`couples`（单文档存储所有共享数据）
- openid获取：优先云函数`getOpenid`，失败时用云数据库写入再读取`_openid`字段

### 绑定流程
1. **创建者（浪）**：输入开发者密钥→设置情侣信息→创建云端文档→生成6位邀请码
2. **加入者（琳琳）**：打开小程序→点击「我有邀请码」→输入邀请码→绑定成功

### 数据同步机制
- `set()`函数自动同步：修改本地storage时，自动fire-and-forget写入云端
- `_syncingFromCloud`标志：防止云端→本地→云端回环
- `syncFromCloud()`：各页面onShow时调用，从云端加载最新数据到本地
- `createCouple()`：用本地数据初始化云端文档（非空数组）

### 关键函数（storage.js）
- `createCouple(openid, info)`：创建情侣文档，返回{docId, inviteCode}
- `bindCouple(inviteCode, openid)`：绑定对方，同步云端数据到本地
- `loadFromCloud()`：从云端加载数据到本地缓存
- `saveToCloud(storageKey, value)`：保存单个字段到云端
- `saveBatchToCloud(updates)`：批量保存到云端
- `getCoupleDocId()`：获取当前绑定的情侣文档ID
- `generateInviteCode()`：生成6位随机邀请码（大写字母+数字，排除易混淆字符）

### 云字段映射（CLOUD_FIELDS）
storage key → cloud field：
`together_date`→`togetherDate`, `boy_name`→`boyName`, `girl_name`→`girlName`,
`boy_avatar`→`boyAvatar`, `girl_avatar`→`girlAvatar`, `boy_coins`→`boyCoins`, `girl_coins`→`girlCoins`,
`custom_menu_items`→`menuItems`, `custom_anniversaries`→`anniversaries`, `custom_diaries`→`diaries`,
`custom_whispers`→`whispers`, `custom_wishes`→`wishes`, `custom_album`→`albums`,
`custom_moods`→`moods`, `custom_achievements`→`achievements`,
`order_queue`→`orderQueue`, `food_requests`→`foodRequests`, `coin_requests`→`coinRequests`,
`order_total_count`→`orderTotalCount`

## 菜单双模式架构（核心复杂模块）
### 使用者模式（menu.js loadUserData）
- 子Tab「菜单」：分类浏览(正餐/甜品/小吃)→点餐(扣币)→帮我决定(随机)
- 子Tab「我的订单」：查看所有订单状态(pending/cooking/done/rejected)
- 许愿食物→自动加入订单队列
- 充值申请→填写币数+交换条件→发给浪审批

### 开发者模式（menu.js loadDevData）
- Tab「菜单管理」：按分类添加/编辑/删除菜品，设置价格上架
- Tab「订单队列」：查看待处理订单→接受(→cooking→标记完成)或拒绝(弹窗填原因)
- Tab「请求处理」：处理食物许愿(定价上架/拒绝)+充值请求(批准/拒绝)
- 订单红点：dev=新订单数(pending)，user=进行中(pending+cooking)
- TabBar红点：`wx.setTabBarBadge({index:1})` 菜单栏显示数字
- 历史清理：手动「清除历史」按钮 + 每2天自动清理done/rejected

## 关键数据流
- **爱心币**：`storage.getGirlCoins()/setGirlCoins()` 琳琳余额，开发者发放
- **订单队列**：`storage.addOrder()` → `getOrderQueue()`，含status/createdAt/rejectReason，自动递增`incrementOrderTotalCount()`
- **食物请求**：`storage.addFoodRequest()` → 开发者定价→上架
- **充值请求**：`storage.addCoinRequest()` → 开发者审批
- **纪念日**：首页5天内到期提醒，CRUD在anniversary页
- **天气**：`getSeasonalWeather()` 按月份模拟中国气温，显示双方+穿衣建议
- **每日心情**：`storage.getMoods()/setMoods()` → 按role+date去重，每人每天限一次。首页显示双方今日emoji，7天历史在mood页
- **恋爱成就**：`storage.getAchievements()/unlockAchievement(id)` 幂等解锁。25个成就分4等级（🥉铜7/🥈银11/🥇金6/💎铂1），成就页onShow自动检测条件，个人页显示徽章统计

## 心情打卡系统
- 5种心情：😊开心/🥰甜蜜/😌平静/😢难过/😤生气
- 数据结构：`{ id, role, date:'YYYY-MM-DD', mood, note, time }`
- 入口：记录页→每日心情 / 首页心情状态卡
- 伴侣可见：`getPartnerTodayMood()` 查对方今日心情
- 辅助函数：`_todayStr()/_formatDate(dt)` 日期格式化

## 恋爱成就系统
- 4等级徽章：🥉铜牌(入门)/🥈银牌(进阶)/🥇金牌(精通)/💎铂金(传奇)
- 成就定义常量在 `pages/achievement/achievement.js`，运行时状态存storage
- 自动检测条件：日记/悄悄话/相册/愿望/纪念日/订单累计/天数/心情联动/连续打卡/全功能使用
- `unlockAchievement(id)` 幂等：已解锁返回false，新解锁返回true
- 累计订单计数 `getOrderTotalCount()` 不受自动清理影响
- 等级筛选：成就页支持按铜/银/金/铂金过滤

## 已知修复记录
1. `catchtap="{{}}"` → `catchtap="noop"`（弹窗点击穿透bug）
2. `data-status="'cooking'"` → `data-status="cooking"`（引号导致状态匹配失败）
3. 空CSS规则集 `.key-info {}` 已删除
4. `lazyCodeLoading` 已移除（Babel helper缺失）
5. wx.request/wx.getLocation/wx.getFuzzyLocation 全部移除（无权限/超时）
6. `urlCheck:false` 在 project.private.config.json（开发阶段跳过域名校验）
7. 云函数`getOpenid`部署问题：改用云数据库写入再读取`_openid`字段获取openid
8. `saveToCloud`从未被调用：修改`set()`函数自动同步已变更字段到云端
9. `createCouple()`用空数组初始化云端文档：改为用本地数据初始化
10. `_syncCloudToLocal`缺少防回环标志：添加`_syncingFromCloud`标志
11. 对方设备无法直接输入邀请码：在dev_key步骤添加「我有邀请码」入口

## Storage Key 清单（31个）
角色/身份：`setup_done`, `dev_key`, `user_key`, `current_role`, `lock_enabled`, `lock_pin`
情侣信息：`together_date`, `boy_name`, `girl_name`, `boy_avatar`, `girl_avatar`, `boy_coins`, `girl_coins`
功能数据：`custom_diaries`, `custom_whispers`, `custom_wishes`, `custom_anniversaries`, `custom_menu_items`, `custom_album`, `custom_moods`, `custom_achievements`
订单系统：`order_queue`, `food_requests`, `coin_requests`, `order_total_count`
云同步：`couple_doc_id`（当前绑定的情侣文档ID）
其他：`last_quote_date`, `last_quote_index`, `weather_cache`

## 注意事项
- 所有弹窗使用 `catchtap="noop"` + JS中 `noop(){}` 阻止穿透
- storage.js 是唯一数据源，旧mock.js仅保留参考
- 修改角色需 `wx.reLaunch` 重载页面
- 相册旧数据自动迁移到默认相册
- 不要添加任何网络请求API调用
- 成就定义常量在 achievement.js 中，不存storage；运行时状态（id/unlocked/unlockedAt）存storage
- 云同步已实现，当前状态：代码就绪，等待双设备测试验证绑定和数据互通

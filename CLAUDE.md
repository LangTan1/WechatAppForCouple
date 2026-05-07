# 琳浪小栈 - 情侣专属微信小程序

## 项目概述
微信原生小程序，为情侣（浪 & 琳琳）定制的多功能生活记录应用。底部4个Tab：首页/菜单/记录/我的。

## 技术栈
- 原生 WXML + WXSS + JS，无框架
- 数据全部本地存储（wx.Storage），无后端
- 基础库 3.15.2，`es6: false`（关闭Babel转译避免babel-helper缺失）
- `lazyCodeLoading` 已移除（与Babel转译产物冲突导致defineProperty报错）
- 禁止使用 wx.request / wx.getLocation / wx.getFuzzyLocation（均无权限/会超时）
- 天气使用纯本地季节模拟（utils/weather.js），无网络调用

## 目录结构
```
├── app.js/json/wxss          # 全局入口、TabBar配置(4Tab)、全局样式
├── project.config.json        # es6:false, urlCheck:true
├── utils/
│   ├── storage.js             # 全部数据持久化（核心模块）
│   ├── weather.js             # 纯本地季节模拟天气
│   └── love-quotes.js         # 300句每日情话
├── components/card/           # 公共卡片组件（仅index/profile/record/wishlist使用）
└── pages/
    ├── setup/                 # 访问控制（首次密钥验证+信息设置+Pin锁解锁）
    ├── index/                 # 首页：天数+天气+情话+纪念日提醒+菜单入口+动态
    ├── menu/                  # 菜单（双模式：使用者点餐 / 开发者管理）
    ├── record/                # 记录入口（3个子功能导航）
    ├── profile/               # 我的：头像+信息+爱心币+设置+角色切换
    ├── diary/                 # 恋爱日记（列表+新增）
    ├── whisper/               # 悄悄话（气泡聊天式留言板）
    ├── album/                 # 时光相册（二级：相册列表→照片网格+描述）
    ├── anniversary/           # 纪念日（CRUD+倒计时+在一起天数可设）
    └── wishlist/              # 愿望清单（进度条+勾选）
```

## 双角色体系
- **开发者（浪）**：通过 devKey（默认`langdev520`）进入。拥有菜单管理、订单处理、发币、密钥管理等权限
- **使用者（琳琳）**：通过 userKey（浪在初始化时设置）进入。点餐、许愿、充值申请
- 角色通过 `storage.getCurrentRole()` 判断，页面不再显示角色标签
- 角色切换：我的页→切换角色→输入对应密钥

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
- **订单队列**：`storage.addOrder()` → `getOrderQueue()`，含status/createdAt/rejectReason
- **食物请求**：`storage.addFoodRequest()` → 开发者定价→上架
- **充值请求**：`storage.addCoinRequest()` → 开发者审批
- **纪念日**：首页5天内到期提醒，CRUD在anniversary页
- **天气**：`getSeasonalWeather()` 按月份模拟中国气温，显示双方+穿衣建议

## 已知修复记录
1. `catchtap="{{}}"` → `catchtap="noop"`（弹窗点击穿透bug）
2. `data-status="'cooking'"` → `data-status="cooking"`（引号导致状态匹配失败）
3. 空CSS规则集 `.key-info {}` 已删除
4. `lazyCodeLoading` 已移除（Babel helper缺失）
5. wx.request/wx.getLocation/wx.getFuzzyLocation 全部移除（无权限/超时）
6. `urlCheck:false` 在 project.private.config.json（开发阶段跳过域名校验）

## 注意事项
- 所有弹窗使用 `catchtap="noop"` + JS中 `noop(){}` 阻止穿透
- storage.js 是唯一数据源，旧mock.js仅保留参考
- 修改角色需 `wx.reLaunch` 重载页面
- 相册旧数据自动迁移到默认相册
- 不要添加任何网络请求API调用

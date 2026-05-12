const storage = require('../../utils/storage');

Page({
  data: {
    isDev: false,
    // 一级分类
    topCategories: [
      { key: 'food', name: '食品', icon: '🍽️' },
      { key: 'fruit', name: '水果', icon: '🍎' },
      { key: 'other', name: '情侣互动', icon: '💑' },
    ],
    currentTopTab: 'food',
    // 食品下的二级分类
    categories: [
      { key: 'meal', name: '正餐', icon: '🍚' },
      { key: 'drink', name: '甜品', icon: '🧋' },
      { key: 'snack', name: '小吃', icon: '🌙' },
    ],
    categoryNames: ['正餐', '甜品', '小吃'],
    categoryKeys: ['meal', 'drink', 'snack'],
    currentTab: 'meal',
    // 情侣互动下的二级分类
    otherCategories: [
      { key: 'housework', name: '居家服务', icon: '🏠' },
      { key: 'date', name: '约会活动', icon: '🎬' },
      { key: 'intimate', name: '甜蜜亲密', icon: '💕' },
    ],
    otherCategoryNames: ['居家服务', '约会活动', '甜蜜亲密'],
    otherCategoryKeys: ['housework', 'date', 'intimate'],
    currentOtherTab: 'housework',
    myCoins: 0,

    // ===== 使用者 =====
    userTab: 'menu',        // menu | orders
    foodItems: [],
    userOrders: [],
    activeOrderCount: 0,
    orderItem: null,
    randomResult: null,
    showRechargeModal: false,
    rechargeAmount: '10',
    rechargeItem: '',
    showFoodRequestModal: false,
    foodReqName: '',
    foodReqEmoji: '',

    // ===== 开发者 =====
    devTabs: [
      { key: 'menu', label: '商品管理' },
      { key: 'orders', label: '订单队列' },
      { key: 'requests', label: '请求处理' },
    ],
    devTab: 'menu',
    allFoodItems: [],
    devFoodItems: [],
    orderCount: 0,
    requestCount: 0,
    pendingOrders: [],
    doneOrders: [],
    foodRequests: [],
    coinRequests: [],
    showFoodModal: false,
    editingFood: null,
    foodForm: { name: '', emoji: '', catIdx: 0, price: '5' },
    showRejectModal: false,
    rejectOrderId: 0,
    rejectReason: ''
  },

  _pollTimer: null,

  onLoad() { this.init(); },
  onShow() {
    this.init();
    this.syncFromCloud();
    storage.updateLastView('order');
    this._startPolling();
  },
  onHide() { this._stopPolling(); },
  onUnload() { this._stopPolling(); },

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => { this.syncFromCloud(); }, 5000);
  },
  _stopPolling() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.init();
  },

  init() {
    const isDev = storage.isDeveloper();
    this.setData({ isDev });
    this.autoCleanOldOrders();
    if (isDev) {
      this.loadDevData();
    } else {
      this.loadUserData();
    }
    this.updateTabBadge();
  },

  // 自动清除 2 天前的已完成/已拒绝订单
  autoCleanOldOrders() {
    const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - TWO_DAYS;
    let orders = storage.getOrderQueue();
    const cleaned = orders.filter(o => {
      if (o.status === 'done' || o.status === 'rejected') {
        // 有 createdAt 则用它，否则用 id（Date.now() 生成的）
        const ts = o.createdAt || o.id;
        return ts > cutoff; // 保留 2 天内的
      }
      return true; // pending/cooking 不清理
    });
    if (cleaned.length !== orders.length) {
      storage.setOrderQueue(cleaned);
    }
  },

  // 手动清除所有已完成/已拒绝的历史订单
  clearHistory() {
    let orders = storage.getOrderQueue();
    orders = orders.filter(o => o.status === 'pending' || o.status === 'cooking');
    storage.setOrderQueue(orders);
    if (this.data.isDev) {
      this.loadDevData();
    } else {
      this.loadUserData();
    }
    this.updateTabBadge();
    wx.removeTabBarBadge({ index: 1 });
    wx.showToast({ title: '历史已清除', icon: 'none' });
  },

  // 更新 TabBar 红点
  updateTabBadge() {
    const orders = storage.getOrderQueue();
    let count = 0;
    if (this.data.isDev) {
      // 开发者：待处理新订单数
      count = orders.filter(o => o.status === 'pending').length;
    } else {
      // 使用者：进行中的订单数（pending + cooking）
      count = orders.filter(o => o.status === 'pending' || o.status === 'cooking').length;
    }
    if (count > 0) {
      wx.setTabBarBadge({ index: 1, text: String(count) });
    } else {
      wx.removeTabBarBadge({ index: 1 });
    }
  },

  // ==================== 使用者 ====================
  // 确保默认商品存在
  ensureDefaultItems() {
    const allItems = storage.getMenuItems();
    const defaultItems = [
      // 正餐
      { id: 1, name: '家常菜', emoji: '🥘', topCategory: 'food', category: 'meal', price: 25, published: true, addedBy: 'dev' },
      { id: 2, name: '火锅', emoji: '🍲', topCategory: 'food', category: 'meal', price: 50, published: true, addedBy: 'dev' },
      { id: 3, name: '烤肉', emoji: '🥩', topCategory: 'food', category: 'meal', price: 45, published: true, addedBy: 'dev' },
      { id: 4, name: '西餐', emoji: '🍝', topCategory: 'food', category: 'meal', price: 40, published: true, addedBy: 'dev' },
      { id: 5, name: '日料', emoji: '🍣', topCategory: 'food', category: 'meal', price: 55, published: true, addedBy: 'dev' },
      { id: 6, name: '披萨', emoji: '🍕', topCategory: 'food', category: 'meal', price: 30, published: true, addedBy: 'dev' },
      { id: 7, name: '汉堡', emoji: '🍔', topCategory: 'food', category: 'meal', price: 20, published: true, addedBy: 'dev' },
      { id: 8, name: '面条', emoji: '🍜', topCategory: 'food', category: 'meal', price: 15, published: true, addedBy: 'dev' },
      { id: 9, name: '炒饭', emoji: '🍛', topCategory: 'food', category: 'meal', price: 12, published: true, addedBy: 'dev' },
      { id: 10, name: '麻辣烫', emoji: '🌶️', topCategory: 'food', category: 'meal', price: 20, published: true, addedBy: 'dev' },
      // 甜品
      { id: 101, name: '蛋糕', emoji: '🎂', topCategory: 'food', category: 'drink', price: 25, published: true, addedBy: 'dev' },
      { id: 102, name: '奶茶', emoji: '🧋', topCategory: 'food', category: 'drink', price: 12, published: true, addedBy: 'dev' },
      { id: 103, name: '冰淇淋', emoji: '🍦', topCategory: 'food', category: 'drink', price: 10, published: true, addedBy: 'dev' },
      { id: 104, name: '布丁', emoji: '🍮', topCategory: 'food', category: 'drink', price: 8, published: true, addedBy: 'dev' },
      { id: 105, name: '巧克力', emoji: '🍫', topCategory: 'food', category: 'drink', price: 15, published: true, addedBy: 'dev' },
      // 小吃
      { id: 201, name: '炸鸡', emoji: '🍗', topCategory: 'food', category: 'snack', price: 18, published: true, addedBy: 'dev' },
      { id: 202, name: '薯条', emoji: '🍟', topCategory: 'food', category: 'snack', price: 10, published: true, addedBy: 'dev' },
      { id: 203, name: '烤串', emoji: '🍢', topCategory: 'food', category: 'snack', price: 15, published: true, addedBy: 'dev' },
      { id: 204, name: '关东煮', emoji: '🥘', topCategory: 'food', category: 'snack', price: 12, published: true, addedBy: 'dev' },
      { id: 205, name: '糖葫芦', emoji: '🍡', topCategory: 'food', category: 'snack', price: 8, published: true, addedBy: 'dev' },
      // 水果
      { id: 1001, name: '苹果', emoji: '🍎', topCategory: 'fruit', category: 'fruit', price: 3, published: true, addedBy: 'dev' },
      { id: 1002, name: '香蕉', emoji: '🍌', topCategory: 'fruit', category: 'fruit', price: 3, published: true, addedBy: 'dev' },
      { id: 1003, name: '葡萄', emoji: '🍇', topCategory: 'fruit', category: 'fruit', price: 4, published: true, addedBy: 'dev' },
      { id: 1004, name: '西瓜', emoji: '🍉', topCategory: 'fruit', category: 'fruit', price: 5, published: true, addedBy: 'dev' },
      { id: 1005, name: '草莓', emoji: '🍓', topCategory: 'fruit', category: 'fruit', price: 6, published: true, addedBy: 'dev' },
      { id: 1006, name: '樱桃', emoji: '🍒', topCategory: 'fruit', category: 'fruit', price: 6, published: true, addedBy: 'dev' },
      { id: 1007, name: '桃子', emoji: '🍑', topCategory: 'fruit', category: 'fruit', price: 4, published: true, addedBy: 'dev' },
      { id: 1008, name: '芒果', emoji: '🥭', topCategory: 'fruit', category: 'fruit', price: 5, published: true, addedBy: 'dev' },
      { id: 1009, name: '菠萝', emoji: '🍍', topCategory: 'fruit', category: 'fruit', price: 5, published: true, addedBy: 'dev' },
      { id: 1010, name: '橙子', emoji: '🍊', topCategory: 'fruit', category: 'fruit', price: 3, published: true, addedBy: 'dev' },
      // 情侣互动 - 居家服务
      { id: 2001, name: '做饭一次', emoji: '🍳', topCategory: 'other', category: 'housework', price: 20, published: true, addedBy: 'dev' },
      { id: 2002, name: '洗碗一次', emoji: '🍽️', topCategory: 'other', category: 'housework', price: 10, published: true, addedBy: 'dev' },
      { id: 2003, name: '打扫卫生', emoji: '🧹', topCategory: 'other', category: 'housework', price: 15, published: true, addedBy: 'dev' },
      { id: 2004, name: '洗衣服', emoji: '👕', topCategory: 'other', category: 'housework', price: 10, published: true, addedBy: 'dev' },
      { id: 2005, name: '按摩服务', emoji: '💆', topCategory: 'other', category: 'housework', price: 15, published: true, addedBy: 'dev' },
      // 情侣互动 - 约会活动
      { id: 2011, name: '陪看电影', emoji: '🎬', topCategory: 'other', category: 'date', price: 12, published: true, addedBy: 'dev' },
      { id: 2012, name: '陪逛街', emoji: '🛍️', topCategory: 'other', category: 'date', price: 15, published: true, addedBy: 'dev' },
      { id: 2013, name: '陪散步', emoji: '🚶', topCategory: 'other', category: 'date', price: 8, published: true, addedBy: 'dev' },
      { id: 2014, name: '陪玩游戏', emoji: '🎮', topCategory: 'other', category: 'date', price: 10, published: true, addedBy: 'dev' },
      { id: 2015, name: '陪旅行', emoji: '✈️', topCategory: 'other', category: 'date', price: 30, published: true, addedBy: 'dev' },
      // 情侣互动 - 甜蜜亲密
      { id: 2021, name: '亲亲一次', emoji: '💋', topCategory: 'other', category: 'intimate', price: 10, published: true, addedBy: 'dev' },
      { id: 2022, name: '抱抱一次', emoji: '🤗', topCategory: 'other', category: 'intimate', price: 8, published: true, addedBy: 'dev' },
      { id: 2023, name: '说爱你', emoji: '💕', topCategory: 'other', category: 'intimate', price: 5, published: true, addedBy: 'dev' },
      { id: 2024, name: '撒娇一次', emoji: '🥺', topCategory: 'other', category: 'intimate', price: 12, published: true, addedBy: 'dev' },
      { id: 2025, name: '哄你睡觉', emoji: '😴', topCategory: 'other', category: 'intimate', price: 15, published: true, addedBy: 'dev' },
    ];

    // 检查哪些默认商品需要添加
    const existingIds = allItems.map(item => item.id);
    const missingDefaults = defaultItems.filter(item => !existingIds.includes(item.id));

    if (missingDefaults.length > 0) {
      const updatedItems = [...allItems, ...missingDefaults];
      storage.setMenuItems(updatedItems);
      return updatedItems;
    }

    return allItems;
  },

  loadUserData() {
    const allItems = this.ensureDefaultItems();
    const published = allItems.filter(item => item.published !== false);
    const orders = storage.getOrderQueue();
    // 显示所有订单（包括已拒绝，以便用户看到拒绝原因）
    const userOrders = [...orders];
    // 红点只计 pending + cooking（未完成的）
    const activeOrderCount = orders.filter(o => o.status === 'pending' || o.status === 'cooking').length;
    this.setData({
      allFoodItems: published,
      userOrders: userOrders.reverse(),
      activeOrderCount,
      myCoins: storage.getGirlCoins()
    });
    this.filterUserTab();
  },

  filterUserTab() {
    const topTab = this.data.currentTopTab;
    const subTab = this.data.currentTab;
    const otherSubTab = this.data.currentOtherTab;
    let items;
    if (topTab === 'food') {
      items = this.data.allFoodItems.filter(item => item.category === subTab);
    } else if (topTab === 'other') {
      // 情侣互动：按 topCategory 和 category 过滤
      items = this.data.allFoodItems.filter(item => item.topCategory === topTab && item.category === otherSubTab);
    } else {
      // 水果：按 topCategory 过滤
      items = this.data.allFoodItems.filter(item => item.topCategory === topTab);
    }
    this.setData({ foodItems: items });
  },

  switchTopTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentTopTab: key });
    // 切换一级分类时，食品默认选中第一个子分类
    if (key === 'food') {
      this.setData({ currentTab: 'meal' });
    }
    // 切换一级分类时，情侣互动默认选中第一个子分类
    if (key === 'other') {
      this.setData({ currentOtherTab: 'housework' });
    }
    if (this.data.isDev) {
      this.filterDevTab(this.data.currentTab);
    } else {
      this.filterUserTab();
    }
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentTab: key });
    if (this.data.isDev) {
      this.filterDevTab(key);
    } else {
      this.filterUserTab();
    }
  },

  switchOtherTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentOtherTab: key });
    if (this.data.isDev) {
      this.filterDevTab(key);
    } else {
      this.filterUserTab();
    }
  },

  // 使用者 Tab 切换
  switchUserTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ userTab: tab });
    if (tab === 'orders') {
      this.loadUserData();
      // 用户查看了订单，清除TabBar红点
      wx.removeTabBarBadge({ index: 1 });
    }
  },

  // 点餐
  orderFood(e) { this.setData({ orderItem: e.currentTarget.dataset.item }); },
  closeOrder() { this.setData({ orderItem: null }); },
  confirmOrder() {
    const item = this.data.orderItem;
    if (!item) return;
    const price = item.price || 5;
    if (price < 0) {
      // 负价格：不扣币，订单提交给开发者，确认后发放爱心币
      storage.addOrder(item);
      this.setData({ orderItem: null });
      this.loadUserData();
      this.updateTabBadge();
      wx.showToast({ title: `已提交！${item.name} 🎉`, icon: 'none', duration: 2000 });
    } else {
      if (this.data.myCoins < price) {
        wx.showToast({ title: '爱心币不足～', icon: 'none' });
        return;
      }
      storage.setGirlCoins(this.data.myCoins - price);
      storage.addOrder(item);
      this.setData({ myCoins: this.data.myCoins - price, orderItem: null });
      this.loadUserData();
      this.updateTabBadge();
      wx.showToast({ title: `下单成功！${item.name} 🎉`, icon: 'none', duration: 2000 });
    }
  },

  // 随机选择
  randomPick() {
    const items = this.data.foodItems;
    if (items.length === 0) { wx.showToast({ title: '当前分类没有食物哦～', icon: 'none' }); return; }
    let count = 0;
    const timer = setInterval(() => {
      this.setData({ randomResult: items[Math.floor(Math.random() * items.length)] });
      if (++count >= 6) clearInterval(timer);
    }, 120);
    setTimeout(() => {
      this.setData({ randomResult: items[Math.floor(Math.random() * items.length)] });
    }, 770);
  },
  closeRandom() { this.setData({ randomResult: null }); },
  confirmRandomOrder() {
    this.setData({ orderItem: this.data.randomResult, randomResult: null });
  },

  // 充值
  showRecharge() { this.setData({ showRechargeModal: true, rechargeAmount: '10', rechargeItem: '' }); },
  hideRecharge() { this.setData({ showRechargeModal: false }); },
  onRechargeAmount(e) { this.setData({ rechargeAmount: e.detail.value }); },
  onRechargeItem(e) { this.setData({ rechargeItem: e.detail.value }); },
  sendRecharge() {
    const amount = parseInt(this.data.rechargeAmount) || 10;
    const item = this.data.rechargeItem.trim() || '一个拥抱 💕';
    storage.addCoinRequest(amount, item, storage.getMyName());
    this.setData({ showRechargeModal: false });
    wx.showToast({ title: '充值请求已发送 💌', icon: 'none' });
  },

  // 食物许愿 → 同时自动加入订单队列
  showRequestFood() { this.setData({ showFoodRequestModal: true, foodReqName: '', foodReqEmoji: '' }); },
  hideFoodRequest() { this.setData({ showFoodRequestModal: false }); },
  onFoodReqName(e) { this.setData({ foodReqName: e.detail.value }); },
  onFoodReqEmoji(e) { this.setData({ foodReqEmoji: e.detail.value }); },
  sendFoodRequest() {
    const name = this.data.foodReqName.trim();
    if (!name) { wx.showToast({ title: '请输入食物名称～', icon: 'none' }); return; }
    const emoji = this.data.foodReqEmoji || '🍽️';
    const myName = storage.getMyName();
    // 加入食物请求
    storage.addFoodRequest(name, emoji, myName);
    // 同时自动加入订单队列（待开发者处理）
    storage.addOrder({ name, emoji, price: 0, category: 'meal' });
    this.setData({ showFoodRequestModal: false });
    this.loadUserData();
    this.updateTabBadge();
    wx.showToast({ title: '许愿成功，已加入订单 💫', icon: 'none' });
  },

  // ==================== 开发者 ====================
  loadDevData() {
    const allItems = this.ensureDefaultItems();
    const orders = storage.getOrderQueue();
    const pendingOrders = orders.filter(o => o.status !== 'done' && o.status !== 'rejected');
    const doneOrders = orders.filter(o => o.status === 'done');
    const newOrders = orders.filter(o => o.status === 'pending');
    const foodRequests = storage.getFoodRequests();
    const coinRequests = storage.getCoinRequests();
    const pendingFoodReqs = foodRequests.filter(r => r.status === 'pending').length;
    const pendingCoinReqs = coinRequests.filter(r => r.status === 'pending').length;

    this.setData({
      allFoodItems: allItems,
      orderCount: newOrders.length,
      requestCount: pendingFoodReqs + pendingCoinReqs,
      pendingOrders,
      doneOrders,
      foodRequests,
      coinRequests,
      myCoins: storage.getBoyCoins()
    });
    this.filterDevTab(this.data.currentTab);
  },

  // 开发者分类筛选
  filterDevTab(key) {
    const topTab = this.data.currentTopTab;
    const otherSubTab = this.data.currentOtherTab;
    let items;
    if (topTab === 'food') {
      items = this.data.allFoodItems.filter(item => item.category === key);
    } else if (topTab === 'other') {
      // 情侣互动：按 topCategory 和 category 过滤
      items = this.data.allFoodItems.filter(item => item.topCategory === topTab && item.category === otherSubTab);
    } else {
      items = this.data.allFoodItems.filter(item => item.topCategory === topTab);
    }
    this.setData({ devFoodItems: items, currentTab: key });
  },

  switchDevTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ devTab: key });
    if (key === 'menu') {
      this.loadDevData();
    } else if (key === 'orders') {
      this.loadDevData();
    } else if (key === 'requests') {
      this.loadDevData();
    }
  },

  // 菜单管理
  showAddFood() {
    const topTab = this.data.currentTopTab;
    this.setData({
      showFoodModal: true, editingFood: null,
      foodForm: {
        name: '', emoji: '',
        topCatIdx: this.data.topCategories.findIndex(c => c.key === topTab),
        catIdx: topTab === 'food' ? this.data.categoryKeys.indexOf(this.data.currentTab) : 0,
        price: '5'
      }
    });
  },
  editMenuItem(e) {
    const item = e.currentTarget.dataset.item;
    const topCatIdx = this.data.topCategories.findIndex(c => c.key === (item.topCategory || 'food'));
    const catIdx = this.data.categoryKeys.indexOf(item.category);
    this.setData({
      showFoodModal: true, editingFood: item,
      foodForm: {
        name: item.name, emoji: item.emoji || '',
        topCatIdx: topCatIdx >= 0 ? topCatIdx : 0,
        catIdx: catIdx >= 0 ? catIdx : 0,
        price: String(item.price || 5)
      }
    });
  },
  hideFoodModal() { this.setData({ showFoodModal: false }); },
  onFoodFormName(e) { this.setData({ 'foodForm.name': e.detail.value }); },
  onFoodFormEmoji(e) { this.setData({ 'foodForm.emoji': e.detail.value }); },
  onFoodFormTopCat(e) { this.setData({ 'foodForm.topCatIdx': parseInt(e.detail.value) }); },
  onFoodFormCat(e) { this.setData({ 'foodForm.catIdx': parseInt(e.detail.value) }); },
  onFoodFormPrice(e) { this.setData({ 'foodForm.price': e.detail.value }); },

  saveFood() {
    const { name, emoji, topCatIdx, catIdx, price } = this.data.foodForm;
    if (!name.trim()) { wx.showToast({ title: '请输入名称', icon: 'none' }); return; }
    const p = Math.max(-9999, Math.min(9999, parseInt(price) || 5));
    const topCategory = this.data.topCategories[topCatIdx].key;
    const category = topCategory === 'food' ? this.data.categoryKeys[catIdx] : topCategory;

    let allItems = storage.getMenuItems();
    if (this.data.editingFood) {
      allItems = allItems.map(item => {
        if (item.id === this.data.editingFood.id) {
          return { ...item, name: name.trim(), emoji: emoji || '🍽️', topCategory, category, price: p, published: true };
        }
        return item;
      });
    } else {
      allItems.push({
        id: Date.now(), name: name.trim(), emoji: emoji || '🍽️',
        topCategory, category, price: p, published: true, addedBy: 'dev'
      });
    }
    storage.setMenuItems(allItems);
    this.setData({ showFoodModal: false });
    this.loadDevData();
    wx.showToast({ title: '已上架 ✅', icon: 'none' });
  },

  deleteMenuItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '下架菜品', content: '确定要下架这个菜品吗？',
      success: (res) => {
        if (res.confirm) {
          let items = storage.getMenuItems();
          items = items.filter(item => item.id !== id);
          storage.setMenuItems(items);
          this.loadDevData();
          wx.showToast({ title: '已下架', icon: 'none' });
        }
      }
    });
  },

  // 订单管理 - 接受
  acceptOrder(e) {
    const id = e.currentTarget.dataset.id;
    let orders = storage.getOrderQueue();
    orders = orders.map(o => { if (o.id === id) return { ...o, status: 'cooking', updatedAt: Date.now() }; return o; });
    storage.setOrderQueue(orders);
    this.loadDevData();
    this.updateTabBadge();
    wx.showToast({ title: '已接受，开始制作 🍳', icon: 'none' });
  },

  // 订单管理 - 标记完成（负价格订单发放爱心币）
  markOrderDone(e) {
    const id = e.currentTarget.dataset.id;
    let orders = storage.getOrderQueue();
    const order = orders.find(o => o.id === id);
    orders = orders.map(o => { if (o.id === id) return { ...o, status: 'done', updatedAt: Date.now() }; return o; });
    storage.setOrderQueue(orders);
    // 负价格：给使用者发放对应的爱心币
    if (order && order.price < 0) {
      const giveCoins = -order.price;
      const currentCoins = storage.getGirlCoins();
      storage.setGirlCoins(currentCoins + giveCoins);
      wx.showToast({ title: `已完成，已发放 ${giveCoins} 💖`, icon: 'none' });
    } else {
      wx.showToast({ title: '已完成 ✅', icon: 'none' });
    }
    this.loadDevData();
    this.updateTabBadge();
  },

  // 订单管理 - 拒绝弹窗
  showRejectReason(e) {
    this.setData({ showRejectModal: true, rejectOrderId: e.currentTarget.dataset.id, rejectReason: '' });
  },
  hideRejectModal() { this.setData({ showRejectModal: false }); },
  onRejectReason(e) { this.setData({ rejectReason: e.detail.value }); },
  confirmRejectOrder() {
    const id = this.data.rejectOrderId;
    const reason = this.data.rejectReason.trim() || '暂时无法提供';
    let orders = storage.getOrderQueue();
    orders = orders.map(o => {
      if (o.id === id) return { ...o, status: 'rejected', rejectReason: reason, updatedAt: Date.now() };
      return o;
    });
    storage.setOrderQueue(orders);
    this.setData({ showRejectModal: false });
    this.loadDevData();
    this.updateTabBadge();
    wx.showToast({ title: '已拒绝', icon: 'none' });
  },

  // 食物请求处理
  onReqPrice(e) {
    const id = e.currentTarget.dataset.id;
    const val = e.detail.value;
    const foodRequests = this.data.foodRequests.map(r => {
      if (r.id === id) return { ...r, _price: val };
      return r;
    });
    this.setData({ foodRequests });
  },

  approveFoodRequest(e) {
    const item = e.currentTarget.dataset.item;
    const price = parseInt(item._price) || 5;
    const allItems = storage.getMenuItems();
    allItems.push({
      id: Date.now(), name: item.name, emoji: item.emoji || '🍽️',
      category: item.category || 'meal', price, published: true, addedBy: 'dev'
    });
    storage.setMenuItems(allItems);

    // 同时更新对应订单价格（从0变为实际价格）
    let orders = storage.getOrderQueue();
    orders = orders.map(o => {
      if (o.foodName === item.name && o.price === 0) {
        return { ...o, price };
      }
      return o;
    });
    storage.setOrderQueue(orders);

    let requests = storage.getFoodRequests();
    requests = requests.map(r => {
      if (r.id === item.id) return { ...r, status: 'priced', price };
      return r;
    });
    storage.setFoodRequests(requests);
    this.loadDevData();
    wx.showToast({ title: '已上架 ✅', icon: 'none' });
  },

  rejectFoodRequest(e) {
    const id = e.currentTarget.dataset.id;
    let requests = storage.getFoodRequests();
    requests = requests.map(r => { if (r.id === id) return { ...r, status: 'rejected' }; return r; });
    storage.setFoodRequests(requests);
    // 同时拒绝对应订单
    let orders = storage.getOrderQueue();
    const req = requests.find(r => r.id === id);
    if (req) {
      orders = orders.map(o => {
        if (o.foodName === req.name && o.price === 0) return { ...o, status: 'rejected' };
        return o;
      });
      storage.setOrderQueue(orders);
    }
    this.loadDevData();
    wx.showToast({ title: '已拒绝', icon: 'none' });
  },

  // 硬币请求处理
  approveCoinRequest(e) {
    const item = e.currentTarget.dataset.item;
    storage.setGirlCoins(storage.getGirlCoins() + item.amount);
    let requests = storage.getCoinRequests();
    requests = requests.map(r => { if (r.id === item.id) return { ...r, status: 'approved' }; return r; });
    storage.setCoinRequests(requests);
    this.loadDevData();
    wx.showToast({ title: `已批准 💖${item.amount}`, icon: 'none' });
  },

  rejectCoinRequest(e) {
    const id = e.currentTarget.dataset.id;
    let requests = storage.getCoinRequests();
    requests = requests.map(r => { if (r.id === id) return { ...r, status: 'rejected' }; return r; });
    storage.setCoinRequests(requests);
    this.loadDevData();
    wx.showToast({ title: '已拒绝', icon: 'none' });
  },

  noop() {}
});

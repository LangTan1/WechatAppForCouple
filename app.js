const storage = require('./utils/storage');

App({
  onLaunch() {
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;
    this.initDefaultData();
  },

  initDefaultData() {
    // 纪念日默认数据
    if (storage.getAnniversaries().length === 0) {
      storage.setAnniversaries([
        { id: 1, title: '恋爱纪念日', date: storage.getTogetherDate(), icon: '💝', type: 'annual' },
        { id: 2, title: '第一次牵手', date: '2025-06-07', icon: '🤝', type: 'annual' },
        { id: 3, title: '第一次旅行', date: '2025-10-03', icon: '✈️', type: 'annual' },
      ]);
    }

    // 默认菜单
    if (storage.getMenuItems().length === 0) {
      storage.setMenuItems([
        { id: 1, name: '番茄牛腩饭', emoji: '🍅', category: 'meal', price: 5, published: true, addedBy: 'system' },
        { id: 2, name: '日式拉面', emoji: '🍜', category: 'meal', price: 6, published: true, addedBy: 'system' },
        { id: 3, name: '珍珠奶茶', emoji: '🫧', category: 'drink', price: 3, published: true, addedBy: 'system' },
        { id: 4, name: '杨枝甘露', emoji: '🥭', category: 'drink', price: 3, published: true, addedBy: 'system' },
        { id: 5, name: '烤串拼盘', emoji: '🍢', category: 'snack', price: 8, published: true, addedBy: 'system' },
        { id: 6, name: '炸鸡翅', emoji: '🍗', category: 'snack', price: 7, published: true, addedBy: 'system' },
      ]);
    }

    // 默认愿望
    if (storage.getWishes().length === 0) {
      storage.setWishes([
        { id: 1, title: '一起去迪士尼看烟花', done: false, emoji: '🏰' },
        { id: 2, title: '一起看一次日出', done: false, emoji: '🌄' },
        { id: 3, title: '一起坐摩天轮', done: false, emoji: '🎡' },
        { id: 4, title: '养一只猫咪', done: false, emoji: '🐱' },
        { id: 5, title: '一起去看周杰伦演唱会', done: false, emoji: '🎵' },
      ]);
    }
  },

  globalData: {
    systemInfo: null,
    statusBarHeight: 0
  }
});

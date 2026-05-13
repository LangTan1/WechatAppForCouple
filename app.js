const storage = require('./utils/storage');

App({
  onLaunch() {
    // 初始化云开发环境
    wx.cloud.init({
      env: 'cloud1-d0gzs51l9cbf4b9bc',
      traceUser: true
    });

    // 版本更新检测：新版本下载完成后提示用户重启
    this.checkUpdate();

    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;

    // 获取openid
    this.initOpenid();
    this.initDefaultData();
  },

  checkUpdate() {
    if (!wx.getUpdateManager) return;
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate(function(res) {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(function() {
          wx.showModal({
            title: '更新提示',
            content: '新版本已准备好，是否重启应用？',
            confirmText: '立即重启',
            confirmColor: '#FF6B8A',
            success(res) {
              if (res.confirm) updateManager.applyUpdate();
            }
          });
        });
        updateManager.onUpdateFailed(function() {
          wx.showModal({
            title: '更新提示',
            content: '新版本下载失败，请删除小程序后重新搜索打开',
            showCancel: false
          });
        });
      }
    });
  },

  async initOpenid() {
    try {
      // 方法1：尝试云函数
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      this.globalData.openid = res.result.openid;
      console.log('openid获取成功(云函数):', this.globalData.openid);
    } catch (e) {
      console.warn('云函数获取openid失败，尝试数据库方式:', e.message);
      // 方法2：通过云数据库获取（写入再读取，利用 _openid 自动字段）
      try {
        const db = wx.cloud.database();
        const tempCol = db.collection('couples');
        const addRes = await tempCol.add({ data: { _temp: true } });
        const docRes = await tempCol.doc(addRes._id).get();
        this.globalData.openid = docRes.data._openid;
        console.log('openid获取成功(数据库):', this.globalData.openid);
        // 清理临时数据
        await tempCol.doc(addRes._id).remove();
      } catch (e2) {
        console.error('数据库方式也失败:', e2);
      }
    }
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
    statusBarHeight: 0,
    openid: ''
  }
});

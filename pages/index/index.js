const storage = require('../../utils/storage');
const weather = require('../../utils/weather');
const loveQuotes = require('../../utils/love-quotes');

Page({
  data: {
    dateStr: '',
    weekday: '',
    togetherDays: 0,
    weather: null,
    dailyQuote: '',
    albumCount: 0,
    nextAnniversary: '',
    upcomingAnniversaries: [],
    wishCount: 0,
    activities: [],
    todayMood: null,
    partnerMood: null,
    // 消息提醒
    hasNewDiary: false,
    hasNewWhisper: false,
    hasNewOrder: false,
    hasNewWish: false,
    hasNewMood: false,
    myName: '',
    partnerName: '',
  },

  _pollTimer: null,

  onLoad() {
    this.initData();
    this.loadWeather();
    this.loadDailyQuote();
  },

  onShow() {
    this.setData({
      togetherDays: storage.getTogetherDays()
    });
    this.refreshData();
    this.loadWeather();
    this._doSyncFromCloud();
    this._startPolling();
  },

  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
  },

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      this._doSyncFromCloud();
    }, 5000);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async _doSyncFromCloud() {
    const hadDoc = !!storage.getCoupleDocId();
    const ok = await storage.loadFromCloud();
    if (ok) {
      this.refreshData();
      this.setData({
        togetherDays: storage.getTogetherDays(),
        weather: weather.getWeatherDisplayData()
      });
    } else if (hadDoc && !storage.getCoupleDocId()) {
      // 云端文档被删除（对方重置了）→ 弹窗提示
      this._stopPolling();
      wx.showModal({
        title: '绑定已失效',
        content: '对方已重置情侣空间，请与对方联系获取最新邀请码重新绑定。',
        showCancel: false,
        confirmText: '去绑定',
        confirmColor: '#FF6B8A',
        success: () => {
          storage.clearStorageKeepIdentity();
          wx.reLaunch({ url: '/pages/setup/setup' });
        }
      });
    }
  },

  initData() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekday = `星期${weekdays[now.getDay()]}`;

    this.setData({ dateStr, weekday, togetherDays: storage.getTogetherDays() });
    this.refreshData();
  },

  refreshData() {
    const anniversaries = storage.getAnniversaries();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 5 天内即将到来的纪念日
    const upcoming = [];
    let nextAnn = anniversaries[0] || { title: '暂无' };
    let minDiff = Infinity;
    anniversaries.forEach(a => {
      const d = new Date(a.date);
      const thisYear = new Date(d);
      thisYear.setFullYear(today.getFullYear());
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 5 && diffDays >= 0) {
        upcoming.push({ ...a, daysLeft: diffDays });
      }
      if (diffDays < minDiff) { minDiff = diffDays; nextAnn = a; }
    });
    upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

    const wishes = storage.getWishes();
    const undoneWishes = wishes.filter(w => !w.done).length;
    const albumPhotos = storage.getAlbumPhotos();

    // 活动动态
    const diaries = storage.getDiaries();
    const whispers = storage.getWhispers();
    const activities = [];
    if (diaries.length > 0) {
      activities.push({
        id: 100, type: 'diary',
        text: `记录了${diaries.length}篇恋爱日记`,
        time: diaries[0].date
      });
    }
    if (whispers.length > 0) {
      activities.push({
        id: 101, type: 'whisper',
        text: `有${whispers.length}条未读悄悄话 💌`,
        time: whispers[0].time
      });
    }
    if (albumPhotos.length > 0) {
      activities.push({
        id: 102, type: 'album',
        text: `时光相册共有${albumPhotos.length}张回忆`,
        time: '最近更新'
      });
    }
    if (activities.length === 0) {
      activities.push(
        { id: 1, type: 'diary', text: '欢迎来到你们的小世界！开始记录吧 💕', time: '今天' },
        { id: 2, type: 'whisper', text: '给对方写一句悄悄话吧～', time: '今天' }
      );
    }

    // ===== 消息提醒检测 =====
    const lastView = storage.getLastViewTimestamps();
    const myRole = storage.getCurrentRole();
    const partnerRole = myRole === 'dev' ? 'user' : 'dev';
    const now = Date.now();

    // 对方新日记
    const hasNewDiary = diaries.some(function(d) {
      return d.role === partnerRole && (d.createdAt || 0) > (lastView.diary || 0);
    });

    // 对方新悄悄话
    const hasNewWhisper = whispers.some(function(w) {
      return w.role === partnerRole && w.createdAt > (lastView.whisper || 0);
    });

    // 新订单状态变化（对方更新了订单状态）
    const orders = storage.getOrderQueue();
    const hasNewOrder = orders.some(function(o) {
      return o.createdAt > (lastView.order || 0) || (o.updatedAt && o.updatedAt > (lastView.order || 0));
    });

    // 对方新愿望
    const hasNewWish = wishes.some(function(w) {
      return w.role === partnerRole && w.createdAt > (lastView.wish || 0);
    });

    // 对方今日新心情
    const moods = storage.getMoods();
    const todayStr = storage._todayStr();
    const hasNewMood = moods.some(function(m) {
      return m.role === partnerRole && m.date === todayStr && (m.createdAt || 0) > (lastView.mood || 0);
    });

    this.setData({
      albumCount: albumPhotos.length,
      upcomingAnniversaries: upcoming,
      nextAnniversary: nextAnn.title,
      wishCount: undoneWishes,
      activities: activities.slice(0, 6),
      todayMood: storage.getTodayMood(),
      partnerMood: storage.getPartnerTodayMood(),
      hasNewDiary: hasNewDiary,
      hasNewWhisper: hasNewWhisper,
      hasNewOrder: hasNewOrder,
      hasNewWish: hasNewWish,
      hasNewMood: hasNewMood,
      myName: storage.getMyName() || '我',
      partnerName: storage.getPartnerName() || 'TA'
    });

  },

  async loadWeather() {
    this.setData({ weather: weather.getWeatherDisplayData() });

    const mySnapshot = storage.getMyWeatherSnapshot();
    const expired = storage.isWeatherSnapshotExpired(mySnapshot, weather.WEATHER_CACHE_TTL);
    if (!expired) return;

    try {
      await weather.refreshMyWeather();
    } catch (e) {
      console.error('[Index] weather refresh failed:', e);
    }

    this.setData({ weather: weather.getWeatherDisplayData() });
  },

  loadDailyQuote() {
    this.setData({ dailyQuote: loveQuotes.getTodayQuote() });
  },

  // 导航
  goMenu() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },
  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  },
  goWhisper() {
    wx.navigateTo({ url: '/pages/whisper/whisper' });
  },
  goAlbum() {
    wx.navigateTo({ url: '/pages/album/album' });
  },
  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/anniversary' });
  },
  goWishlist() {
    wx.navigateTo({ url: '/pages/wishlist/wishlist' });
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  },
  goMood() {
    wx.navigateTo({ url: '/pages/mood/mood' });
  }
});

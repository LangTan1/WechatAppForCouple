const storage = require('../../utils/storage');

Page({
  data: {
    isDev: false,
    myName: '',
    partnerName: '',
    myAvatar: '',
    partnerAvatar: '',
    togetherDateStr: '2025年05月31日',
    togetherDateVal: '2025-05-31',
    togetherDays: 0,
    diaryCount: 0,
    photoCount: 0,
    anniversaryCount: 0,
    coinBalance: 0,
    unlockedCount: 0,
    badgeStats: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    lockEnabled: false,
    userKeyMasked: '',
    // 弹窗
    showDatePicker: false,
    showNameModal: false,
    showRechargeModal: false,
    rechargeAmount: '10',
    rechargeItem: '',
    showKeyModal: false,
    newUserKey: '',
    editMyName: '',
    coinTxns: [],
    coinMode: 'add',
    coinAmount: '',
    coinMessage: '',
  },

  onLoad() {
    this.initData();
  },

  onShow() {
    this.refreshData();
    this.syncFromCloud();
  },

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.refreshData();
  },

  initData() {
    this.refreshData();
  },

  refreshData() {
    const isDev = storage.isDeveloper();
    const togetherDate = storage.getTogetherDate();
    const d = new Date(togetherDate);
    const togetherDateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

    // 双方都显示使用者(girlCoins)的余额
    const coins = storage.getGirlCoins();

    this.setData({
      isDev,
      myName: storage.getMyName(),
      partnerName: storage.getPartnerName(),
      myAvatar: storage.getMyAvatar(),
      partnerAvatar: storage.getPartnerAvatar(),
      myGender: storage.getMyGender(),
      partnerGender: storage.getPartnerGender(),
      myDefaultAvatar: storage.getDefaultAvatar(storage.getMyGender()),
      partnerDefaultAvatar: storage.getDefaultAvatar(storage.getPartnerGender()),
      togetherDateStr,
      togetherDateVal: togetherDate,
      togetherDays: storage.getTogetherDays(),
      diaryCount: storage.getDiaries().length,
      photoCount: storage.getAlbumPhotos().length,
      anniversaryCount: storage.getAnniversaries().length,
      coinBalance: coins,
      unlockedCount: storage.getUnlockedAchievementCount(),
      badgeStats: this.calcBadgeStats(),
      lockEnabled: storage.isLockEnabled(),
      coinTxns: storage.getCoinTransactions().slice(-5).reverse()
    });

  },

  // ========== 头像 ==========
  changeMyAvatar() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        storage.setMyAvatar(res.tempFilePaths[0]);
        this.setData({ myAvatar: res.tempFilePaths[0] });
        wx.showToast({ title: '头像已更新', icon: 'none' });
      }
    });
  },
  changePartnerAvatar() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        storage.setPartnerAvatar(res.tempFilePaths[0]);
        this.setData({ partnerAvatar: res.tempFilePaths[0] });
        wx.showToast({ title: '头像已更新', icon: 'none' });
      }
    });
  },

  // ========== 使用者充值 ==========
  showRecharge() {
    this.setData({ showRechargeModal: true, rechargeAmount: '10', rechargeItem: '' });
  },
  hideRecharge() { this.setData({ showRechargeModal: false }); },
  onRechargeAmount(e) { this.setData({ rechargeAmount: e.detail.value }); },
  onRechargeItem(e) { this.setData({ rechargeItem: e.detail.value }); },
  sendRecharge() {
    const amount = parseInt(this.data.rechargeAmount) || 10;
    const exchangeItem = this.data.rechargeItem.trim() || '一个拥抱 💕';
    storage.addCoinRequest(amount, exchangeItem, storage.getMyName());
    this.setData({ showRechargeModal: false });
    wx.showToast({ title: '请求已发送 💌', icon: 'none' });
  },

  // ========== 开发者发币/扣币 ==========
  switchCoinMode(e) {
    this.setData({ coinMode: e.currentTarget.dataset.mode });
  },
  onCoinAmount(e) {
    this.setData({ coinAmount: e.detail.value });
  },
  onCoinMessage(e) {
    this.setData({ coinMessage: e.detail.value });
  },
  submitCoins() {
    const amount = parseInt(this.data.coinAmount);
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    const isAdd = this.data.coinMode === 'add';
    const msg = this.data.coinMessage.trim();
    const doChange = () => {
      const newBalance = isAdd
        ? this.data.coinBalance + amount
        : Math.max(0, this.data.coinBalance - amount);
      storage.setGirlCoins(newBalance);
      // 记录交易
      const txns = storage.getCoinTransactions();
      txns.push({
        id: Date.now(),
        type: isAdd ? 'add' : 'sub',
        amount: amount,
        message: msg,
        by: storage.getMyName(),
        time: new Date().toLocaleString('zh-CN')
      });
      storage.setCoinTransactions(txns);
      this.setData({ coinBalance: newBalance, coinAmount: '', coinMessage: '' });
      wx.showToast({ title: isAdd ? `已发放 ${amount} 💖` : `已扣除 ${amount}`, icon: 'none' });
    };
    if (amount >= 200) {
      wx.showModal({
        title: '确认操作',
        content: `确定要${isAdd ? '发放' : '扣除'} ${amount} 爱心币吗？`,
        confirmColor: '#FF6B8A',
        success: (res) => { if (res.confirm) doChange(); }
      });
    } else {
      doChange();
    }
  },

  // ========== 开发者管理使用者密钥 ==========
  changeUserKey() {
    this.setData({ showKeyModal: true, newUserKey: '' });
  },
  hideKeyModal() { this.setData({ showKeyModal: false }); },
  onNewUserKey(e) { this.setData({ newUserKey: e.detail.value }); },
  saveUserKey() {
    const key = this.data.newUserKey.trim();
    if (!key) { wx.showToast({ title: '请输入密钥', icon: 'none' }); return; }
    storage.setUserKey(key);
    this.setData({ showKeyModal: false });
    this.refreshData();
    wx.showToast({ title: '使用者密钥已更新', icon: 'none' });
  },

  // ========== 设置 ==========
  editTogetherDate() { this.setData({ showDatePicker: true }); },
  hideDatePicker() { this.setData({ showDatePicker: false }); },
  onTogetherDateChange(e) { this.setData({ togetherDateVal: e.detail.value }); },
  saveTogetherDate() {
    storage.setTogetherDate(this.data.togetherDateVal);
    this.setData({ showDatePicker: false });
    wx.showToast({ title: '日期已更新 💕', icon: 'none' });
    this.refreshData();
  },

  editMyNameFn() {
    this.setData({
      showNameModal: true,
      editMyName: this.data.myName
    });
  },
  hideNameModal() { this.setData({ showNameModal: false }); },
  onEditMyName(e) { this.setData({ editMyName: e.detail.value }); },
  saveMyName() {
    const name = this.data.editMyName.trim();
    if (!name) {
      wx.showToast({ title: '名字不能为空～', icon: 'none' }); return;
    }
    storage.setMyName(name);
    this.setData({ showNameModal: false });
    wx.showToast({ title: '昵称已更新 💕', icon: 'none' });
    this.refreshData();
  },

  toggleLock() {},
  onLockSwitch(e) {
    const val = e.detail.value;
    if (val) {
      this.setData({ lockEnabled: true });
      storage.setLockEnabled(true);
      const pin = storage.get(storage.STORAGE_KEYS.LOCK_PIN, '');
      if (!pin) {
        wx.showModal({
          title: '设置应用锁密码',
          editable: true, placeholderText: '输入4位数字密码',
          success: (res) => {
            if (res.confirm && res.content && /^\d{4}$/.test(res.content)) {
              storage.set(storage.STORAGE_KEYS.LOCK_PIN, res.content);
              wx.showToast({ title: '应用锁已开启 🔒', icon: 'none' });
            } else {
              storage.setLockEnabled(false);
              this.setData({ lockEnabled: false });
              wx.showToast({ title: '密码设置失败', icon: 'none' });
            }
          }
        });
      }
    } else {
      storage.setLockEnabled(false);
      this.setData({ lockEnabled: false });
      wx.showToast({ title: '应用锁已关闭', icon: 'none' });
    }
  },

  resetApp() {
    wx.showModal({
      title: '⚠️ 重新设置',
      content: '将删除云端情侣空间，对方也将无法使用。此操作不可恢复！',
      confirmText: '确认重置',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          storage.unbindCouple().then(() => {
            try { wx.clearStorageSync(); } catch (e) {}
            wx.reLaunch({ url: '/pages/setup/setup' });
          });
        }
      }
    });
  },

  reBindApp() {
    wx.showModal({
      title: '重新绑定',
      content: '解除当前绑定，重新输入邀请码。',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('couple_doc_id');
            wx.removeStorageSync('last_role');
          } catch (e) {}
          wx.showToast({ title: '已解除绑定', icon: 'none', duration: 1000 });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/setup/setup' });
          }, 1000);
        }
      }
    });
  },

  // ========== 导航 ==========
  goDiary() { wx.navigateTo({ url: '/pages/diary/diary' }); },
  goAlbum() { wx.navigateTo({ url: '/pages/album/album' }); },
  goAnniversary() { wx.navigateTo({ url: '/pages/anniversary/anniversary' }); },
  goAchievement() { wx.navigateTo({ url: '/pages/achievement/achievement' }); },

  calcBadgeStats() {
    const achievements = storage.getAchievements();
    const tierMap = {
      first_diary: 'bronze', first_whisper: 'bronze', first_photo: 'bronze',
      first_wish: 'bronze', first_order: 'bronze', wish_done: 'bronze', order_done_1: 'bronze',
      diary_10: 'silver', whisper_10: 'silver', photo_20: 'silver', wish_5: 'silver',
      wish_10: 'silver', wish_done_5: 'silver', anniversary_3: 'silver', anniversary_5: 'silver',
      order_10: 'silver', together_100: 'silver', mood_sync: 'silver',
      diary_50: 'gold', whisper_50: 'gold', photo_50: 'gold', order_100: 'gold',
      mood_streak_7: 'gold', together_365: 'gold',
      all_features: 'platinum'
    };
    const stats = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (let i = 0; i < achievements.length; i++) {
      if (achievements[i].unlocked && tierMap[achievements[i].id]) {
        stats[tierMap[achievements[i].id]]++;
      }
    }
    return stats;
  },

  noop() {}
});

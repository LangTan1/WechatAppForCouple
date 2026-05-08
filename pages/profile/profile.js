const storage = require('../../utils/storage');

Page({
  data: {
    isDev: false,
    boyName: '浪',
    girlName: '琳琳',
    boyAvatar: '',
    girlAvatar: '',
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
    userKeyMasked: '****',
    // 弹窗
    showDatePicker: false,
    showNameModal: false,
    showRechargeModal: false,
    rechargeAmount: '10',
    rechargeItem: '',
    showKeyModal: false,
    newUserKey: '',
    showRoleModal: false,
    targetRole: '',
    roleKey: '',
    roleKeyError: '',
    editBoyName: '',
    editGirlName: ''
  },

  onLoad() {
    this.initData();
  },

  onShow() {
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
    const userKey = storage.getUserKey();

    const coins = isDev ? storage.getGirlCoins() : storage.getGirlCoins();

    this.setData({
      isDev,
      boyName: storage.getBoyName(),
      girlName: storage.getGirlName(),
      boyAvatar: storage.getBoyAvatar(),
      girlAvatar: storage.getGirlAvatar(),
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
      userKeyMasked: userKey ? userKey.slice(0, 2) + '****' : '未设置'
    });
  },

  // ========== 头像 ==========
  changeBoyAvatar() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        storage.setBoyAvatar(res.tempFilePaths[0]);
        this.setData({ boyAvatar: res.tempFilePaths[0] });
        wx.showToast({ title: '头像已更新', icon: 'none' });
      }
    });
  },
  changeGirlAvatar() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        storage.setGirlAvatar(res.tempFilePaths[0]);
        this.setData({ girlAvatar: res.tempFilePaths[0] });
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
    storage.addCoinRequest(amount, exchangeItem, storage.getGirlName());
    this.setData({ showRechargeModal: false });
    wx.showToast({ title: '请求已发送，等浪批准 💌', icon: 'none' });
  },

  // ========== 开发者发币 ==========
  addCoins(e) {
    const amount = parseInt(e.currentTarget.dataset.amount);
    const newBalance = this.data.coinBalance + amount;
    storage.setGirlCoins(newBalance);
    this.setData({ coinBalance: newBalance });
    wx.showToast({ title: `已发放 ${amount} 💖`, icon: 'none' });
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

  // ========== 角色切换 ==========
  switchRole() {
    const targetRole = this.data.isDev ? 'user' : 'dev';
    this.setData({
      showRoleModal: true, targetRole, roleKey: '', roleKeyError: ''
    });
  },
  hideRoleModal() { this.setData({ showRoleModal: false }); },
  onRoleKey(e) { this.setData({ roleKey: e.detail.value, roleKeyError: '' }); },
  confirmSwitchRole() {
    const key = this.data.roleKey.trim();
    if (!key) { this.setData({ roleKeyError: '请输入密钥' }); return; }
    const targetRole = this.data.targetRole;

    if (targetRole === 'dev') {
      if (!storage.verifyDevKey(key)) {
        this.setData({ roleKeyError: '开发者密钥不正确' }); return;
      }
    } else {
      if (!storage.verifyUserKey(key)) {
        this.setData({ roleKeyError: '使用者密钥不正确' }); return;
      }
    }

    storage.setCurrentRole(targetRole);
    this.setData({ showRoleModal: false });
    wx.showToast({
      title: targetRole === 'dev' ? '已切换为开发者 🔧' : '已切换为使用者 💕',
      icon: 'none', duration: 1500
    });
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/index/index' });
    }, 1500);
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

  editNames() {
    this.setData({
      showNameModal: true,
      editBoyName: this.data.boyName,
      editGirlName: this.data.girlName
    });
  },
  hideNameModal() { this.setData({ showNameModal: false }); },
  onEditBoyName(e) { this.setData({ editBoyName: e.detail.value }); },
  onEditGirlName(e) { this.setData({ editGirlName: e.detail.value }); },
  saveNames() {
    const { editBoyName, editGirlName } = this.data;
    if (!editBoyName.trim() || !editGirlName.trim()) {
      wx.showToast({ title: '名字不能为空～', icon: 'none' }); return;
    }
    storage.setBoyName(editBoyName.trim());
    storage.setGirlName(editGirlName.trim());
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
      title: '重新设置',
      content: '这会清除所有本地数据，是否继续？',
      success: (res) => {
        if (res.confirm) {
          try { wx.clearStorageSync(); } catch (e) {}
          wx.reLaunch({ url: '/pages/setup/setup' });
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
    // 成就等级定义（与 achievement.js 保持一致）
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

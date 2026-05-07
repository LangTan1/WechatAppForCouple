const storage = require('../../utils/storage');

const DEFAULT_DEV_KEY = 'langdev520';

Page({
  data: {
    step: 'dev_key',
    inputKey: '',
    keyError: '',
    boyName: '',
    girlName: '',
    togetherDate: '2025-05-31',
    userKey: '',
    lockEnabled: false,
    lockPin: '',
    pinInput: '',
    pinError: '',
    numRows: [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '']
    ],
    showDevModal: false,
    devResetKey: '',
    devResetError: ''
  },

  onLoad() {
    if (storage.isSetupDone()) {
      if (storage.isLockEnabled()) {
        this.setData({
          step: 'unlock',
          boyName: storage.getBoyName(),
          girlName: storage.getGirlName(),
          pinError: ''
        });
      } else {
        // 无需锁，默认以使用者身份进入
        storage.setCurrentRole('user');
        this.goMain();
      }
    } else {
      this.setData({ step: 'dev_key' });
    }
  },

  // ========== 开发者密钥验证 ==========
  onKeyInput(e) {
    this.setData({ inputKey: e.detail.value, keyError: '' });
  },

  verifyDevKey() {
    const key = this.data.inputKey.trim();
    if (!key) {
      this.setData({ keyError: '请输入密钥～' });
      return;
    }
    const savedDevKey = storage.getDevKey() || DEFAULT_DEV_KEY;
    if (key === savedDevKey) {
      if (!storage.getDevKey()) storage.setDevKey(key);
      // 首次设置跳转到信息设置
      if (!storage.isSetupDone()) {
        this.setData({
          step: 'setup_info', inputKey: '', keyError: '',
          boyName: storage.getBoyName(),
          girlName: storage.getGirlName(),
          togetherDate: storage.getTogetherDate()
        });
      } else {
        // 已经设置过，以开发者身份进入
        storage.setCurrentRole('dev');
        this.goMain();
      }
    } else {
      this.setData({ keyError: '密钥不正确' });
    }
  },

  // ========== 信息设置 ==========
  onBoyName(e)   { this.setData({ boyName: e.detail.value }); },
  onGirlName(e)  { this.setData({ girlName: e.detail.value }); },
  onDateChange(e){ this.setData({ togetherDate: e.detail.value }); },
  onUserKey(e)   { this.setData({ userKey: e.detail.value }); },
  onLockSwitch(e){ this.setData({ lockEnabled: e.detail.value }); },
  onLockPin(e)   { this.setData({ lockPin: e.detail.value.replace(/\D/g, '') }); },

  finishSetup() {
    const { boyName, girlName, togetherDate, userKey, lockEnabled, lockPin } = this.data;
    if (!boyName.trim() || !girlName.trim()) {
      wx.showToast({ title: '请填写名字哦～', icon: 'none' }); return;
    }
    if (!togetherDate) {
      wx.showToast({ title: '请选择在一起的日子～', icon: 'none' }); return;
    }
    if (!userKey.trim()) {
      wx.showToast({ title: '请为琳琳设置一个密钥～', icon: 'none' }); return;
    }
    if (lockEnabled && lockPin.length !== 4) {
      wx.showToast({ title: '请设置4位数字密码', icon: 'none' }); return;
    }

    storage.setBoyName(boyName.trim());
    storage.setGirlName(girlName.trim());
    storage.setTogetherDate(togetherDate);
    storage.setUserKey(userKey.trim());
    storage.setLockEnabled(lockEnabled);
    if (lockEnabled) storage.set(storage.STORAGE_KEYS.LOCK_PIN, lockPin);
    storage.setSetupDone();
    storage.setCurrentRole('dev'); // 设置完成后以开发者身份进入

    wx.showToast({ title: '设置完成 💕', icon: 'none', duration: 1200 });
    setTimeout(() => this.goMain(), 1200);
  },

  // ========== 日常解锁 ==========
  onNumTap(e) {
    const num = e.currentTarget.dataset.num;
    if (num === '') return;
    let pin = this.data.pinInput + num;
    if (pin.length >= 4) {
      pin = pin.slice(0, 4);
      this.setData({ pinInput: pin, pinError: '' });
      this.verifyPin(pin);
    } else {
      this.setData({ pinInput: pin, pinError: '' });
    }
  },

  deletePin() {
    this.setData({ pinInput: this.data.pinInput.slice(0, -1), pinError: '' });
  },

  verifyPin(pin) {
    const savedPin = storage.get(storage.STORAGE_KEYS.LOCK_PIN, '');
    if (pin === savedPin) {
      storage.setCurrentRole('user'); // 解锁后默认使用者身份
      this.setData({ pinInput: '', pinError: '' });
      this.goMain();
    } else {
      setTimeout(() => {
        this.setData({ pinInput: '', pinError: '密码不对哦～' });
      }, 300);
    }
  },

  // ========== 开发者重置 ==========
  showDevReset() {
    this.setData({ showDevModal: true, devResetKey: '', devResetError: '' });
  },
  hideDevModal() {
    this.setData({ showDevModal: false });
  },
  onDevResetKey(e) {
    this.setData({ devResetKey: e.detail.value, devResetError: '' });
  },
  confirmDevReset() {
    const key = this.data.devResetKey.trim();
    if (!key) { this.setData({ devResetError: '请输入开发者密钥' }); return; }
    const savedDevKey = storage.getDevKey() || DEFAULT_DEV_KEY;
    if (key !== savedDevKey) { this.setData({ devResetError: '开发者密钥不正确' }); return; }
    wx.showModal({
      title: '⚠️ 确认重置',
      content: '这将清除所有数据，不可恢复！',
      confirmText: '确认重置',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          try { wx.clearStorageSync(); } catch (e) {}
          this.setData({
            showDevModal: false, step: 'dev_key',
            inputKey: '', keyError: '',
            boyName: '', girlName: '', userKey: '',
            lockEnabled: false, lockPin: '', pinInput: ''
          });
        }
      }
    });
  },

  goMain() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  noop() {}
});

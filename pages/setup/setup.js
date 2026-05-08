const storage = require('../../utils/storage');
const app = getApp();

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
    devResetError: '',
    // 绑定相关
    inviteCode: '',
    bindCode: '',
    bindError: '',
    bindLoading: false,
    bindCreating: false,
    bindCreateError: ''
  },

  onLoad() {
    // 已绑定且已设置完成 → 直接进主页或解锁页
    if (storage.isSetupDone() && storage.getCoupleDocId()) {
      if (storage.isLockEnabled()) {
        this.setData({
          step: 'unlock',
          boyName: storage.getBoyName(),
          girlName: storage.getGirlName(),
          pinError: ''
        });
      } else {
        storage.setCurrentRole('user');
        this.goMain();
      }
    } else if (storage.isSetupDone() && !storage.getCoupleDocId()) {
      // 已设置但未绑定（旧数据迁移场景）→ 进入绑定等待
      this.setData({
        step: 'bind_wait',
        boyName: storage.getBoyName(),
        girlName: storage.getGirlName()
      });
      this._createCoupleIfNeeded();
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
      if (!storage.isSetupDone()) {
        this.setData({
          step: 'setup_info', inputKey: '', keyError: '',
          boyName: storage.getBoyName(),
          girlName: storage.getGirlName(),
          togetherDate: storage.getTogetherDate()
        });
      } else {
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
    storage.setCurrentRole('dev');

    wx.showToast({ title: '设置完成 💕', icon: 'none', duration: 1200 });
    // 创建云端情侣文档并显示邀请码
    setTimeout(() => this._createCoupleAndShowCode(), 1200);
  },

  // ========== 云端绑定流程 ==========
  async _createCoupleIfNeeded() {
    if (storage.getCoupleDocId()) return;
    await this._createCoupleAndShowCode();
  },

  async _createCoupleAndShowCode() {
    this.setData({ bindCreating: true, bindCreateError: '' });

    // 等待 openid（最多等 10 秒）
    let openid = app.globalData.openid;
    let waitCount = 0;
    while (!openid && waitCount < 20) {
      await new Promise(function(r) { setTimeout(r, 500); });
      openid = app.globalData.openid;
      waitCount++;
    }

    if (!openid) {
      this.setData({
        bindCreating: false,
        bindCreateError: '获取身份信息失败，请检查网络后重试'
      });
      return;
    }

    try {
      const result = await storage.createCouple(openid, {
        boyName: storage.getBoyName(),
        girlName: storage.getGirlName(),
        togetherDate: storage.getTogetherDate()
      });
      this.setData({
        step: 'bind_wait',
        inviteCode: result.inviteCode,
        bindCreating: false,
        bindCreateError: ''
      });
    } catch (e) {
      console.error('创建情侣空间失败:', e);
      this.setData({
        bindCreating: false,
        bindCreateError: '创建失败：' + (e.message || '未知错误')
      });
    }
  },

  retryCreateCouple() {
    this._createCoupleAndShowCode();
  },

  onBindCodeInput(e) {
    this.setData({ bindCode: e.detail.value.toUpperCase(), bindError: '' });
  },

  async confirmBind() {
    const code = this.data.bindCode.trim();
    if (!code || code.length !== 6) {
      this.setData({ bindError: '请输入6位邀请码' });
      return;
    }

    const openid = app.globalData.openid;
    if (!openid) {
      this.setData({ bindError: '正在初始化，请稍后再试' });
      return;
    }

    this.setData({ bindLoading: true, bindError: '' });

    try {
      const result = await storage.bindCouple(code, openid);
      if (result.success) {
        storage.setCurrentRole('user');
        wx.showToast({ title: '绑定成功 💕', icon: 'none', duration: 1500 });
        setTimeout(() => this.goMain(), 1500);
      } else {
        this.setData({ bindError: result.error, bindLoading: false });
      }
    } catch (e) {
      console.error('绑定失败:', e);
      this.setData({ bindError: '绑定失败，请重试', bindLoading: false });
    }
  },

  skipBind() {
    storage.setCurrentRole('dev');
    this.goMain();
  },

  resetToDevKey() {
    wx.showModal({
      title: '重新设置',
      content: '这会清除当前设置，重新开始初始化流程',
      confirmText: '确认',
      confirmColor: '#FF6B8A',
      success: function(res) {
        if (res.confirm) {
          try { wx.clearStorageSync(); } catch (e) {}
          this.setData({
            step: 'dev_key',
            inputKey: '', keyError: '',
            boyName: '', girlName: '', userKey: '',
            lockEnabled: false, lockPin: '', pinInput: '',
            inviteCode: '', bindCode: '',
            bindCreating: false, bindCreateError: ''
          });
        }
      }.bind(this)
    });
  },

  showBindInput() {
    this.setData({ step: 'bind_input', bindCode: '', bindError: '' });
  },

  showBindWait() {
    this.setData({ step: 'bind_wait' });
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
      storage.setCurrentRole('user');
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
            lockEnabled: false, lockPin: '', pinInput: '',
            inviteCode: '', bindCode: ''
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

const storage = require('../../utils/storage');
const contentSecurity = require('../../utils/content-security');
const app = getApp();

const DEFAULT_DEV_KEY = 'langdev520';

Page({
  data: {
    step: 'dev_key',
    inputKey: '',
    keyError: '',
    myName: '',
    myGender: '',
    togetherDate: '2025-05-31',
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
    // 开发者恢复相关
    devRecoverCode: '',
    devRecoverError: '',
    devRecoverLoading: false,
    // 旧空间查找
    oldSpaces: [],
    oldSpacesLoading: false,
    showOldSpaces: false,
    // 绑定相关
    inviteCode: '',
    bindCode: '',
    bindName: '',
    bindGender: '',
    bindError: '',
    bindLoading: false,
    bindCreating: false,
    bindCreateError: '',
    // 重连相关
    rebindCode: '',
    rebindLoading: false,
    rebindError: '',
    lastInviteCode: ''
  },

  onLoad() {
    const self = this;
    if (storage.isSetupDone() && storage.getCoupleDocId()) {
      storage.loadFromCloud().then(function(ok) {
        if (!ok) {
          // 加载失败可能是网络问题，稍等重试一次
          setTimeout(function() {
            storage.loadFromCloud().then(function(ok2) {
              if (!ok2) {
                // 重试仍失败，可能是文档真的被删除了
                if (storage.getCoupleDocId()) {
                  // 还有couple_doc_id说明是网络错误，尝试正常进入
                  self._enterAfterCloudFail();
                } else {
                  self.setData({ step: 'bind_invalid' });
                }
                return;
              }
              self._afterCloudLoaded();
            });
          }, 1500);
          return;
        }
        self._afterCloudLoaded();
      });
    } else if (storage.isSetupDone() && !storage.getCoupleDocId()) {
      var lastRole = storage.getLastRole();
      if (lastRole === 'dev') {
        this.setData({
          step: 'bind_wait',
          myName: storage.getMyName(),
          partnerName: storage.getPartnerName()
        });
        this._createCoupleIfNeeded();
      } else {
        // 已有名字和性别（之前绑定过），显示简化恢复界面
        var savedName = storage.getMyName();
        var savedGender = storage.getMyGender();
        var lastCode = storage.getLastInviteCode();
        if (savedName) {
          this.setData({
            step: 'rebind',
            rebindCode: lastCode,
            rebindLoading: false,
            rebindError: '',
            lastInviteCode: lastCode
          });
        } else {
          this.setData({ step: 'bind_input' });
        }
      }
    } else {
      this.setData({ step: 'dev_key' });
    }
  },

  // ========== 开发者密钥验证 ==========
  onKeyInput(e) {
    this.setData({ inputKey: e.detail.value, keyError: '' });
  },

  async verifyDevKey() {
    const key = this.data.inputKey.trim();
    if (!key) {
      this.setData({ keyError: '请输入密钥～' });
      return;
    }
    const savedDevKey = storage.getDevKey() || DEFAULT_DEV_KEY;
    if (key !== savedDevKey) {
      this.setData({ keyError: '密钥不正确' });
      return;
    }

    if (!storage.getDevKey()) storage.setDevKey(key);

    if (storage.isSetupDone()) {
      storage.setCurrentRole('dev');
      this.goMain();
      return;
    }

    // 尝试恢复已有情侣空间（防重复创建）
    var restored = await this._tryRestoreCouple();
    if (restored) return;

    // 恢复失败，显示恢复选项（可输入邀请码或创建新空间）
    this.setData({
      step: 'dev_recover', inputKey: '', keyError: '',
      devRecoverCode: storage.getLastInviteCode() || '',
      devRecoverError: '',
      devRecoverLoading: false
    });
  },

  // 尝试恢复已有情侣空间，返回 true 表示成功
  async _tryRestoreCouple() {
    // 方法1：通过 openid 查找云端已有文档
    var openid = app.globalData.openid;
    if (!openid) {
      for (var w = 0; w < 10; w++) {
        await new Promise(function(r) { setTimeout(r, 500); });
        openid = app.globalData.openid;
        if (openid) break;
      }
    }

    if (openid) {
      try {
        var existing = await storage.findCoupleByOpenid(openid);
        if (existing && existing._id && existing.inviteCode) {
          return this._doRestore(existing);
        }
      } catch (e) {
        console.error('findCoupleByOpenid 失败:', e);
      }
    }

    // 方法2：通过缓存的邀请码查找恢复
    var lastCode = storage.getLastInviteCode();
    if (lastCode) {
      try {
        var res = await wx.cloud.callFunction({
          name: 'coupleOps',
          data: { action: 'findCoupleByCode', inviteCode: lastCode }
        });
        if (res.result && res.result.success && res.result.couple) {
          return this._doRestore(res.result.couple);
        }
      } catch (e) {
        console.error('通过邀请码恢复失败:', e);
      }
    }

    return false;
  },

  // 执行恢复操作
  _doRestore(doc) {
    storage.set('couple_doc_id', doc._id);
    storage.setLastInviteCode(doc.inviteCode);
    storage.setSetupDone();
    storage.setCurrentRole('dev');
    if (doc.devName) storage.setMyName(doc.devName);
    if (doc.devGender) storage.setMyGender(doc.devGender);
    if (doc.togetherDate) storage.setTogetherDate(doc.togetherDate);
    if (doc.userName) storage.setPartnerName(doc.userName);
    if (doc.userGender) storage.setPartnerGender(doc.userGender);
    if (doc.devAvatar) storage.setMyAvatar(doc.devAvatar);
    if (doc.userAvatar) storage.setPartnerAvatar(doc.userAvatar);
    wx.showToast({ title: '已恢复情侣空间 💕', icon: 'none', duration: 1500 });
    setTimeout(() => this.goMain(), 1500);
    return true;
  },

  // ========== 开发者邀请码恢复 ==========
  onDevRecoverCodeInput(e) {
    this.setData({ devRecoverCode: e.detail.value.toUpperCase(), devRecoverError: '' });
  },

  async confirmDevRecover() {
    var code = this.data.devRecoverCode.trim();
    if (!code || code.length !== 6) {
      this.setData({ devRecoverError: '请输入6位邀请码' });
      return;
    }
    this.setData({ devRecoverLoading: true, devRecoverError: '' });
    try {
      var res = await wx.cloud.callFunction({
        name: 'coupleOps',
        data: { action: 'findCoupleByCode', inviteCode: code }
      });
      if (res.result && res.result.success && res.result.couple) {
        this._doRestore(res.result.couple);
        return;
      }
      this.setData({ devRecoverError: res.result ? res.result.error : '邀请码不存在', devRecoverLoading: false });
    } catch (e) {
      console.error('邀请码恢复失败:', e);
      this.setData({ devRecoverError: '恢复失败，请重试', devRecoverLoading: false });
    }
  },

  skipToNewSetup() {
    this.setData({
      step: 'setup_info',
      myName: storage.getMyName(),
      myGender: storage.getMyGender(),
      togetherDate: storage.getTogetherDate()
    });
  },

  // ========== 查找旧空间 ==========
  async findOldSpaces() {
    this.setData({ oldSpacesLoading: true, oldSpaces: [], showOldSpaces: true });
    try {
      var couples = await storage.findAllCouplesByOpenid();
      if (couples.length === 0) {
        this.setData({ oldSpacesLoading: false });
        wx.showToast({ title: '没有找到旧空间', icon: 'none' });
        return;
      }
      this.setData({ oldSpaces: couples, oldSpacesLoading: false });
    } catch (e) {
      console.error('findOldSpaces error:', e);
      this.setData({ oldSpacesLoading: false });
      wx.showToast({ title: '查找失败，请重试', icon: 'none' });
    }
  },

  hideOldSpaces() {
    this.setData({ showOldSpaces: false });
  },

  restoreOldSpace(e) {
    var couple = e.currentTarget.dataset.couple;
    if (!couple || !couple._id) return;
    this._doRestore(couple);
  },

  // ========== 信息设置 ==========
  onMyName(e)      { this.setData({ myName: e.detail.value }); },
  selectMyGender(e) { this.setData({ myGender: e.currentTarget.dataset.gender }); },
  onDateChange(e)   { this.setData({ togetherDate: e.detail.value }); },
  onLockSwitch(e)   { this.setData({ lockEnabled: e.detail.value }); },
  onLockPin(e)      { this.setData({ lockPin: e.detail.value.replace(/\D/g, '') }); },

  async finishSetup() {
    const { myName, myGender, togetherDate, lockEnabled, lockPin } = this.data;
    if (!myName.trim()) {
      wx.showToast({ title: '请填写你的名字～', icon: 'none' }); return;
    }
    if (!myGender) {
      wx.showToast({ title: '请选择性别～', icon: 'none' }); return;
    }
    if (!togetherDate) {
      wx.showToast({ title: '请选择在一起的日子～', icon: 'none' }); return;
    }
    if (lockEnabled && lockPin.length !== 4) {
      wx.showToast({ title: '请设置4位数字密码', icon: 'none' }); return;
    }

    if (!(await contentSecurity.checkBeforePublish(myName))) return;

    storage.setMyName(myName.trim());
    storage.setMyGender(myGender);
    storage.setTogetherDate(togetherDate);
    storage.setLockEnabled(lockEnabled);
    if (lockEnabled) storage.set(storage.STORAGE_KEYS.LOCK_PIN, lockPin);

    storage.setSetupDone();
    storage.setCurrentRole('dev');

    wx.showToast({ title: '设置完成 💕', icon: 'none', duration: 1200 });
    setTimeout(() => this._createCoupleAndShowCode(), 1200);
  },

  // ========== 云端加载完成处理 ==========
  _afterCloudLoaded() {
    if (storage.isLockEnabled()) {
      this.setData({
        step: 'unlock',
        myName: storage.getMyName(),
        partnerName: storage.getPartnerName(),
        pinError: ''
      });
    } else {
      var lastRole = storage.getLastRole();
      storage.setCurrentRole(lastRole || 'user');
      this.goMain();
    }
  },

  // 网络错误但仍保留绑定，尝试正常进入
  _enterAfterCloudFail() {
    var lastRole = storage.getLastRole();
    if (lastRole === 'dev') {
      // 开发者直接进入
      storage.setCurrentRole('dev');
      this.goMain();
    } else if (storage.isLockEnabled()) {
      // 有锁的用户显示解锁界面
      this.setData({
        step: 'unlock',
        myName: storage.getMyName(),
        partnerName: storage.getPartnerName(),
        pinError: ''
      });
    } else {
      // 无锁用户直接进入
      storage.setCurrentRole(lastRole || 'user');
      this.goMain();
    }
  },

  // ========== 云端绑定流程 ==========
  async _createCoupleIfNeeded() {
    if (storage.getCoupleDocId()) return;

    // 尝试恢复已有情侣空间（防重复创建）
    var restored = await this._tryRestoreCouple();
    if (restored) {
      this.setData({
        step: 'bind_wait',
        inviteCode: storage.getLastInviteCode(),
        bindCreating: false,
        bindCreateError: ''
      });
      return;
    }

    await this._createCoupleAndShowCode();
  },

  async _createCoupleAndShowCode() {
    this.setData({ bindCreating: true, bindCreateError: '' });

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
        devName: storage.getMyName(),
        devGender: storage.getMyGender(),
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

  onBindNameInput(e) {
    this.setData({ bindName: e.detail.value, bindError: '' });
  },

  selectBindGender(e) {
    this.setData({ bindGender: e.currentTarget.dataset.gender });
  },

  async confirmBind() {
    const code = this.data.bindCode.trim();
    const name = this.data.bindName.trim();
    const gender = this.data.bindGender;
    if (!name) {
      this.setData({ bindError: '请输入你的名字' });
      return;
    }
    if (!gender) {
      this.setData({ bindError: '请选择性别' });
      return;
    }
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
      if (!(await contentSecurity.checkBeforePublish(name))) {
        this.setData({ bindLoading: false });
        return;
      }
      const result = await storage.bindCouple(code, name, gender);
      if (result.success) {
        storage.setSetupDone();
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

  onRebindCodeInput(e) {
    this.setData({ rebindCode: e.detail.value.toUpperCase(), rebindError: '' });
  },

  async confirmRebind() {
    var code = this.data.rebindCode.trim();
    if (!code || code.length !== 6) {
      this.setData({ rebindError: '请输入6位邀请码' });
      return;
    }

    var openid = app.globalData.openid;
    if (!openid) {
      this.setData({ rebindError: '正在初始化，请稍后再试' });
      return;
    }

    this.setData({ rebindLoading: true, rebindError: '' });

    try {
      // 使用保存的名字和性别重新绑定
      var result = await storage.bindCouple(code, storage.getMyName(), storage.getMyGender());
      if (result.success) {
        storage.setSetupDone();
        storage.setCurrentRole('user');
        wx.showToast({ title: '恢复成功 💕', icon: 'none', duration: 1500 });
        setTimeout(() => this.goMain(), 1500);
      } else {
        this.setData({ rebindError: result.error, rebindLoading: false });
      }
    } catch (e) {
      console.error('恢复绑定失败:', e);
      this.setData({ rebindError: '恢复失败，请重试', rebindLoading: false });
    }
  },

  showFullBindInput() {
    this.setData({
      step: 'bind_input',
      bindCode: this.data.rebindCode,
      bindName: storage.getMyName(),
      bindGender: storage.getMyGender(),
      bindError: ''
    });
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
            myName: '', myGender: '',
            lockEnabled: false, lockPin: '', pinInput: '',
            inviteCode: '', bindCode: '', bindName: '', bindGender: '',
            bindCreating: false, bindCreateError: ''
          });
        }
      }.bind(this)
    });
  },

  showBindInput() {
    this.setData({ step: 'bind_input', bindCode: '', bindName: '', bindGender: '', bindError: '' });
  },

  showBindWait() {
    this.setData({ step: 'bind_wait' });
  },

  reBind() {
    storage.clearStorageKeepIdentity();
    this.setData({
      step: 'bind_input',
      bindCode: storage.getLastInviteCode(),
      bindName: storage.getMyName(),
      bindGender: storage.getMyGender(),
      bindError: '',
      bindLoading: false
    });
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
      content: '将删除云端情侣空间，对方也将无法使用。此操作不可恢复！',
      confirmText: '确认重置',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          storage.unbindCouple().then(() => {
            try { wx.clearStorageSync(); } catch (e) {}
            this.setData({
              showDevModal: false, step: 'dev_key',
              inputKey: '', keyError: '',
              myName: '', myGender: '',
              lockEnabled: false, lockPin: '', pinInput: '',
              inviteCode: '', bindCode: '', bindName: '', bindGender: ''
            });
            wx.showToast({ title: '已重置', icon: 'none' });
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

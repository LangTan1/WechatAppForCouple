const storage = require('../../utils/storage');

Page({
  data: {
    whispers: [],
    inputText: '',
    myRole: '',
    keyboardHeight: 0
  },

  _pollTimer: null,

  onLoad() {
    this.setData({ myRole: storage.getCurrentRole() });
    this.loadWhispers();
  },

  onShow() {
    this.setData({ myRole: storage.getCurrentRole() });
    this.loadWhispers();
    this.syncFromCloud();
    storage.updateLastView('whisper');
    this._startPolling();
    this._scrollToBottom();
    // 监听键盘高度变化
    wx.onKeyboardHeightChange(this._onKeyboardHeightChange.bind(this));
  },

  onHide() {
    this._stopPolling();
    wx.offKeyboardHeightChange();
  },

  onUnload() {
    this._stopPolling();
    wx.offKeyboardHeightChange();
  },

  _onKeyboardHeightChange(res) {
    this.setData({ keyboardHeight: res.height });
    if (res.height > 0) {
      this._scrollToBottom();
    }
  },

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      this.syncFromCloud();
    }, 3000);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  _scrollToBottom() {
    setTimeout(() => {
      wx.pageScrollTo({ scrollTop: 99999, duration: 100 });
    }, 150);
  },

  loadWhispers() {
    const raw = storage.getWhispers().map(w => ({ ...w })).reverse();
    const myRole = this.data.myRole;
    const whispers = raw.map((w, i) => {
      const isMine = w.role === myRole;
      const prev = raw[i - 1];
      const showTime = !prev || (w.createdAt - prev.createdAt > 5 * 60 * 1000);
      return { ...w, isMine, showTime };
    });
    this.setData({ whispers });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendWhisper() {
    const text = this.data.inputText.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const senderName = storage.getMyName();
    const newWhisper = {
      id: Date.now(),
      role: storage.getCurrentRole(),
      sender: senderName,
      avatar: storage.getMyAvatar(),
      content: text,
      time: timeStr,
      createdAt: Date.now()
    };

    const whispers = storage.getWhispers();
    whispers.push(newWhisper);
    storage.setWhispers(whispers);

    this.setData({ inputText: '' });
    this.loadWhispers();
    this._scrollToBottom();
  },

  async syncFromCloud() {
    try { await storage.loadFromCloud(); } catch (e) { console.error('[whisper] loadFromCloud failed:', e); }
    this.loadWhispers();
  }
});

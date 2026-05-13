Page({
  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  },
  goWhisper() {
    wx.navigateTo({ url: '/pages/whisper/whisper' });
  },
  goAlbum() {
    wx.navigateTo({ url: '/pages/album/album' });
  },
  goMood() {
    wx.navigateTo({ url: '/pages/mood/mood' });
  },
  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/anniversary' });
  },
  goWishlist() {
    wx.navigateTo({ url: '/pages/wishlist/wishlist' });
  },
  goAngry() {
    wx.navigateTo({ url: '/pages/angry/angry' });
  },
  goReflection() {
    wx.navigateTo({ url: '/pages/reflection/reflection' });
  },
  goLearn() {
    wx.navigateTo({ url: '/pages/learn/learn' });
  },
  goSweet() {
    wx.navigateTo({ url: '/pages/sweet/sweet' });
  },
  goAvoid() {
    wx.navigateTo({ url: '/pages/avoid/avoid' });
  }
});

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
  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/anniversary' });
  },
  goWishlist() {
    wx.navigateTo({ url: '/pages/wishlist/wishlist' });
  }
});

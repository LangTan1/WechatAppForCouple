const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function mockWxServerSdk(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init() {},
      database() {
        return { collection() { return {}; }, serverDate() { return new Date('2026-01-01T00:00:00Z'); } };
      },
      getWXContext() { return { OPENID: 'test-openid' }; },
      openapi: { security: { msgSecCheck() { return Promise.resolve({ result: { suggest: 'pass' } }); } } },
      getTempFileURL() { return Promise.resolve({ fileList: [] }); }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const coupleOps = require('./index.js');

const helpers = coupleOps.__test__;

assert.ok(helpers, 'expected __test__ helpers to be exported from coupleOps');

{
  const couples = [
    { _id: 'old', createdAt: 1000 },
    { _id: 'new', createdAt: 2000 },
    { _id: 'mid', createdAt: 1500 }
  ];
  const latest = helpers.pickLatestCouple(couples);
  assert.equal(latest._id, 'new');
}

{
  const updates = helpers.filterAllowedUpdates({
    devName: 'Alice',
    userName: 'Bob',
    updatedAt: 'bad',
    hacked: true
  });
  assert.deepEqual(updates, { devName: 'Alice', userName: 'Bob' });
}

{
  const texts = helpers.collectSecurityTexts({
    title: 'Beach day',
    content: 'A quiet note',
    role: 'dev',
    status: 'pending',
    fileID: 'cloud://album/photo-1.jpg',
    photos: [
      {
        desc: 'Sunset photo',
        url: 'cloud://album/photo-1.jpg',
        comments: [{ text: 'Looks warm', by: 'Alice' }]
      }
    ]
  });
  assert.deepEqual(texts, ['Beach day', 'A quiet note', 'Sunset photo', 'Looks warm', 'Alice']);
}

{
  const requests = helpers.buildMsgSecCheckRequests(
    ['first', '', 'second'],
    'openid-1',
    2,
    5
  );
  assert.deepEqual(requests, [
    { content: 'first', openid: 'openid-1', scene: 2, version: 2 },
    { content: 'secon', openid: 'openid-1', scene: 2, version: 2 },
    { content: 'd', openid: 'openid-1', scene: 2, version: 2 }
  ]);
}

{
  assert.equal(helpers.isMsgSecCheckPass({ result: { suggest: 'pass' } }), true);
  assert.equal(helpers.isMsgSecCheckPass({ result: { suggest: 'risky' } }), false);
  assert.equal(helpers.isContentSecurityRejected(new Error('content security rejected')), true);
}

{
  const request = helpers.buildMediaCheckAsyncRequest(
    'https://tmp.example/photo.jpg',
    'openid-1',
    2,
    2
  );
  assert.deepEqual(request, {
    media_url: 'https://tmp.example/photo.jpg',
    media_type: 2,
    openid: 'openid-1',
    scene: 2,
    version: 2
  });
}

{
  assert.equal(helpers.isMediaCheckPass({ result: { suggest: 'pass' } }), true);
  assert.equal(helpers.isMediaCheckPass({ result: { suggest: 'review' } }), false);
  assert.equal(helpers.isMediaCheckPass({ result: { suggest: 'risky' } }), false);
}

{
  const albums = [{
    id: 1,
    photos: [
      { id: 101, mediaCheckTraceId: 'trace-pass', mediaCheckStatus: 'pending' },
      { id: 102, mediaCheckTraceId: 'trace-risky', mediaCheckStatus: 'pending' }
    ]
  }];

  const passedAlbums = helpers.applyMediaCheckResultToAlbums(albums, {
    trace_id: 'trace-pass',
    result: { suggest: 'pass' }
  });
  assert.equal(passedAlbums[0].photos[0].mediaCheckStatus, 'pass');

  const rejectedAlbums = helpers.applyMediaCheckResultToAlbums(passedAlbums, {
    trace_id: 'trace-risky',
    result: { suggest: 'risky' }
  });
  assert.equal(rejectedAlbums[0].photos[1].mediaCheckStatus, 'rejected');
}

{
  const updates = helpers.filterAllowedUpdates({
    devWeatherProfile: { mode: 'auto', city: '杭州' },
    userWeatherProfile: { mode: 'manual', city: '上海' },
    devWeatherSnapshot: { temp: 26, location: '杭州 西湖区' },
    userWeatherSnapshot: { temp: 22, location: '上海 浦东新区' }
  });
  assert.deepEqual(updates, {
    devWeatherProfile: { mode: 'auto', city: '杭州' },
    userWeatherProfile: { mode: 'manual', city: '上海' },
    devWeatherSnapshot: { temp: 26, location: '杭州 西湖区' },
    userWeatherSnapshot: { temp: 22, location: '上海 浦东新区' }
  });
}

{
  const couple = { devOpenid: 'dev-1', userOpenid: 'user-1' };
  assert.equal(helpers.canAccessCouple(couple, 'dev-1'), true);
  assert.equal(helpers.canAccessCouple(couple, 'user-1'), true);
  assert.equal(helpers.canAccessCouple(couple, 'other'), false);
  assert.equal(helpers.canUnbindCouple(couple, 'dev-1'), true);
  assert.equal(helpers.canUnbindCouple(couple, 'user-1'), false);
}

{
  const publicCouple = helpers.toPublicCouple({
    _id: 'doc-1',
    inviteCode: 'ABC123',
    devName: 'Alice',
    userName: 'Bob',
    devOpenid: 'dev-1',
    userOpenid: 'user-1',
    devAvatar: 'cloud://a',
    userAvatar: 'cloud://b'
  });
  assert.deepEqual(publicCouple, {
    _id: 'doc-1',
    inviteCode: 'ABC123',
    devName: 'Alice',
    userName: 'Bob',
    devAvatar: 'cloud://a',
    userAvatar: 'cloud://b'
  });
}

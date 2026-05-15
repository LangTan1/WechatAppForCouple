const assert = require('node:assert/strict');
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

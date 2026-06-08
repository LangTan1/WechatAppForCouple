const assert = require('node:assert/strict');

function loadModuleWithWx(wxMock) {
  global.wx = wxMock;
  const modulePath = require.resolve('./content-security.js');
  delete require.cache[modulePath];
  return require('./content-security.js');
}

async function testPassesCleanText() {
  const calls = [];
  const security = loadModuleWithWx({
    cloud: {
      callFunction(options) {
        calls.push(options);
        return Promise.resolve({ result: { success: true } });
      }
    },
    showToast() {
      throw new Error('showToast should not be called for safe text');
    }
  });

  const ok = await security.checkBeforePublish(['hello', '']);

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].data, {
    action: 'securityCheckText',
    contentList: ['hello']
  });
}

async function testShowsGenericViolationMessage() {
  const toasts = [];
  const security = loadModuleWithWx({
    cloud: {
      callFunction() {
        return Promise.resolve({
          result: { success: false, code: 'CONTENT_SECURITY_REJECTED', error: 'content security rejected' }
        });
      }
    },
    showToast(options) {
      toasts.push(options);
    }
  });

  const ok = await security.checkBeforePublish(['bad text']);

  assert.equal(ok, false);
  assert.deepEqual(toasts, [{ title: '内容含违规信息', icon: 'none' }]);
}

async function testBlocksWhenCheckFails() {
  const toasts = [];
  const security = loadModuleWithWx({
    cloud: {
      callFunction() {
        return Promise.reject(new Error('network failed'));
      }
    },
    showToast(options) {
      toasts.push(options);
    }
  });

  const ok = await security.checkBeforePublish(['hello']);

  assert.equal(ok, false);
  assert.deepEqual(toasts, [{ title: '内容审核失败，请稍后再试', icon: 'none' }]);
}

async function testSubmitsMediaCheck() {
  const calls = [];
  const security = loadModuleWithWx({
    cloud: {
      callFunction(options) {
        calls.push(options);
        return Promise.resolve({ result: { success: true, traceId: 'trace-1' } });
      }
    },
    showToast() {
      throw new Error('showToast should not be called for accepted media check');
    }
  });

  const result = await security.checkMediaBeforePublish('cloud://env/photo.jpg', {
    docId: 'doc-1',
    albumId: 1,
    photoId: 101
  });

  assert.deepEqual(result, { success: true, traceId: 'trace-1' });
  assert.deepEqual(calls[0].data, {
    action: 'securityCheckMedia',
    docId: 'doc-1',
    fileID: 'cloud://env/photo.jpg',
    mediaType: 2,
    albumId: 1,
    photoId: 101
  });
}

(async function run() {
  await testPassesCleanText();
  await testShowsGenericViolationMessage();
  await testBlocksWhenCheckFails();
  await testSubmitsMediaCheck();
})();

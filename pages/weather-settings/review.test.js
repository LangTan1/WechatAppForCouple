const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadPageDefinition(relativePath) {
  const absPath = path.resolve(__dirname, '..', '..', relativePath);
  delete require.cache[require.resolve(absPath)];

  let definition = null;
  global.Page = function(def) {
    definition = def;
  };

  require(absPath);
  delete global.Page;

  assert.ok(definition, `${relativePath} should register a Page definition`);
  return definition;
}

function main() {
  const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'app.json'), 'utf8'));
  assert.ok(
    appJson.pages.includes('pages/weather-settings/weather-settings'),
    'app.json should register pages/weather-settings/weather-settings'
  );

  const profilePage = loadPageDefinition('pages/profile/profile.js');
  assert.equal(typeof profilePage.goWeatherSettings, 'function', 'profile page should expose goWeatherSettings');

  const weatherSettingsPage = loadPageDefinition('pages/weather-settings/weather-settings.js');
  assert.equal(typeof weatherSettingsPage.useCurrentWeatherLocation, 'function', 'weather settings page should expose useCurrentWeatherLocation');
  assert.equal(typeof weatherSettingsPage.onManualRegionChange, 'function', 'weather settings page should expose onManualRegionChange');

  console.log('weather-settings review passed');
}

main();

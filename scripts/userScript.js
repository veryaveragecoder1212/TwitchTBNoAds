// Install uBlock Origin core via npm

const { StaticNetFilteringEngine } = require('@gorhill/ubo-core');

const userResourcesLocation = 'https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/0b5ea5ed8959a6b4eb4c1ea406aaa56313c9c907/vaft/vaft-ublock-origin.js';
const response = await fetch(userResourcesLocation);
const blocklistText = await response.text();

const snfe = await StaticNetFilteringEngine.create();
await snfe.useLists([{ raw: blocklistText }]);

// Apply the filter list as needed in your application

// ESC / Back button fix (Tizen + browser safe)
document.addEventListener('keydown', (event) => {
  const key = event.key || event.keyCode;

  // Browser back
  if (key === 'Escape' || key === 'Backspace' || key === 27) {
    window.history.back();
  }

  // Tizen TV back button
  if (event.keyCode === 10009) {
    window.history.back();
  }
});

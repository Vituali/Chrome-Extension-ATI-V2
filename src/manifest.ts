import { defineManifest } from '@crxjs/vite-plugin'
import packageData from '../package.json'

export default defineManifest({
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnwdLTz9cq5SlmjeeScuFAqyWSvCiL/cTRcQ+u2kc9XYghhNwCDi1caRGtkQimEGrqN0d1XwKtexKrsgQhAjgyJT6FrP+yttdWPSuA+oIyB2UK8fYpEucPtYEAopNYNO5TcBostKkETqWvl/Dt45RIGn1OS2ogrXA/d+MSi5Oiyb7gAzEcXjEnentQT8gaRHHcC+opaXlpXAKDmdONNmG65+SdeVklZegp7CuQ2plJLFbXG79DZf8H/OVgSr1m6kbEqkqG1GetdRn4rmsJk8vZLPE8KnrHiCoro5WNuOXCud70dPDyJ7V9diw2fTK6l6aAmjhg8if3JIIgnItpMCy4QIDAQAB',
  name: packageData.displayName || packageData.name,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'img/logo-16.png',
    32: 'img/logo-32.png',
    48: 'img/logo-48.png',
    128: 'img/logo-128.png',
  },
  action: {
    default_popup: 'src/popup/Popup.html',
    default_icon: 'img/logo-48.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://www.chatmix.com.br/*'],
      js: ['src/contentScript/chatmix/index.ts'],
    },
    {
      matches: ['https://sgp.atiinternet.com.br/*', 'http://201.158.20.35:8000/*'],
      js: ['src/contentScript/sgp/fillForm.ts'],
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        'img/logo-16.png',
        'img/logo-32.png',
        'img/logo-48.png',
        'img/logo-128.png',
        'src/contentScript/sgp/sgpFill.js',
      ],
      matches: ['https://sgp.atiinternet.com.br/*', 'http://201.158.20.35:8000/*'],
    },
  ],
  permissions: ['sidePanel', 'storage', 'tabs', 'alarms'],
  host_permissions: [
    '*://*.chatmix.com.br/*',
    '*://sgp.atiinternet.com.br/*',
    'http://201.158.20.35:8000/*',
  ],
})

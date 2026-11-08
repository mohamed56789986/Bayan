/*
 * منصة البيان — تثبيت تطبيق الويب التقدمي
 * هذه الوحدة مستقلة عن منطق الأذكار ولا تغيّر التخزين أو التنقل الحاليين.
 */
(() => {
  'use strict';

  let deferredInstallPrompt = null;
  let installButton = null;
  let iosHelpButton = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  function showToast(message) {
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(message, 4500);
      return;
    }

    window.alert(message);
  }

  function createInstallControls() {
    if (document.getElementById('pwa-install-controls')) return;

    const controls = document.createElement('div');
    controls.id = 'pwa-install-controls';
    controls.className = 'pwa-install-controls';
    controls.setAttribute('aria-live', 'polite');

    installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.className = 'pwa-install-btn';
    installButton.hidden = true;
    installButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12"></path>
        <path d="m7 10 5 5 5-5"></path>
        <path d="M5 21h14"></path>
      </svg>
      <span>تثبيت التطبيق</span>
    `;
    installButton.addEventListener('click', requestInstall);

    iosHelpButton = document.createElement('button');
    iosHelpButton.type = 'button';
    iosHelpButton.className = 'pwa-install-btn pwa-ios-help-btn';
    iosHelpButton.hidden = true;
    iosHelpButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 16V3"></path>
        <path d="m8 7 4-4 4 4"></path>
        <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"></path>
      </svg>
      <span>إضافة للشاشة الرئيسية</span>
    `;
    iosHelpButton.addEventListener('click', () => {
      showToast('في Safari: اضغط زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية».');
    });

    controls.append(installButton, iosHelpButton);
    document.body.appendChild(controls);
  }

  function updateInstallControls() {
    if (!installButton || !iosHelpButton) return;

    const installed = isStandalone();
    installButton.hidden = installed || !deferredInstallPrompt;
    iosHelpButton.hidden = installed || !isIos();
  }

  async function requestInstall() {
    if (!deferredInstallPrompt) return;

    installButton.disabled = true;
    try {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } catch (error) {
      console.warn('PWA installation prompt was not completed.', error);
    } finally {
      deferredInstallPrompt = null;
      installButton.disabled = false;
      updateInstallControls();
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('../service-worker.js', { scope: '../' }).catch((error) => {
        console.warn('Service Worker registration failed.', error);
      });
    });
  }

  function initialise() {
    createInstallControls();
    updateInstallControls();
    registerServiceWorker();

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallControls();
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      updateInstallControls();
      showToast('تم تثبيت تطبيق البيان على جهازك بنجاح.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();

// src/ui/modals.js — Accessible modal manager, focus trapping/restoration, and in-app dialogs
import { renderGDriveApiErrorHtml } from './dom-utils.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

const modalOpenerMap = new WeakMap();
let focusTrapAttached = false;

function getTopActiveModal() {
  if (typeof document === 'undefined') return null;
  const active = Array.from(document.querySelectorAll('.modal.active'));
  if (active.length === 0) return null;
  const inapp = active.find((m) => m.id === 'inapp-dialog-modal');
  return inapp || active[active.length - 1];
}

function handleModalFocusTrap(e) {
  if (e.key !== 'Tab') return;
  const modal = getTopActiveModal();
  if (!modal) return;

  const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first || !modal.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last || !modal.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  }
}

export function ensureModalFocusTrap() {
  if (focusTrapAttached || typeof document === 'undefined') return;
  focusTrapAttached = true;
  document.addEventListener('keydown', handleModalFocusTrap);
}

export function openModal(modalEl, { initialFocusEl = null } = {}) {
  if (!modalEl) return;
  ensureModalFocusTrap();
  if (typeof document !== 'undefined' && document.activeElement && !modalEl.contains(document.activeElement)) {
    modalOpenerMap.set(modalEl, document.activeElement);
  }
  modalEl.classList.add('active');
  modalEl.setAttribute('aria-hidden', 'false');

  if (initialFocusEl && typeof initialFocusEl.focus === 'function') {
    setTimeout(() => initialFocusEl.focus(), 40);
  } else {
    const first = modalEl.querySelector(FOCUSABLE_SELECTOR);
    if (first && typeof first.focus === 'function') {
      setTimeout(() => first.focus(), 40);
    }
  }
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  modalEl.setAttribute('aria-hidden', 'true');
  const opener = modalOpenerMap.get(modalEl);
  modalOpenerMap.delete(modalEl);
  if (opener && opener.isConnected && typeof opener.focus === 'function') {
    try {
      opener.focus();
    } catch (e) {}
  }
}

export function closeTopNonDialogModals() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('#inapp-dialog-modal.modal.active')) return;
  document.querySelectorAll('.modal.active:not(#inapp-dialog-modal)').forEach((m) => closeModal(m));
}

export function setDialogMessage(msgEl, message) {
  if (!msgEl) return;
  if (typeof message === 'string' && message.includes('drive.googleapis.com')) {
    msgEl.innerHTML = renderGDriveApiErrorHtml(message);
  } else {
    msgEl.textContent = message;
  }
}

export function showInAppConfirm({ title = 'Confirm Action', message = '', confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('inapp-dialog-modal');
    const titleEl = document.getElementById('inapp-dialog-title');
    const msgEl = document.getElementById('inapp-dialog-message');
    const inputGroup = document.getElementById('inapp-dialog-input-group');
    const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
    const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

    if (!modal || !titleEl || !btnConfirm) {
      resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`${title}\n\n${message}`) : false);
      return;
    }

    titleEl.textContent = title;
    setDialogMessage(msgEl, message);
    msgEl.style.display = message ? 'block' : 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'inline-block';

    btnConfirm.textContent = confirmText;
    btnConfirm.className = danger ? 'btn btn-secondary' : 'btn btn-primary';
    if (danger) {
      btnConfirm.style.color = 'var(--accent-red, #ef4444)';
      btnConfirm.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      btnConfirm.style.color = '';
      btnConfirm.style.borderColor = '';
    }

    const cleanup = (result) => {
      closeModal(modal);
      btnCancel?.removeEventListener('click', onCancel);
      btnConfirm.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup(false);
      } else if (e.key === 'Enter') {
        if (document.activeElement === btnCancel) return;
        e.preventDefault();
        e.stopPropagation();
        cleanup(true);
      }
    };

    btnCancel?.addEventListener('click', onCancel);
    btnConfirm.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeyDown);

    openModal(modal, { initialFocusEl: btnConfirm });
  });
}

export function showInAppPrompt({ title = 'Enter Value', message = '', defaultValue = '', placeholder = '', confirmText = 'Save' }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('inapp-dialog-modal');
    const titleEl = document.getElementById('inapp-dialog-title');
    const msgEl = document.getElementById('inapp-dialog-message');
    const inputGroup = document.getElementById('inapp-dialog-input-group');
    const inputEl = document.getElementById('inapp-dialog-input');
    const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
    const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

    if (!modal || !titleEl || !inputEl) {
      resolve(typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(`${title}\n\n${message}`, defaultValue) : null);
      return;
    }

    titleEl.textContent = title;
    setDialogMessage(msgEl, message);
    msgEl.style.display = message ? 'block' : 'none';

    if (inputGroup) inputGroup.style.display = 'block';
    if (btnCancel) btnCancel.style.display = 'inline-block';
    inputEl.value = defaultValue || '';
    inputEl.placeholder = placeholder || '';

    btnConfirm.textContent = confirmText;
    btnConfirm.className = 'btn btn-primary';
    btnConfirm.style.color = '';
    btnConfirm.style.borderColor = '';

    const cleanup = (result) => {
      closeModal(modal);
      btnCancel?.removeEventListener('click', onCancel);
      btnConfirm.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onCancel = () => cleanup(null);
    const onConfirm = () => cleanup(inputEl.value.trim());
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup(null);
      } else if (e.key === 'Enter') {
        if (document.activeElement === btnCancel) return;
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };

    btnCancel?.addEventListener('click', onCancel);
    btnConfirm.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeyDown);

    openModal(modal, { initialFocusEl: inputEl });
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 50);
  });
}

export function showInAppAlert({ title = 'Notice', message = '', buttonText = 'OK' }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('inapp-dialog-modal');
    const titleEl = document.getElementById('inapp-dialog-title');
    const msgEl = document.getElementById('inapp-dialog-message');
    const inputGroup = document.getElementById('inapp-dialog-input-group');
    const btnCancel = document.getElementById('inapp-dialog-btn-cancel');
    const btnConfirm = document.getElementById('inapp-dialog-btn-confirm');

    if (!modal || !titleEl || !btnConfirm) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`${title}\n\n${message}`);
      }
      resolve();
      return;
    }

    titleEl.textContent = title;
    setDialogMessage(msgEl, message);
    msgEl.style.display = message ? 'block' : 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';

    btnConfirm.textContent = buttonText;
    btnConfirm.className = 'btn btn-primary';
    btnConfirm.style.color = '';
    btnConfirm.style.borderColor = '';

    const cleanup = () => {
      closeModal(modal);
      btnConfirm.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeyDown);
      if (btnCancel) btnCancel.style.display = 'inline-block';
      resolve();
    };

    const onConfirm = () => cleanup();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      }
    };

    btnConfirm.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeyDown);

    openModal(modal, { initialFocusEl: btnConfirm });
  });
}

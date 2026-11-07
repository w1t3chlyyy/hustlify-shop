(() => {
  const root = document.getElementById('roulette');
  const rotor = document.getElementById('rouletteRotor');
  const spinButton = document.getElementById('spinBtn');
  const timer = document.getElementById('timerBox');
  const result = document.getElementById('rouletteResult');
  const discountOutput = document.getElementById('rouletteDiscount');
  const promoOutput = document.getElementById('promoCode');
  const copyButton = document.getElementById('activateBtn');

  if (!root || !rotor || !spinButton || !timer || !result || !promoOutput || !copyButton) return;

  const STORAGE_KEY = 'hs_last_spin_ts';
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const SPIN_MS = 5400;
  const SECTORS = [25, 30, 5, 10, 25, 10, 15, 10];
  const DEFAULT_BUTTON_TEXT = 'Мне повезёт';

  let rotation = 0;
  let spinning = false;
  let timerInterval = null;
  let activePromoCode = '';

  function getLastSpin() {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEY) || 0);
      return Number.isFinite(value) ? value : 0;
    } catch (_) {
      return 0;
    }
  }

  function setLastSpin(timestamp) {
    try {
      localStorage.setItem(STORAGE_KEY, String(timestamp));
    } catch (_) {
      // The server still enforces the cooldown if browser storage is unavailable.
    }
  }

  function getRemainingMs() {
    return Math.max(0, COOLDOWN_MS - (Date.now() - getLastSpin()));
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
  }

  function refreshCooldown() {
    if (spinning) return;
    const remaining = getRemainingMs();

    if (remaining > 0) {
      spinButton.disabled = true;
      spinButton.textContent = 'Уже крутили сегодня';
      timer.hidden = false;
      timer.textContent = `Следующий прокрут через ${formatTime(remaining)}`;
      if (!timerInterval) timerInterval = window.setInterval(refreshCooldown, 1000);
      return;
    }

    spinButton.disabled = false;
    spinButton.textContent = DEFAULT_BUTTON_TEXT;
    timer.hidden = true;
    if (timerInterval) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function showResult(discount, code) {
    activePromoCode = code;
    promoOutput.textContent = code;
    if (discountOutput) discountOutput.textContent = `${discount}%`;
    result.hidden = false;
  }

  function setError(message) {
    timer.textContent = message;
    timer.hidden = false;
  }

  function getTargetRotation(discount) {
    const candidates = SECTORS
      .map((value, index) => ({ value, index }))
      .filter(sector => sector.value === discount);
    if (!candidates.length) return null;

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    const sectorRotation = (360 - selected.index * (360 / SECTORS.length)) % 360;
    const fullTurns = 6 + Math.floor(Math.random() * 2);
    return rotation + fullTurns * 360 + sectorRotation;
  }

  function animateToPrize(discount, code) {
    const targetRotation = getTargetRotation(discount);
    if (targetRotation === null) {
      showResult(discount, code);
      setLastSpin(Date.now());
      spinning = false;
      refreshCooldown();
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 1 : SPIN_MS;
    rotor.style.transitionDuration = `${duration}ms`;
    rotor.style.transform = `rotate(${targetRotation}deg)`;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      rotor.removeEventListener('transitionend', onTransitionEnd);
      rotation = ((targetRotation % 360) + 360) % 360;
      rotor.style.transition = 'none';
      rotor.style.transform = `rotate(${rotation}deg)`;
      void rotor.offsetWidth;
      rotor.style.removeProperty('transition');
      rotor.style.removeProperty('transition-duration');

      showResult(discount, code);
      spinning = false;
      refreshCooldown();
    };
    const onTransitionEnd = event => {
      if (event.target === rotor && event.propertyName === 'transform') finish();
    };

    rotor.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finish, duration + 250);
  }

  spinButton.addEventListener('click', async () => {
    if (spinning) return;
    if (getRemainingMs() > 0) {
      refreshCooldown();
      return;
    }

    spinning = true;
    spinButton.disabled = true;
    spinButton.textContent = 'Крутим…';
    timer.hidden = true;

    try {
      const response = await fetch('/api/promo/generate', { method: 'POST' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (Number(data.remainingMs) > 0) {
          setLastSpin(Date.now() - (COOLDOWN_MS - Number(data.remainingMs)));
          spinning = false;
          refreshCooldown();
        } else {
          spinning = false;
          spinButton.disabled = false;
          spinButton.textContent = DEFAULT_BUTTON_TEXT;
          setError(data.error || 'Не удалось получить промокод. Попробуйте ещё раз.');
        }
        return;
      }

      const discount = Number(data.discount);
      const code = String(data.code || '').trim();
      if (!Number.isFinite(discount) || !code) {
        throw new Error('Сервер вернул некорректный промокод');
      }

      setLastSpin(Date.now());
      animateToPrize(discount, code);
    } catch (_) {
      spinning = false;
      spinButton.disabled = false;
      spinButton.textContent = DEFAULT_BUTTON_TEXT;
      setError('Не удалось связаться с сервером. Попробуйте ещё раз.');
    }
  });

  copyButton.addEventListener('click', async () => {
    if (!activePromoCode) return;
    try {
      await navigator.clipboard.writeText(activePromoCode);
    } catch (_) {
      const temporaryInput = document.createElement('textarea');
      temporaryInput.value = activePromoCode;
      temporaryInput.setAttribute('readonly', '');
      temporaryInput.style.position = 'fixed';
      temporaryInput.style.opacity = '0';
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      document.execCommand('copy');
      temporaryInput.remove();
    }

    copyButton.textContent = 'Скопировано';
    window.setTimeout(() => {
      copyButton.textContent = 'Скопировать';
    }, 1500);
  });

  refreshCooldown();
})();
(() => {
  const root = document.getElementById('roulette');
  const wheelVideo = document.getElementById('rouletteVideo');
  const wheelStill = document.getElementById('rouletteStill');
  const spinButton = document.getElementById('spinBtn');
  const timer = document.getElementById('timerBox');
  const result = document.getElementById('rouletteResult');
  const discountOutput = document.getElementById('rouletteDiscount');
  const promoOutput = document.getElementById('promoCode');
  const copyButton = document.getElementById('activateBtn');

  if (!root || !wheelVideo || !spinButton || !timer || !result || !promoOutput || !copyButton) return;

  const STORAGE_KEY = 'hs_last_spin_ts';
  const COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const STOP_TIMES_BY_DISCOUNT = {
    5: [3.00, 3.25],
    10: [2.50],
    15: [1.50],
    25: [4.50, 4.75],
    30: [3.75, 4.00]
  };
  const PLAYBACK_RATES_BY_CYCLE = [3, 2, 1];
  const DECELERATION_WINDOW_SECONDS = 1;
  const MIN_FINAL_PLAYBACK_RATE = 0.15;
  const RATE_UPDATE_INTERVAL_MS = 50;
  const STILL_IMAGES_BY_DISCOUNT = {
    5: '/images/roulette-still-5.png',
    10: '/images/roulette-still-10.png',
    15: '/images/roulette-still-15.png',
    25: '/images/roulette-still-25.png',
    30: '/images/roulette-still-30.png'
  };
  const DEFAULT_BUTTON_TEXT = 'Мне повезёт';

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

  function animateToPrize(discount, code) {
    const candidates = STOP_TIMES_BY_DISCOUNT[discount];
    if (!candidates || !candidates.length) {
      spinning = false;
      spinButton.disabled = false;
      spinButton.textContent = DEFAULT_BUTTON_TEXT;
      setError('Не удалось определить сектор выигрыша. Попробуйте ещё раз.');
      return;
    }

    const targetTime = candidates[Math.floor(Math.random() * candidates.length)];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let previousTime = wheelVideo.currentTime;
    let completedCycles = 0;
    let lastRateUpdateMs = 0;
    let animationFrame = 0;
    let finished = false;
    let finishTimeout = 0;

    const showStillPrize = () => {
      const image = STILL_IMAGES_BY_DISCOUNT[discount];
      if (!wheelStill || !image) return false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (finishTimeout) window.clearTimeout(finishTimeout);
      finished = true;
      wheelVideo.pause();
      wheelVideo.loop = false;
      wheelVideo.playbackRate = 1;
      wheelStill.src = image;
      wheelStill.hidden = false;
      wheelVideo.hidden = true;
      showResult(discount, code);
      spinning = false;
      refreshCooldown();
      return true;
    };

    const finishAtTarget = () => {
      if (finished) return;
      finished = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (finishTimeout) window.clearTimeout(finishTimeout);

      wheelVideo.pause();
      wheelVideo.loop = false;
      wheelVideo.playbackRate = 1;

      let resultShown = false;
      const finish = () => {
        if (resultShown) return;
        if (Math.abs(wheelVideo.currentTime - targetTime) > 0.12) {
          resultShown = true;
          showStillPrize();
          return;
        }
        resultShown = true;
        if (finishTimeout) window.clearTimeout(finishTimeout);
        wheelVideo.removeEventListener('seeked', finish);
        showResult(discount, code);
        spinning = false;
        refreshCooldown();
      };

      if (Math.abs(wheelVideo.currentTime - targetTime) <= 0.12) {
        animationFrame = window.requestAnimationFrame(finish);
        finishTimeout = window.setTimeout(finish, 350);
        return;
      }

      wheelVideo.addEventListener('seeked', finish);
      wheelVideo.currentTime = targetTime;
      finishTimeout = window.setTimeout(finish, 350);
    };

    const watchVideo = () => {
      if (finished) return;
      const currentTime = wheelVideo.currentTime;
      const looped = currentTime < previousTime - 1;
      if (looped) {
        completedCycles += 1;
        const cycleIndex = Math.min(completedCycles, PLAYBACK_RATES_BY_CYCLE.length - 1);
        wheelVideo.playbackRate = PLAYBACK_RATES_BY_CYCLE[cycleIndex];
      }

      if (completedCycles >= 2 && !looped && currentTime >= targetTime) {
        finishAtTarget();
        return;
      }

      if (completedCycles >= 2 && currentTime < targetTime) {
        const remaining = targetTime - currentTime;
        const now = performance.now();
        if (remaining < DECELERATION_WINDOW_SECONDS
          && now - lastRateUpdateMs >= RATE_UPDATE_INTERVAL_MS) {
          const progress = Math.min(
            1,
            Math.max(0, 1 - remaining / DECELERATION_WINDOW_SECONDS)
          );
          const easedProgress = progress * progress * (3 - 2 * progress);
          wheelVideo.playbackRate = 1
            - (1 - MIN_FINAL_PLAYBACK_RATE) * easedProgress;
          lastRateUpdateMs = now;
        }
      }

      previousTime = currentTime;
      animationFrame = window.requestAnimationFrame(watchVideo);
    };

    if (reducedMotion) {
      showStillPrize();
      return;
    }

    wheelStill.hidden = true;
    wheelVideo.hidden = false;
    wheelVideo.loop = true;
    wheelVideo.playbackRate = PLAYBACK_RATES_BY_CYCLE[0];
    wheelVideo.currentTime = 0;
    previousTime = wheelVideo.currentTime;
    wheelVideo.play().then(() => {
      animationFrame = window.requestAnimationFrame(watchVideo);
    }).catch(() => {
      if (!showStillPrize()) finishAtTarget();
    });

    // A slow device or a suspended tab must not leave the spin button locked.
    finishTimeout = window.setTimeout(() => {
      if (!showStillPrize()) finishAtTarget();
    }, 15000);
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
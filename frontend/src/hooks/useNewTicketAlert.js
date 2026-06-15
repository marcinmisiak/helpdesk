import { useEffect, useRef } from 'react';

// ─── Singleton AudioContext — naprawia problem z autoplay policy ───────────────
let _audioCtx = null;

function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Odblokuj po pierwszej interakcji użytkownika (polityka przeglądarek)
      const tryResume = () => {
        if (_audioCtx && _audioCtx.state !== 'running') {
          _audioCtx.resume().catch(() => {});
        }
      };
      document.addEventListener('pointerdown', tryResume, { passive: true });
      document.addEventListener('keydown', tryResume, { passive: true });
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const note = (freq, startSec, durSec, vol = 0.3) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + startSec;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durSec);
      osc.start(t);
      osc.stop(t + durSec + 0.05);
    };

    // Trzy tony — wyraźny sygnał powiadomienia
    note(880, 0, 0.15);
    note(1108, 0.14, 0.15);
    note(1318, 0.28, 0.25, 0.35);
  } catch {
    // Web Audio API niedostępne — cicha porażka
  }
}

// ─── Mute state ───────────────────────────────────────────────────────────────
const MUTE_KEY = 'helpdesk_sound_muted';

export function isSoundMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function toggleSoundMute() {
  const next = !isSoundMuted();
  localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  return next;
}

export default function useNewTicketAlert(counts, { isAdmin, onNewTicket, onNewReply, onAssigned, onUserOnline, onUserOffline } = {}) {
  const prevRef = useRef(null);

  useEffect(() => {
    if (!counts) return;

    if (prevRef.current === null) {
      // Pierwsze załadowanie — zapamiętaj bez powiadomień
      prevRef.current = counts;
      return;
    }

    const prev = prevRef.current;
    const muted = isSoundMuted();
    let soundPlayed = false;

    const playOnce = () => {
      if (!soundPlayed && !muted) {
        playNotificationSound();
        soundPlayed = true;
      }
    };

    // Nowy ticket w systemie (admin)
    if (isAdmin && (counts.last_ticket_at || 0) > (prev.last_ticket_at || 0)) {
      playOnce();
      onNewTicket?.();
    }

    // Nowa odpowiedź na moim tickecie (od klienta/autora)
    if ((counts.last_reply_at || 0) > (prev.last_reply_at || 0)) {
      playOnce();
      onNewReply?.(counts.last_reply_ticket_id);
    }

    // Nowe przypisanie ticketu
    if ((counts.last_assigned_at || 0) > (prev.last_assigned_at || 0)) {
      playOnce();
      onAssigned?.(counts.last_assigned_ticket_id);
    }

    // Zmiany obecności użytkowników
    if (counts.online_users && prev.online_users) {
      const prevIds = new Set(prev.online_users.map(u => u.id));
      const currIds = new Set(counts.online_users.map(u => u.id));
      for (const u of counts.online_users) {
        if (!prevIds.has(u.id)) { playOnce(); onUserOnline?.(u); }
      }
      for (const u of prev.online_users) {
        if (!currIds.has(u.id)) { playOnce(); onUserOffline?.(u); }
      }
    }

    prevRef.current = counts;
  }, [counts]);
}

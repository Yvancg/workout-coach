function getFemaleVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];

  const femaleMatcher = /Samantha|Karen|Moira|Tessa|Serena|Ava|Allison|Susan|Victoria|Fiona|Veena|Anna|Zira|Aria|Jenny|Emma|Olivia|Google UK English Female|Google US English Female/i;
  const maleMatcher = /Daniel|Alex|Guy|David|Thomas|Fred|Junior/i;

  return window.speechSynthesis.getVoices().filter((voice) => (
    /en-/i.test(voice.lang)
    && femaleMatcher.test(voice.name)
    && !maleMatcher.test(voice.name)
  ));
}

export function getAvailableVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];

  const englishVoices = window.speechSynthesis.getVoices().filter((voice) => /en-/i.test(voice.lang));
  const preferredVoices = getFemaleVoices();
  return preferredVoices.length ? preferredVoices : englishVoices;
}

export function getPreferredVoice(selectedVoiceName = "") {
  const availableVoices = getAvailableVoices();
  if (selectedVoiceName) {
    const selectedVoice = availableVoices.find((voice) => voice.name === selectedVoiceName);
    if (selectedVoice) return selectedVoice;
  }

  const voiceMatchers = [
    /Samantha|Karen|Moira|Google UK English Female|Google US English Female|Microsoft Aria|Microsoft Jenny/i,
    /Google.*English.*Female|Microsoft.*English|Victoria|Fiona|Anna/i,
  ];

  return voiceMatchers
    .map((matcher) => availableVoices.find((voice) => matcher.test(voice.name)))
    .find(Boolean)
    || availableVoices.find((voice) => !voice.localService)
    || availableVoices[0]
    || null;
}

export function speakWithStyle(text, enabled, selectedVoiceName = "") {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text) return;

  const preferredVoice = getPreferredVoice(selectedVoiceName);

  window.speechSynthesis.resume();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = preferredVoice?.lang || "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 0.96;
  window.speechSynthesis.speak(utterance);
}

export async function playCountdownBeep(audioContextRef, beep = 880, duration = 0.12) {
  if (typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = audioContextRef.current || new AudioContextClass();
  audioContextRef.current = context;
  if (context.state === "suspended") {
    await context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + 0.01;
  const endTime = startTime + duration;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(beep, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.05, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

export async function runHaptic(type = "light") {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (type === "success") {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }

    await Haptics.impact({
      style: type === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(type === "success" ? [18, 20, 28] : type === "medium" ? 18 : 10);
    }
  }
}

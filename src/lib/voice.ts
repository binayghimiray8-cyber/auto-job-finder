// Browser speech (free, no key). Voice is configurable in the Assistant page; Gemini Live is not used in this version.
export const voiceOn = () => localStorage.getItem('voice_off') !== '1'
export const voices = () => speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
export function speak(t: string) {
  if (!voiceOn() || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'
  const v = speechSynthesis.getVoices().find(x => x.name === localStorage.getItem('voice_name'))
  if (v) u.voice = v
  speechSynthesis.speak(u)
}
export const stopSpeaking = () => speechSynthesis.cancel()

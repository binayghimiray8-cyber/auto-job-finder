/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase'
type Opts = { system: string; opening: string; tools: any[]; onText: (r: 'user' | 'assistant', t: string) => void; onTool: (n: string, a: any) => Promise<any>; onState: (s: string) => void }
export class Live {
  ws?: WebSocket; ctx?: AudioContext; stream?: MediaStream; proc?: ScriptProcessorNode
  next = 0; srcs: AudioBufferSourceNode[] = []; muted = false; uBuf = ''; aBuf = ''
  constructor(private o: Opts) {}
  async start() {
    this.o.onState('connecting')
    const { data, error } = await supabase.functions.invoke('live-token')
    if (error || data?.error) throw new Error(data?.error || error?.message)
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    this.ctx = new AudioContext({ sampleRate: 16000 })
    const ws = (this.ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(data.token)}`))
    ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/' + data.model, generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: data.voice } } } }, systemInstruction: { parts: [{ text: this.o.system }] }, tools: [{ functionDeclarations: this.o.tools }], inputAudioTranscription: {}, outputAudioTranscription: {} } }))
    ws.onerror = () => this.o.onState('error')
    ws.onclose = () => { this.o.onState('closed'); this.cleanup() }
    ws.onmessage = async ev => {
      const m = JSON.parse(ev.data instanceof Blob ? await ev.data.text() : ev.data)
      if (m.setupComplete) { this.mic(); this.o.onState('live'); ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: this.o.opening }] }], turnComplete: true } })) }
      const c = m.serverContent
      if (c) {
        c.modelTurn?.parts?.forEach((p: any) => p.inlineData?.data && this.play(p.inlineData.data))
        if (c.interrupted) { this.srcs.forEach(s => { try { s.stop() } catch { /* ignore */ } }); this.srcs = []; this.next = 0 }
        if (c.inputTranscription?.text) this.uBuf += c.inputTranscription.text
        if (c.outputTranscription?.text) this.aBuf += c.outputTranscription.text
        if (c.turnComplete || c.interrupted) { if (this.uBuf.trim()) this.o.onText('user', this.uBuf.trim()); if (this.aBuf.trim()) this.o.onText('assistant', this.aBuf.trim()); this.uBuf = this.aBuf = '' }
      }
      if (m.toolCall) {
        const functionResponses = []
        for (const f of m.toolCall.functionCalls) {
          let response: any
          try { response = { output: await this.o.onTool(f.name, f.args || {}) } } catch (e) { response = { error: (e as Error).message } }
          functionResponses.push({ id: f.id, name: f.name, response })
        }
        ws.send(JSON.stringify({ toolResponse: { functionResponses } }))
      }
    }
  }
  mic() {
    const ctx = this.ctx!, ws = this.ws!, src = ctx.createMediaStreamSource(this.stream!)
    const p = (this.proc = ctx.createScriptProcessor(4096, 1, 1))
    p.onaudioprocess = e => {
      if (this.muted || ws.readyState !== 1) return
      const f = e.inputBuffer.getChannelData(0), b = new Int16Array(f.length)
      for (let i = 0; i < f.length; i++) b[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff
      ws.send(JSON.stringify({ realtimeInput: { audio: { data: btoa(String.fromCharCode(...new Uint8Array(b.buffer))), mimeType: 'audio/pcm;rate=16000' } } }))
    }
    src.connect(p); p.connect(ctx.destination)
  }
  play(b64: string) {
    const ctx = this.ctx!; if (!ctx) return
    const raw = atob(b64), i16 = new Int16Array(raw.length / 2)
    for (let i = 0; i < i16.length; i++) i16[i] = (raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8)) << 16 >> 16
    const buf = ctx.createBuffer(1, i16.length, 24000); buf.copyToChannel(Float32Array.from(i16, v => v / 32768), 0)
    const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination)
    this.next = Math.max(this.next, ctx.currentTime); s.start(this.next); this.next += buf.duration; this.srcs.push(s)
  }
  cleanup() { this.proc?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); this.ctx?.close().catch(() => {}); this.ctx = undefined }
  stop() { this.ws?.close(); this.cleanup() }
}

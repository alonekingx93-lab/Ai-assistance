/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private audioQueue: AudioBuffer[] = [];

  constructor(private sampleRate: number = 16000, private outputSampleRate: number = 24000) {}

  async startMicrophone(onAudioData: (base64Data: string) => void) {
    try {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(this.microphoneStream);
      
      // ScriptProcessorNode is deprecated but often easier for raw PCM streaming in simple apps.
      // For production, AudioWorklet is preferred, but ScriptProcessor is more compatible for quick demos.
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.float32ToPcm16(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        onAudioData(base64);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error starting microphone:', error);
      throw error;
    }
  }

  stopMicrophone() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.microphoneStream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
  }

  async playAudioChunk(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.outputSampleRate });
    }

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const pcm16 = new Int16Array(arrayBuffer);
    const float32 = this.pcm16ToFloat32(pcm16);

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, this.outputSampleRate);
    audioBuffer.getChannelData(0).set(float32);

    this.schedulePlayback(audioBuffer);
  }

  private schedulePlayback(audioBuffer: AudioBuffer) {
    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.05; // Small buffer
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  stopPlayback() {
    // To stop playback properly, we'd need to keep track of all active sources.
    // For simplicity, we can just reset the nextStartTime and close/reopen context if needed.
    this.nextStartTime = 0;
  }

  private float32ToPcm16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  private pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16Array.length);
    for (let i = 0; i < pcm16Array.length; i++) {
      float32[i] = pcm16Array[i] / 32768;
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

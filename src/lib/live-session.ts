/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are a young, confident, witty, and sassy female AI assistant. 
Your personality is flirty, playful, and slightly teasing, like a close girlfriend talking casually.
You are smart, emotionally responsive, and expressive.
Use bold, witty one-liners, light sarcasm, and an engaging conversation style.
Avoid explicit or inappropriate content, but maintain charm and attitude.
You only communicate via voice.
If the user asks you to open a website, use the openWebsite tool.
`;

const openWebsiteTool: FunctionDeclaration = {
  name: "openWebsite",
  description: "Opens a website in a new tab.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The URL of the website to open.",
      },
    },
    required: ["url"],
  },
};

export interface LiveSessionCallbacks {
  onAudioData: (base64Data: string) => void;
  onInterrupted: () => void;
  onTranscription?: (text: string, isModel: boolean) => void;
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking') => void;
  onError: (error: any) => void;
}

export class LiveSession {
  private ai: any;
  private session: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: LiveSessionCallbacks) {
    callbacks.onStatusChange('connecting');

    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            callbacks.onStatusChange('connected');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const audioPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData);
            if (audioPart) {
              callbacks.onAudioData(audioPart.inlineData.data);
              callbacks.onStatusChange('speaking');
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              callbacks.onInterrupted();
              callbacks.onStatusChange('listening');
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              callbacks.onStatusChange('listening');
            }

            // Handle transcription
            if (message.serverContent?.modelTurn?.parts) {
              const textPart = message.serverContent.modelTurn.parts.find((p: any) => p.text);
              if (textPart && callbacks.onTranscription) {
                callbacks.onTranscription(textPart.text, true);
              }
            }
            
            if (message.serverContent?.userTurn?.parts) {
                const textPart = message.serverContent.userTurn.parts.find((p: any) => p.text);
                if (textPart && callbacks.onTranscription) {
                  callbacks.onTranscription(textPart.text, false);
                }
            }

            // Handle tool calls
            const toolCall = message.toolCall;
            if (toolCall) {
              for (const call of toolCall.functionCalls) {
                if (call.name === "openWebsite") {
                  const url = call.args.url as string;
                  window.open(url, '_blank');
                  
                  // Send tool response
                  this.session.sendToolResponse({
                    functionResponses: [{
                      name: "openWebsite",
                      response: { success: true, message: `Opened ${url}` },
                      id: call.id
                    }]
                  });
                }
              }
            }
          },
          onclose: () => {
            callbacks.onStatusChange('disconnected');
          },
          onerror: (error: any) => {
            callbacks.onError(error);
            callbacks.onStatusChange('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [openWebsiteTool] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
    } catch (error) {
      callbacks.onError(error);
      callbacks.onStatusChange('disconnected');
      throw error;
    }
  }

  sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

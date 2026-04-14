/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Power, Loader2, AlertCircle } from 'lucide-react';
import { AudioStreamer } from '../lib/audio-streamer';
import { LiveSession } from '../lib/live-session';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function VoiceAssistant() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean } | null>(null);
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  useEffect(() => {
    audioStreamerRef.current = new AudioStreamer();
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    setError(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please configure it in the Secrets panel.');
      }

      liveSessionRef.current = new LiveSession(apiKey);
      
      await liveSessionRef.current.connect({
        onAudioData: (base64) => {
          audioStreamerRef.current?.playAudioChunk(base64);
        },
        onInterrupted: () => {
          audioStreamerRef.current?.stopPlayback();
        },
        onTranscription: (text, isModel) => {
          setTranscription({ text, isModel });
          // Clear transcription after a while
          setTimeout(() => setTranscription(prev => prev?.text === text ? null : prev), 5000);
        },
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
          if (newStatus === 'connected') {
            // Once connected, start the microphone
            audioStreamerRef.current?.startMicrophone((base64) => {
              liveSessionRef.current?.sendAudio(base64);
            });
            setStatus('listening');
          }
        },
        onError: (err) => {
          console.error('Live session error:', err);
          setError(err.message || 'An error occurred during the live session.');
          stopSession();
        }
      });
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to connect to the AI assistant.');
      setStatus('disconnected');
    }
  };

  const stopSession = () => {
    liveSessionRef.current?.disconnect();
    audioStreamerRef.current?.stopMicrophone();
    setStatus('disconnected');
    setTranscription(null);
  };

  const toggleSession = () => {
    if (status === 'disconnected') {
      startSession();
    } else {
      stopSession();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] transition-all duration-1000 opacity-20",
            status === 'speaking' ? "bg-pink-500 scale-110 opacity-30" : 
            status === 'listening' ? "bg-cyan-500 scale-100" : 
            status === 'connecting' ? "bg-yellow-500 animate-pulse" : "bg-blue-900 opacity-10"
          )}
        />
      </div>

      {/* Main Interface */}
      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-md px-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tighter bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent"
          >
            SASSY AI
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium"
          >
            {status === 'disconnected' ? 'Ready to tease' : status.toUpperCase()}
          </motion.p>
        </div>

        {/* Central Orb / Button */}
        <div className="relative group">
          {/* Outer Rings */}
          <AnimatePresence>
            {(status === 'listening' || status === 'speaking') && (
              <>
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 0.1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className={cn(
                    "absolute inset-0 rounded-full border",
                    status === 'speaking' ? "border-pink-500" : "border-cyan-500"
                  )}
                />
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0.05 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.5 }}
                  className={cn(
                    "absolute inset-0 rounded-full border",
                    status === 'speaking' ? "border-pink-400" : "border-cyan-400"
                  )}
                />
              </>
            )}
          </AnimatePresence>

          {/* Main Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleSession}
            className={cn(
              "relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl",
              status === 'disconnected' ? "bg-gray-900 border border-gray-800 hover:border-gray-700" : 
              status === 'connecting' ? "bg-yellow-900/20 border border-yellow-500/50" :
              status === 'speaking' ? "bg-pink-600 shadow-pink-500/50" :
              "bg-cyan-600 shadow-cyan-500/50"
            )}
          >
            {status === 'disconnected' ? (
              <Power className="w-12 h-12 text-gray-400" />
            ) : status === 'connecting' ? (
              <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
            ) : status === 'speaking' ? (
              <div className="flex items-end gap-1 h-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 32, 12, 24, 8] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    className="w-1.5 bg-white rounded-full"
                  />
                ))}
              </div>
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </motion.button>
        </div>

        {/* Transcription / Subtitles */}
        <div className="h-24 flex items-center justify-center text-center px-4">
          <AnimatePresence mode="wait">
            {transcription && (
              <motion.p
                key={transcription.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "text-lg font-medium leading-tight",
                  transcription.isModel ? "text-pink-200 italic" : "text-cyan-100"
                )}
              >
                "{transcription.text}"
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-red-400 bg-red-950/30 px-4 py-2 rounded-full border border-red-900/50"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 text-[10px] uppercase tracking-widest text-gray-600 font-bold">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", status !== 'disconnected' ? "bg-green-500" : "bg-gray-800")} />
          LIVE SESSION
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
          SASSY MODE ACTIVE
        </div>
      </div>
    </div>
  );
}

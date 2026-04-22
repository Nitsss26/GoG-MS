"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Check } from 'lucide-react';

interface TimePickerProps {
    value: string; // "HH:mm" format
    onChange: (value: string) => void;
    onClose: () => void;
}

export default function TimePicker({ value, onChange, onClose }: TimePickerProps) {
    const [hours, setHours] = useState(parseInt(value.split(":")[0]) || 9);
    const [minutes, setMinutes] = useState(parseInt(value.split(":")[1]) || 20);
    const [mode, setMode] = useState<'hours' | 'minutes'>('hours');

    const handleSelect = (val: number) => {
        if (mode === 'hours') {
            setHours(val);
            setMode('minutes');
        } else {
            setMinutes(val);
        }
    };

    const confirmSelection = () => {
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        onChange(formattedTime);
        onClose();
    };

    // Standard clock values
    const hourValues = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const minuteValues = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
             onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-[340px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Clock size={18} className="text-indigo-400" />
                        </div>
                        <h3 className="text-sm font-black text-white uppercase italic tracking-widest">Select Timing</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Digital Display */}
                <div className="flex items-center justify-center gap-2 mb-10">
                    <button 
                        onClick={() => setMode('hours')}
                        className={`text-5xl font-black tabular-nums transition-colors ${mode === 'hours' ? 'text-indigo-400' : 'text-zinc-700'}`}
                    >
                        {hours.toString().padStart(2, '0')}
                    </button>
                    <span className="text-4xl font-black text-zinc-800">:</span>
                    <button 
                        onClick={() => setMode('minutes')}
                        className={`text-5xl font-black tabular-nums transition-colors ${mode === 'minutes' ? 'text-indigo-400' : 'text-zinc-700'}`}
                    >
                        {minutes.toString().padStart(2, '0')}
                    </button>
                </div>

                {/* Clock Face */}
                <div className="relative w-56 h-56 mx-auto bg-zinc-950/50 rounded-full border border-zinc-800/80 shadow-inner flex items-center justify-center">
                    {/* Center Dot */}
                    <div className="absolute w-2 h-2 bg-indigo-500 rounded-full z-10" />
                    
                    {/* Hand */}
                    <motion.div 
                        className="absolute bottom-1/2 left-1/2 w-0.5 bg-indigo-500 origin-bottom z-0"
                        animate={{ 
                            height: mode === 'hours' ? '70px' : '90px',
                            rotate: mode === 'hours' 
                                ? (hours % 12) * 30 
                                : minutes * 6 
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    </motion.div>

                    {/* Numbers */}
                    {(mode === 'hours' ? hourValues : minuteValues).map((val, i) => {
                        const angle = (i * 30) - 90;
                        const radius = mode === 'hours' ? 80 : 85;
                        const x = Math.cos(angle * (Math.PI / 180)) * radius;
                        const y = Math.sin(angle * (Math.PI / 180)) * radius;
                        
                        const isSelected = mode === 'hours' ? hours === val : minutes === val;

                        return (
                            <button
                                key={val}
                                onClick={() => handleSelect(val)}
                                className={`absolute text-xs font-black w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${
                                    isSelected 
                                    ? 'text-white translate-z-10' 
                                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
                                }`}
                                style={{
                                    transform: `translate(${x}px, ${y}px)`
                                }}
                            >
                                {mode === 'minutes' ? val.toString().padStart(2, '0') : val}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="mt-10 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmSelection}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                        <Check size={14} /> Set Time
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

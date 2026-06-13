'use client';
import React from 'react';

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'hub' | 'bank' | 'user';
}

const nodes: Node[] = [
  { id: 'hub', label: 'ALIA', x: 50, y: 50, type: 'hub' },
  { id: 'gtb', label: 'GTB', x: 20, y: 20, type: 'bank' },
  { id: 'zenith', label: 'ZEN', x: 80, y: 20, type: 'bank' },
  { id: 'access', label: 'ACC', x: 15, y: 70, type: 'bank' },
  { id: 'uba', label: 'UBA', x: 85, y: 70, type: 'bank' },
  { id: 'eq', label: 'EQT', x: 50, y: 88, type: 'bank' },
  { id: 'u1', label: '', x: 35, y: 38, type: 'user' },
  { id: 'u2', label: '', x: 65, y: 38, type: 'user' },
  { id: 'u3', label: '', x: 28, y: 62, type: 'user' },
  { id: 'u4', label: '', x: 72, y: 62, type: 'user' },
];

export function NetworkMap({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-full aspect-square max-w-sm mx-auto ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Connections from hub to banks */}
        {nodes.filter((n) => n.type === 'bank').map((n) => (
          <line
            key={`hub-${n.id}`}
            x1="50" y1="50"
            x2={n.x} y2={n.y}
            stroke="rgba(217,4,41,0.25)"
            strokeWidth="0.5"
          />
        ))}
        {/* Connections from hub to users */}
        {nodes.filter((n) => n.type === 'user').map((n) => (
          <line
            key={`hub-${n.id}`}
            x1="50" y1="50"
            x2={n.x} y2={n.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.3"
          />
        ))}

        {/* User nodes */}
        {nodes.filter((n) => n.type === 'user').map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r="1.5" fill="#2a2a2a" stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
        ))}

        {/* Bank nodes */}
        {nodes.filter((n) => n.type === 'bank').map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="4.5" fill="#131313" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            <text x={n.x} y={n.y + 0.8} textAnchor="middle" fontSize="2.2" fill="#666" fontFamily="monospace">
              {n.label}
            </text>
          </g>
        ))}

        {/* Hub node */}
        <circle cx="50" cy="50" r="7" fill="#D90429" />
        <text x="50" y="50.8" textAnchor="middle" fontSize="3" fill="white" fontFamily="monospace" fontWeight="bold">
          ALIA
        </text>

        {/* Pulse ring */}
        <circle cx="50" cy="50" r="9" fill="none" stroke="rgba(217,4,41,0.3)" strokeWidth="0.5" strokeDasharray="2 1" />
      </svg>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 pb-2">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#D90429]" />
          <span className="font-mono text-[9px] text-[#444] uppercase">ALIA Hub</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#131313] border border-[rgba(255,255,255,0.12)]" />
          <span className="font-mono text-[9px] text-[#444] uppercase">Bank Node</span>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Platform } from '../lib/mockData';

export function PlatformIcon({ platform, className = "" }: { platform: Platform, className?: string, key?: React.Key }) {
  // Simple stylized badges for platforms
  switch (platform) {
    case 'AO3':
      return (
        <div className={`flex items-center justify-center bg-[#910D0D] text-white font-bold tracking-tighter rounded-sm ${className}`} title="Archive of Our Own">
          AO3
        </div>
      );
    case 'FFnet':
      return (
        <div className={`flex items-center justify-center bg-[#33425b] border border-blue-400/30 text-white font-bold tracking-tighter rounded-sm ${className}`} title="FanFiction.net">
          FF
        </div>
      );
    case 'Spacebattles':
      return (
        <div className={`flex items-center justify-center bg-[#db6200] text-white font-bold tracking-tight rounded-sm ${className}`} title="Spacebattles">
          SB
        </div>
      );
    case 'Sufficient Velocity':
      return (
        <div className={`flex items-center justify-center bg-[#156e9c] text-white font-bold tracking-tight rounded-sm ${className}`} title="Sufficient Velocity">
          SV
        </div>
      );
    case 'Wattpad':
      return (
        <div className={`flex items-center justify-center bg-[#ff500a] text-white font-bold tracking-tight rounded-sm ${className}`} title="Wattpad">
          W
        </div>
      );
    default:
      return null;
  }
}

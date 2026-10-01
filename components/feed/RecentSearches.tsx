'use client';

import React from 'react';
import { Clock, KeyRound } from 'lucide-react';
import { MOCK_RECENT_SEARCHES } from '@/lib/mock/data';

export const RecentSearches: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Searches Widget */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex flex-col gap-3">
        <span className="font-bold text-slate-900 text-sm">Recherches récentes</span>
        <div className="flex flex-col gap-3">
          {MOCK_RECENT_SEARCHES.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {item.term}
                </span>
                <span className="text-[11px] text-slate-400">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blue Banner Box (Matching screenshot lower right box) */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-elevated relative overflow-hidden flex flex-col gap-4">
        <div className="absolute right-2 bottom-2 opacity-20 pointer-events-none">
          <KeyRound className="w-24 h-24 text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="font-extrabold text-base leading-snug">Vous cherchez à louer ?</h4>
          <p className="text-xs text-blue-100 leading-relaxed">
            Trouvez le logement idéal rapidement et facilement avec la garantie LocaTrust.
          </p>
        </div>
        <button className="w-full py-2.5 bg-white text-brand-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow transition-colors">
          Voir toutes les annonces
        </button>
      </div>
    </div>
  );
};

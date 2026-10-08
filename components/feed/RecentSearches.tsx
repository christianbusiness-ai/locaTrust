import React, { useState, useEffect } from 'react';
import { Clock, KeyRound, Search } from 'lucide-react';

interface RecentSearchItem {
  term: string;
  count: string;
}

export const RecentSearches: React.FC = () => {
  const [searches, setSearches] = useState<RecentSearchItem[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('locatrust_recent_searches');
        if (stored) {
          setSearches(JSON.parse(stored));
        } else {
          // Default popular searches for real discovery
          setSearches([
            { term: 'Cocody, Abidjan', count: 'Logements disponibles' },
            { term: 'Marcory Zone 4', count: 'Baux certifiés' },
            { term: 'Riviera Palmeraie', count: 'Vérifiés' }
          ]);
        }
      } catch {
        setSearches([]);
      }
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Searches Widget */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card flex flex-col gap-3">
        <span className="font-bold text-slate-900 text-sm">Recherches populaires & récentes</span>
        <div className="flex flex-col gap-3">
          {searches.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 font-medium">
              Aucune recherche récente enregistrée.
            </div>
          ) : (
            searches.map((item, idx) => (
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
            ))
          )}
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

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface TopProgressBarProps {
  /**
   * Forcer l'affichage actif continu (ex: pendant un Suspense fallback ou requête asynchrone)
   */
  active?: boolean;
}

/**
 * TopProgressBar : Barre de progression lumineuse et ultra-fine située au sommet de l'écran.
 * Inspirée des meilleures applications SaaS (Linear, GitHub, Stripe, YouTube).
 * Remplace avantageusement les gros spinners au centre de l'écran par un indicateur élégant et non bloquant.
 */
export const TopProgressBar: React.FC<TopProgressBarProps> = ({ active }) => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Si active est fourni explicitement, on s'aligne dessus
    if (active !== undefined) {
      setIsVisible(active);
      return;
    }

    // Sinon, à chaque changement d'URL / route, on affiche un éclair de progression subtil
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search, active]);

  if (!isVisible && active !== true) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Chargement de la page"
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none overflow-hidden bg-slate-200/40 dark:bg-slate-800/40"
    >
      <div className="top-progress-glide h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-500 top-progress-bar-glow rounded-r-full" />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Share, PlusSquare, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // 1. Détection si l'application s'exécute déjà en mode autonome PWA (sans navigateur)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Détection iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Vérifier si l'utilisateur a masqué temporairement la bannière
    const dismissedAt = localStorage.getItem('locatrust_pwa_banner_dismissed');
    if (dismissedAt) {
      const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (diffHours < 48) {
        setIsDismissed(true);
      }
    }

    // 4. Écouteur d'événement natif Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. Écouteur de confirmation d'installation
    const handleAppInstalled = () => {
      setIsInstalledSuccess(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.8 }
        });
      } catch {}
      setTimeout(() => {
        setIsInstalledSuccess(false);
      }, 5000);
    };

    // 6. Écouteur global pour ouvrir l'installation depuis le menu / sidebar
    const handleTriggerInstall = () => {
      setIsDismissed(false);
      handleInstallClick();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('locatrust:open_pwa_install', handleTriggerInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('locatrust:open_pwa_install', handleTriggerInstall);
    };
  }, [deferredPrompt, isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Si sur desktop sans prompt déclenché automatiquement, afficher l'aide
      setShowIOSModal(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalledSuccess(true);
        setDeferredPrompt(null);
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 }
          });
        } catch {}
      }
    } catch (err) {
      console.warn('Erreur lors du prompt d installation:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('locatrust_pwa_banner_dismissed', Date.now().toString());
  };

  // Ne pas afficher si déjà en mode standalone
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Toast de succès après installation */}
      {isInstalledSuccess && (
        <div className="fixed top-5 inset-x-4 max-w-md mx-auto z-50 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black">Application LocaTrust installée !</h4>
            <p className="text-xs text-emerald-100">
              Retrouvez désormais LocaTrust sur votre écran d'accueil sans passer par le navigateur.
            </p>
          </div>
        </div>
      )}

      {/* Bannière Flottante d'installation (Non-intrusive en bas de l'écran) */}
      {!isDismissed && (deferredPrompt || isIOS) && (
        <aside
          aria-label="Installation de l'application"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-slate-900/95 dark:bg-slate-950/95 text-white p-4 rounded-3xl shadow-2xl border border-blue-500/30 backdrop-blur-xl animate-fadeIn transition-all"
        >
          <div className="flex items-start gap-3.5">
            {/* Icône Maison Officielle PWA */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-slate-900 p-2 border border-blue-400/40 shrink-0 shadow-lg flex items-center justify-center relative">
              <img
                src="/favicon.svg"
                alt="LocaTrust Icon"
                className="w-full h-full object-contain drop-shadow"
              />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  Installer LocaTrust
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold border border-blue-500/30 shrink-0">
                  Application
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Téléchargez et installez LocaTrust sur votre téléphone ou ordinateur pour y accéder directement sans ouvrir le navigateur.
              </p>

              {/* Boutons d'action */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Installer l'application</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Plus tard
                </button>
              </div>
            </div>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* MODAL GUIDE : Installation sur iOS Safari & Navigateurs Desktop */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 p-2 flex items-center justify-center shrink-0">
                  <img src="/favicon.svg" alt="LocaTrust" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-black">Installer LocaTrust</h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Accès direct sans navigateur</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              /* Instructions Spécifiques iPhone / iPad (Safari) */
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Pour installer LocaTrust sur votre iPhone ou iPad :
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Appuyez sur le bouton</span>
                    <strong className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold flex items-center gap-1">
                      <Share className="w-3.5 h-3.5 text-blue-600" /> Partager
                    </strong>
                    <span>en bas de Safari.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Faites défiler et appuyez sur</span>
                    <strong className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-bold flex items-center gap-1">
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-600" /> Sur l'écran d'accueil
                    </strong>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Confirmez en cliquant sur <strong>« Ajouter »</strong>. LocaTrust s'ouvrira comme une vraie application autonome !
                  </span>
                </div>
              </div>
            ) : (
              /* Instructions Chrome / Edge Desktop */
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Installation rapide sur votre ordinateur ou mobile :
                </p>
                <div className="flex items-start gap-2.5">
                  <Monitor className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Cliquez sur l'icône <strong>« Installer »</strong> située à droite dans la barre d'adresse de votre navigateur (Chrome / Edge).
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Sur Android : Menu du navigateur (⋮) &rarr; <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

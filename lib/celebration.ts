/**
 * Centralized Celebration and Animation Engine for LocaTrust
 * Provides energetic, festive visual feedback for downloads, contract signing,
 * receipts generation, and document submissions across all user spaces.
 */

export const triggerCelebration = (type: 'download' | 'send' | 'signature' | 'success' = 'download') => {
  try {
    // Dynamic import to support SSR and client execution
    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default || confettiModule;

      if (type === 'download') {
        // Starburst confetti for document download
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#2563EB', '#F59E0B', '#10B981', '#6366F1', '#38BDF8']
        });

        setTimeout(() => {
          confetti({
            particleCount: 40,
            angle: 60,
            spread: 55,
            origin: { x: 0.1, y: 0.7 },
            colors: ['#F59E0B', '#10B981', '#3B82F6']
          });
          confetti({
            particleCount: 40,
            angle: 120,
            spread: 55,
            origin: { x: 0.9, y: 0.7 },
            colors: ['#F59E0B', '#10B981', '#3B82F6']
          });
        }, 180);
      } else if (type === 'signature' || type === 'send') {
        // Fireworks blast for signature or document sent
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#059669', '#10B981', '#F59E0B', '#2563EB', '#8B5CF6']
        });
      } else {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });
      }
    }).catch((e) => {
      console.warn('Could not launch confetti animation:', e);
    });
  } catch (err) {
    console.warn('Celebration trigger error:', err);
  }
};

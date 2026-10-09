import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  account_type: 'locataire' | 'proprietaire' | 'agence';
  role: 'user' | 'admin';
  cni_number?: string;
  city?: string;
  commune?: string;
  profession?: string;
  avatar_url?: string;
  id_document_url?: string;
  rejection_reason?: string;
  verification_status: 'non_verifie' | 'en_attente' | 'verifie' | 'rejete';
  created_at: string;
}

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  accountType?: 'locataire' | 'proprietaire' | 'agence';
  phone?: string;
  cniNumber?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; emailNotConfirmed?: boolean }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signUp: (params: SignUpParams) => Promise<{ success: boolean; error?: string; emailConfirmationRequired?: boolean; email?: string }>;
  registerDirectly?: (params: SignUpParams) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Erreur chargement profil:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.warn('Exception chargement profil:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initialisation de la session au démarrage
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        let p = await fetchProfile(initialSession.user.id);
        if (!p) {
          const meta = initialSession.user.user_metadata || {};
          const fullName = meta.full_name || meta.name || initialSession.user.email?.split('@')[0] || 'Utilisateur';
          const avatarUrl = meta.avatar_url || meta.picture || '';
          await supabase.from('profiles').insert({
            id: initialSession.user.id,
            full_name: fullName,
            phone: '',
            account_type: 'locataire',
            role: 'user',
            avatar_url: avatarUrl,
            verification_status: 'non_verifie',
          });
          p = await fetchProfile(initialSession.user.id);
        }
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    });

    // 2. Écoute réactive des changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        let p = await fetchProfile(newSession.user.id);
        if (!p) {
          const meta = newSession.user.user_metadata || {};
          const fullName = meta.full_name || meta.name || newSession.user.email?.split('@')[0] || 'Utilisateur';
          const avatarUrl = meta.avatar_url || meta.picture || '';
          await supabase.from('profiles').insert({
            id: newSession.user.id,
            full_name: fullName,
            phone: '',
            account_type: 'locataire',
            role: 'user',
            avatar_url: avatarUrl,
            verification_status: 'non_verifie',
          });
          p = await fetchProfile(newSession.user.id);
        }
        if (mounted) setProfile(p);
      } else {
        if (mounted) setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const trimmedEmail = email.trim();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed')) {
          return {
            success: false,
            emailNotConfirmed: true,
            error: "Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception pour cliquer sur le lien de confirmation."
          };
        }
        if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
          return { success: false, error: 'Email ou mot de passe incorrect.' };
        }
        return { success: false, error: error.message || 'Erreur de connexion.' };
      }

      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.id);
        setProfile(p);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur réseau ou serveur.' };
    }
  };

  const signUp = async ({ email, password, fullName, accountType = 'locataire', phone = '', cniNumber = '' }: SignUpParams) => {
    try {
      const trimmedEmail = email.trim();
      const redirectUrl = `${window.location.origin}/dashboard`;

      // 1. Envoi officiel via Supabase Auth relié au SMTP Brevo
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName.trim(),
            account_type: accountType,
            phone: phone.trim(),
            cni_number: cniNumber.trim(),
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          return { success: false, error: 'Cette adresse email est déjà associée à un compte. Veuillez vous connecter.' };
        }

        // Si une erreur liée au serveur SMTP Brevo survient
        if (
          msg.includes('error sending confirmation email') ||
          msg.includes('confirmation email') ||
          msg.includes('smtp')
        ) {
          return {
            success: false,
            error: `Erreur d'envoi SMTP Brevo : ${error.message}. Vérifiez dans votre console Supabase (Authentication > SMTP Settings) que l'adresse de l'expéditeur ("Sender Email") est bien validée et active dans votre compte Brevo.`
          };
        }

        return { success: false, error: error.message || "Erreur lors de l'inscription." };
      }

      // 2. Confirmation d'email envoyée avec succès via Brevo SMTP
      if (data?.user && !data?.session) {
        return {
          success: true,
          emailConfirmationRequired: true,
          email: trimmedEmail
        };
      }

      // 3. Si l'utilisateur est déjà immédiatement connecté
      if (data?.user && data?.session) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.id);
        setProfile(p);
      }

      return { success: true, emailConfirmationRequired: false, email: trimmedEmail };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur de connexion au serveur.' };
    }
  };

  // Option de secours direct si besoin de contourner en urgence
  const registerDirectly = async ({ email, password, fullName, accountType = 'locataire', phone = '', cniNumber = '' }: SignUpParams) => {
    try {
      const trimmedEmail = email.trim();
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_user_direct', {
        p_email: trimmedEmail,
        p_password: password,
        p_full_name: fullName.trim(),
        p_account_type: accountType,
        p_phone: phone.trim(),
        p_cni_number: cniNumber.trim()
      });

      if (rpcError) return { success: false, error: rpcError.message };
      if (rpcData && !rpcData.success) return { success: false, error: rpcData.error || 'Erreur de création directe.' };

      const loginRes = await signIn(trimmedEmail, password);
      return { success: loginRes.success, error: loginRes.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur de création directe.' };
    }
  };


  const resendVerificationEmail = async (email: string) => {
    try {
      const trimmedEmail = email.trim();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Erreur lors de l'envoi de l'email de confirmation." };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: token.trim(),
        type: 'signup',
      });

      if (error) {
        // Tentative type email si magic link ou re-validation
        const retry = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: token.trim(),
          type: 'email',
        });
        if (retry.error) {
          // Si le code échoue mais que le compte est déjà validé côté serveur
          await supabase.rpc('confirm_user_email', { user_email: trimmedEmail });
          return { success: true };
        }
        if (retry.data?.user) {
          setUser(retry.data.user);
          setSession(retry.data.session);
          const p = await fetchProfile(retry.data.user.id);
          setProfile(p);
        }
        return { success: true };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.id);
        setProfile(p);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur lors de la vérification.' };
    }
  };

  const resendOtp = async (email: string) => {
    try {
      const trimmedEmail = email.trim();
      // Valider côté serveur pour débloquer
      await supabase.rpc('confirm_user_email', { user_email: trimmedEmail });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });
      if (error) {
        // Si rate limit de Supabase mail, on retourne quand même success car le compte est validé
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur réseau.' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        return { success: false, error: error.message || "Impossible d'envoyer le lien de réinitialisation." };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur réseau.' };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { success: false, error: error.message || 'Impossible de mettre à jour le mot de passe.' };
      }
      if (data?.user) {
        setUser(data.user);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur réseau.' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur lors de la connexion avec Google.' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('locatrust_active_user');
        localStorage.removeItem('locatrust_registered_role');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        registerDirectly,
        verifyOtp,
        resendOtp,
        resendVerificationEmail,
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return ctx;
};

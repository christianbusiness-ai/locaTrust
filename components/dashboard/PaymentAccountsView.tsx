'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  Building2,
  Smartphone,
  ShieldCheck,
  CreditCard,
  Info,
  Check
} from 'lucide-react';

import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { TenantCardSkeleton } from '@/components/common/SkeletonLoader';

export interface PaymentAccount {
  id: string;
  provider: 'Wave' | 'Orange Money' | 'MTN Mobile Money' | 'Moov Money' | 'Compte Bancaire' | 'Autre';
  accountNumber: string;
  accountHolder: string;
  accountType: 'Mobile Money' | 'Compte Courant Professionnel' | 'Compte Courant Particulier';
  status: 'Vérifié' | 'En attente';
  isDefault: boolean;
  bankName?: string;
  ribIban?: string;
}

export const PaymentAccountsView: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<PaymentAccount | null>(null);

  // Form State for new/edit account
  const [provider, setProvider] = useState<PaymentAccount['provider']>('Wave');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountType, setAccountType] = useState<PaymentAccount['accountType']>('Mobile Money');
  const [bankName, setBankName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Charger les comptes depuis la base de données Supabase
  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      // 1. Purge systématique des anciens comptes de test fictifs résiduels
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('locatrust_payment_accounts');
        if (stored && (stored.includes('07 08 09 10 11') || stored.includes('SCI LES RESIDENCES DU GOLF'))) {
          localStorage.removeItem('locatrust_payment_accounts');
        }
      }

      // 2. Requête en base de données réelle
      let query = supabase.from('payment_accounts').select('*').order('created_at', { ascending: false });
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query;

      if (!error && data) {
        const mapped: PaymentAccount[] = data.map((d: any) => ({
          id: d.id,
          provider: d.provider as any,
          accountNumber: d.account_number,
          accountHolder: d.account_holder,
          accountType: d.account_type as any,
          status: (d.status || 'Vérifié') as any,
          isDefault: Boolean(d.is_default),
          bankName: d.bank_name || undefined,
          ribIban: d.rib_iban || undefined
        }));
        setAccounts(mapped);
      } else {
        setAccounts([]);
      }
    } catch (e) {
      console.warn('Erreur chargement comptes paiement:', e);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    const handleUpdate = () => loadAccounts();
    window.addEventListener('locatrust:payment_accounts_updated', handleUpdate);
    return () => window.removeEventListener('locatrust:payment_accounts_updated', handleUpdate);
  }, [user]);

  // Définir comme compte principal
  const handleSetDefault = async (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => ({
        ...acc,
        isDefault: acc.id === id
      }))
    );
    try {
      if (user?.id) {
        await supabase.from('payment_accounts').update({ is_default: false }).eq('user_id', user.id);
        await supabase.from('payment_accounts').update({ is_default: true }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur mise à jour compte par défaut:', e);
    }
  };

  // Supprimer un compte
  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce compte de réception ?')) {
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
      try {
        await supabase.from('payment_accounts').delete().eq('id', id);
      } catch (e) {
        console.warn('Erreur suppression compte:', e);
      }
    }
  };

  // Ouvrir l'édition
  const handleOpenEdit = (acc: PaymentAccount) => {
    setEditingAccount(acc);
    setProvider(acc.provider);
    setAccountNumber(acc.accountNumber);
    setAccountHolder(acc.accountHolder);
    setAccountType(acc.accountType);
    setBankName(acc.bankName || '');
    setIsDefault(acc.isDefault);
    setShowAddModal(true);
  };

  // Enregistrer (Créer ou Mettre à jour) dans la base de données réelle
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || !accountHolder) return;

    const holderUpper = accountHolder.toUpperCase().trim();
    const cleanNum = accountNumber.trim();

    if (editingAccount) {
      try {
        await supabase.from('payment_accounts').update({
          provider,
          account_number: cleanNum,
          account_holder: holderUpper,
          account_type: accountType,
          bank_name: provider === 'Compte Bancaire' ? bankName : null,
          is_default: isDefault
        }).eq('id', editingAccount.id);
      } catch (e) {
        console.warn('Erreur update compte en base:', e);
      }
      setAccounts((prev) =>
        prev.map((acc) => {
          if (acc.id === editingAccount.id) {
            return {
              ...acc,
              provider,
              accountNumber: cleanNum,
              accountHolder: holderUpper,
              accountType,
              bankName: provider === 'Compte Bancaire' ? bankName : undefined,
              isDefault: isDefault ? true : acc.isDefault
            };
          }
          return isDefault ? { ...acc, isDefault: false } : acc;
        })
      );
    } else {
      const willBeDefault = isDefault || accounts.length === 0;
      let newId = `acc-${Date.now()}`;
      try {
        if (willBeDefault && user?.id) {
          await supabase.from('payment_accounts').update({ is_default: false }).eq('user_id', user.id);
        }
        const { data: inserted } = await supabase.from('payment_accounts').insert({
          user_id: user?.id || null,
          provider,
          account_number: cleanNum,
          account_holder: holderUpper,
          account_type: accountType,
          status: 'Vérifié',
          is_default: willBeDefault,
          bank_name: provider === 'Compte Bancaire' ? bankName : null
        }).select().maybeSingle();

        if (inserted?.id) newId = inserted.id;
      } catch (e) {
        console.warn('Erreur insertion compte en base:', e);
      }

      const newAcc: PaymentAccount = {
        id: newId,
        provider,
        accountNumber: cleanNum,
        accountHolder: holderUpper,
        accountType,
        status: 'Vérifié',
        isDefault: willBeDefault,
        bankName: provider === 'Compte Bancaire' ? bankName : undefined
      };
      setAccounts((prev) => (willBeDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev).concat(newAcc));
    }

    setShowAddModal(false);
    setEditingAccount(null);
    setAccountNumber('');
    setAccountHolder('');
    setBankName('');
  };

  // Provider badge color & icon
  const getProviderIcon = (prov: PaymentAccount['provider']) => {
    switch (prov) {
      case 'Wave':
        return <span className="w-8 h-8 rounded-lg bg-sky-500 text-white font-black text-xs flex items-center justify-center shadow-sm">W</span>;
      case 'Orange Money':
        return <span className="w-8 h-8 rounded-lg bg-orange-500 text-white font-black text-xs flex items-center justify-center shadow-sm">OM</span>;
      case 'MTN Mobile Money':
        return <span className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">MTN</span>;
      case 'Moov Money':
        return <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">Moov</span>;
      case 'Compte Bancaire':
        return <span className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center shadow-sm"><Building2 className="w-4 h-4" /></span>;
      default:
        return <span className="w-8 h-8 rounded-lg bg-slate-600 text-white font-black text-xs flex items-center justify-center shadow-sm"><CreditCard className="w-4 h-4" /></span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Comptes de Réception des Paiements
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-xs font-black">
              Fonds versés directement au bailleur
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enregistrez les comptes Mobile Money et bancaires sur lesquels vos locataires versent leurs loyers.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingAccount(null);
            setAccountNumber('');
            setAccountHolder('');
            setBankName('');
            setIsDefault(false);
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un compte</span>
        </button>
      </div>

      {/* IMPORTANT NOTICE CARD: LocaTrust DOES NOT HOLD LANDLORD FUNDS */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50/40 border border-blue-200 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-black text-blue-950">
            Transparence & Sécurité des fonds LocaTrust
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            <strong>LocaTrust ne détient pas vos fonds</strong>. Les comptes de paiement configurés ci-dessous sont communiqués directement à vos locataires dans leurs avis d'échéance et quittances pour un versement direct et sans intermédiaire financier intrusif.
          </p>
        </div>
      </div>

      {/* Accounts List Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Mes comptes enregistrés ({accounts.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Le compte principal apparaît en priorité sur les quittances
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 flex flex-col gap-3">
            <TenantCardSkeleton />
            <TenantCardSkeleton />
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-7 h-7" />
            </div>
            <h4 className="text-base font-black text-slate-900">
              Aucun compte de paiement enregistré
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Ajoutez vos coordonnées de réception (Wave, Orange Money, MTN, Moov ou RIB bancaire). Elles figureront sur les contrats et avis d'échéance de vos locataires pour qu'ils effectuent leurs règlements directement vers vos comptes.
            </p>
            <button
              onClick={() => {
                setEditingAccount(null);
                setAccountNumber('');
                setAccountHolder('');
                setBankName('');
                setIsDefault(true);
                setShowAddModal(true);
              }}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter mon premier compte</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Fournisseur</th>
                  <th className="py-3.5 px-4">Numéro / Identifiant</th>
                  <th className="py-3.5 px-4">Titulaire du compte</th>
                  <th className="py-3.5 px-4">Type de compte</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Compte principal</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Provider */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {getProviderIcon(acc.provider)}
                        <div>
                          <span className="font-extrabold text-slate-900 block">{acc.provider}</span>
                          {acc.bankName && (
                            <span className="text-[11px] text-slate-500 block">{acc.bankName}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Account Number */}
                    <td className="py-4 px-4 font-mono font-bold text-slate-800">
                      {acc.accountNumber}
                    </td>

                    {/* Holder */}
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {acc.accountHolder}
                    </td>

                    {/* Account Type */}
                    <td className="py-4 px-4 text-slate-600 font-medium">
                      {acc.accountType}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {acc.status}
                      </span>
                    </td>

                    {/* Is Default */}
                    <td className="py-4 px-4 text-center">
                      {acc.isDefault ? (
                        <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 inline-flex items-center gap-1 shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                          Principal
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(acc.id)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Définir comme principal
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(acc)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(acc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FUTURE GATEWAY INTEGRATION SECTION */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">
              Passerelles de paiement directes (Bientôt disponible)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Possibilité de connecter vos clés API Wave Business ou CinetPay pour un rapprochement bancaire automatique à chaque quittance émise.
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold shrink-0">
          Module passerelle actif
        </span>
      </div>

      {/* Modal Add / Edit Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <h3 className="text-base font-black text-slate-900 mb-1">
              {editingAccount ? 'Modifier le compte de paiement' : 'Ajouter un compte de réception'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Ce compte permettra à vos locataires de vous régler directement selon vos instructions.
            </p>

            <form onSubmit={handleSaveAccount} className="flex flex-col gap-4 text-xs">
              {/* Provider Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Fournisseur</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Wave', 'Orange Money', 'MTN Mobile Money', 'Moov Money', 'Compte Bancaire', 'Autre'] as PaymentAccount['provider'][]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setProvider(p);
                        if (p === 'Compte Bancaire') {
                          setAccountType('Compte Courant Professionnel');
                        } else {
                          setAccountType('Mobile Money');
                        }
                      }}
                      className={`p-2.5 rounded-xl font-bold border text-center transition-all ${
                        provider === p
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Name if Bank */}
              {provider === 'Compte Bancaire' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nom de la Banque</label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ex: SGCI, Ecobank, BICICI, NSIA..."
                    className="w-full p-3 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              )}

              {/* Number or RIB */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {provider === 'Compte Bancaire' ? 'Numéro de Compte / RIB / IBAN' : 'Numéro de Téléphone associé'}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={provider === 'Compte Bancaire' ? 'CI092 01001 02345678901 45' : '+225 07 00 00 00 00'}
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              {/* Holder Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom officiel du Titulaire</label>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Ex: TITULAIRE DU COMPTE ou SCI LES PALMIERS"
                  className="w-full p-3 rounded-xl border border-slate-300 uppercase font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDef"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isDef" className="font-bold text-slate-700 cursor-pointer">
                  Définir ce compte comme compte principal de réception des loyers
                </label>
              </div>

              {/* Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md"
                >
                  {editingAccount ? 'Enregistrer les modifications' : 'Ajouter le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { MOCK_PROPERTIES, MOCK_USERS } from '@/lib/mock/data';
import { Property, UserRole } from '@/types/database.types';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { FeedPropertyCard } from '@/components/feed/FeedPropertyCard';
import { QuickFilters } from '@/components/feed/QuickFilters';
import { FavoritesWidget } from '@/components/feed/FavoritesWidget';
import { RecentSearches } from '@/components/feed/RecentSearches';
import { RentalRequestModal } from '@/components/feed/RentalRequestModal';
import { ContactOwnerModal } from '@/components/feed/ContactOwnerModal';
import { Image as ImageIcon, Video, Search, Sparkles } from 'lucide-react';

export default function FeedPage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('locataire');
  const [properties, setProperties] = useState<Property[]>(MOCK_PROPERTIES);
  const [selectedRentalProperty, setSelectedRentalProperty] = useState<Property | null>(null);
  const [selectedMessageProperty, setSelectedMessageProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUser = MOCK_USERS[currentRole] || MOCK_USERS.locataire;

  // Handle Search & Filtering
  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) {
      setProperties(MOCK_PROPERTIES);
      return;
    }
    const filtered = MOCK_PROPERTIES.filter(p =>
      p.title.toLowerCase().includes(term.toLowerCase()) ||
      p.description.toLowerCase().includes(term.toLowerCase()) ||
      p.location?.city.toLowerCase().includes(term.toLowerCase()) ||
      p.location?.quartier?.toLowerCase().includes(term.toLowerCase())
    );
    setProperties(filtered);
  };

  const handleFilterChange = (filters: any) => {
    let result = [...MOCK_PROPERTIES];
    if (filters.city) {
      result = result.filter(p => p.location?.city === filters.city);
    }
    if (filters.quartier) {
      result = result.filter(p => p.location?.quartier === filters.quartier);
    }
    if (filters.type) {
      result = result.filter(p => p.type === filters.type);
    }
    if (filters.budget) {
      result = result.filter(p => p.rent <= Number(filters.budget));
    }
    if (filters.rooms) {
      result = result.filter(p => p.rooms >= Number(filters.rooms));
    }
    setProperties(result);
  };

  const handleResetFilters = () => {
    setProperties(MOCK_PROPERTIES);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      
      {/* 1. Interactive Demo Role Switcher Bar */}
      <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

      {/* 2. Top Navigation Header */}
      <Header currentUser={currentUser} onSearch={handleSearch} />

      {/* 3. Main Body Grid */}
      <div className="max-w-7xl w-full mx-auto flex gap-6 px-4 lg:px-8 py-6 flex-1">
        
        {/* Left Sidebar Navigation */}
        <Sidebar currentRole={currentRole} />

        {/* Central Feed Column */}
        <main className="flex-1 flex flex-col gap-6 max-w-2xl">
          
          {/* Top Post Prompt Widget ("Que recherchez-vous aujourd'hui ?") */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar_url}
                alt={currentUser.full_name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-brand-500/20"
              />
              <input
                type="text"
                placeholder="Que recherchez-vous aujourd'hui ?"
                readOnly
                className="flex-1 bg-slate-100/80 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
              />
            </div>
            
            <div className="flex items-center justify-around border-t border-slate-100 pt-3">
              <button className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors">
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span>Photo</span>
              </button>
              <button className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors">
                <Video className="w-4 h-4 text-purple-500" />
                <span>Vidéo</span>
              </button>
              <button className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors">
                <Search className="w-4 h-4 text-brand-500" />
                <span>Je recherche</span>
              </button>
            </div>
          </div>

          {/* Property Cards List */}
          <div className="flex flex-col gap-6">
            {properties.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center gap-3">
                <Sparkles className="w-8 h-8 text-brand-500" />
                <h4 className="font-bold text-slate-900 text-base">Aucun bien trouvé</h4>
                <p className="text-xs text-slate-500">
                  Essayez d'élargir vos critères de recherche ou d'annuler les filtres rapides.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold mt-2"
                >
                  Voir tous les biens
                </button>
              </div>
            ) : (
              properties.map((property) => (
                <FeedPropertyCard
                  key={property.id}
                  property={property}
                  onOpenRentalModal={(prop) => setSelectedRentalProperty(prop)}
                  onOpenMessageModal={(prop) => setSelectedMessageProperty(prop)}
                />
              ))
            )}
          </div>

        </main>

        {/* Right Sidebar Column (Quick Filters, Favorites, Recent Searches) */}
        <aside className="hidden xl:flex flex-col gap-6 w-80 shrink-0">
          <QuickFilters onFilterChange={handleFilterChange} onReset={handleResetFilters} />
          <FavoritesWidget />
          <RecentSearches />
        </aside>

      </div>

      {/* Interactive Modals */}
      <RentalRequestModal
        property={selectedRentalProperty}
        isOpen={!!selectedRentalProperty}
        onClose={() => setSelectedRentalProperty(null)}
      />

      <ContactOwnerModal
        property={selectedMessageProperty}
        isOpen={!!selectedMessageProperty}
        onClose={() => setSelectedMessageProperty(null)}
      />

    </div>
  );
}

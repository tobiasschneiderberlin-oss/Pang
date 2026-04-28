"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Check, ChevronRight, RefreshCw, Link2, Sparkles, AlertCircle, Database, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportSource = 'artlogic' | 'artsy' | 'csv' | null;
type ImportStep = 'select' | 'connect' | 'preview' | 'complete';

interface ImportedArtwork {
  id: string;
  title: string;
  artist: string;
  year: number;
  imageUrl?: string;
  selected: boolean;
}

// Mock data for gallery sync preview
const mockImportedArtworks: ImportedArtwork[] = [
  { id: '1', title: 'Composition in Blue', artist: 'Hans Hofmann', year: 1960, imageUrl: 'https://images.unsplash.com/photo-1549887534-1541e9326642?w=400', selected: true },
  { id: '2', title: 'Untitled (Red)', artist: 'Mark Rothko', year: 1955, imageUrl: 'https://images.unsplash.com/photo-1574182245530-967d9b3831af?w=400', selected: true },
  { id: '3', title: 'Abstract Study No. 4', artist: 'Helen Frankenthaler', year: 1972, imageUrl: 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec?w=400', selected: true },
  { id: '4', title: 'Color Field', artist: 'Kenneth Noland', year: 1965, imageUrl: 'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=400', selected: false },
  { id: '5', title: 'Movement in Space', artist: 'Bridget Riley', year: 1967, imageUrl: 'https://images.unsplash.com/photo-1549887534-1541e9326642?w=400', selected: true },
];

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('select');
  const [source, setSource] = useState<ImportSource>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [artworks, setArtworks] = useState<ImportedArtwork[]>(mockImportedArtworks);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate API connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnecting(false);
    setStep('preview');
  };

  const toggleArtwork = (id: string) => {
    setArtworks(prev => 
      prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a)
    );
  };

  const selectedCount = artworks.filter(a => a.selected).length;

  const handleImport = async () => {
    // Simulate import
    await new Promise(resolve => setTimeout(resolve, 1500));
    setStep('complete');
  };

  return (
    <main className="min-h-dvh bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border safe-area-inset-top">
        <div className="flex items-center gap-4 p-4 pt-12">
          <button onClick={() => router.back()} className="p-2 -m-2">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-medium">import collection</h1>
            <p className="text-xs text-muted-foreground">
              {step === 'select' && 'choose your source'}
              {step === 'connect' && 'connect account'}
              {step === 'preview' && 'review artworks'}
              {step === 'complete' && 'import complete'}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-4 pb-3">
          {(['select', 'connect', 'preview', 'complete'] as ImportStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= ['select', 'connect', 'preview', 'complete'].indexOf(step)
                  ? "bg-accent"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </header>

      {/* Step: Select Source */}
      {step === 'select' && (
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground mb-6">
            Connect your gallery account or upload a spreadsheet to import your collection instantly.
          </p>

          {/* Art Logic */}
          <button
            onClick={() => { setSource('artlogic'); setStep('connect'); }}
            className={cn(
              "w-full bg-card border rounded-2xl p-6 flex items-center gap-4 text-left transition-colors",
              source === 'artlogic' ? "border-accent" : "border-border"
            )}
          >
            <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Database size={24} className="text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Art Logic</h3>
              <p className="text-sm text-muted-foreground">sync from gallery database</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>

          {/* Artsy */}
          <button
            onClick={() => { setSource('artsy'); setStep('connect'); }}
            className={cn(
              "w-full bg-card border rounded-2xl p-6 flex items-center gap-4 text-left transition-colors",
              source === 'artsy' ? "border-accent" : "border-border"
            )}
          >
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-muted-foreground">A</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Artsy</h3>
              <p className="text-sm text-muted-foreground">import from your Artsy profile</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>

          {/* CSV Upload */}
          <button
            onClick={() => { setSource('csv'); setStep('connect'); }}
            className={cn(
              "w-full bg-card border rounded-2xl p-6 flex items-center gap-4 text-left transition-colors",
              source === 'csv' ? "border-accent" : "border-border"
            )}
          >
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={24} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Spreadsheet</h3>
              <p className="text-sm text-muted-foreground">upload CSV or Excel file</p>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>

          {/* More integrations coming */}
          <div className="mt-8 p-4 bg-muted rounded-xl text-center">
            <p className="text-sm text-muted-foreground">
              More integrations coming soon: Collectrium, Artwork Archive, and more.
            </p>
          </div>
        </div>
      )}

      {/* Step: Connect */}
      {step === 'connect' && source && (
        <div className="p-4">
          {source === 'csv' ? (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet size={32} className="text-muted-foreground" />
                </div>
                <h2 className="text-xl font-medium mb-2">Upload spreadsheet</h2>
                <p className="text-sm text-muted-foreground">
                  We support CSV and Excel files with artwork details
                </p>
              </div>

              <label className="block">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={() => handleConnect()}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-accent transition-colors">
                  <p className="text-sm text-muted-foreground mb-2">Drag file here or tap to browse</p>
                  <span className="px-4 py-2 bg-accent text-accent-foreground rounded-full text-sm font-medium">
                    select file
                  </span>
                </div>
              </label>

              <div className="bg-muted rounded-xl p-4">
                <h4 className="text-sm font-medium mb-2">Expected columns:</h4>
                <p className="text-xs text-muted-foreground">
                  Title, Artist, Year, Medium, Dimensions, Image URL (optional)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Link2 size={32} className="text-accent" />
                </div>
                <h2 className="text-xl font-medium mb-2">
                  Connect to {source === 'artlogic' ? 'Art Logic' : 'Artsy'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to import your collection data
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@gallery.com"
                    className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    API Key / Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    className="w-full mt-2 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    connecting...
                  </>
                ) : (
                  'connect & import'
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                We only read your collection data. We never modify your gallery account.
              </p>
            </div>
          )}

          <button
            onClick={() => setStep('select')}
            className="w-full mt-4 py-3 text-muted-foreground text-sm"
          >
            back
          </button>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="pb-24">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-accent" />
              <span className="text-sm font-medium">
                Found {artworks.length} artworks
              </span>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Select which artworks to import into your collection.
            </p>

            {/* Select all */}
            <button
              onClick={() => setArtworks(prev => prev.map(a => ({ ...a, selected: true })))}
              className="text-sm text-accent font-medium mb-4"
            >
              select all
            </button>
          </div>

          {/* Artwork list */}
          <div className="space-y-2 px-4">
            {artworks.map((artwork) => (
              <button
                key={artwork.id}
                onClick={() => toggleArtwork(artwork.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-colors",
                  artwork.selected ? "bg-accent/10 border border-accent" : "bg-card border border-border"
                )}
              >
                {artwork.imageUrl ? (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <Image
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{artwork.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {artwork.artist}, {artwork.year}
                  </p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  artwork.selected ? "bg-accent border-accent" : "border-muted-foreground"
                )}>
                  {artwork.selected && <Check size={14} className="text-accent-foreground" />}
                </div>
              </button>
            ))}
          </div>

          {/* Bottom action */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-area-inset-bottom">
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm disabled:opacity-50"
            >
              import {selectedCount} artwork{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <div className="p-4 text-center py-16">
          <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={36} className="text-accent-foreground" />
          </div>
          <h2 className="text-2xl font-medium mb-2">Import complete!</h2>
          <p className="text-muted-foreground mb-8">
            {selectedCount} artworks have been added to your collection.
          </p>

          <button
            onClick={() => router.push('/collection')}
            className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm mb-4"
          >
            view collection
          </button>
          
          <button
            onClick={() => { setStep('select'); setSource(null); }}
            className="w-full py-3 text-muted-foreground text-sm"
          >
            import more
          </button>
        </div>
      )}
    </main>
  );
}

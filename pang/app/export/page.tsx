"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, FileText, Download, Mail, Share2, Check, Shield, FileSpreadsheet, Printer, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { artworks } from "@/lib/api";

type ExportType = 'insurance' | 'customs' | 'appraisal' | 'inventory' | 'pdf' | 'csv';

interface ExportOption {
  id: ExportType;
  title: string;
  description: string;
  icon: typeof FileText;
  fields: string[];
}

const exportOptions: ExportOption[] = [
  {
    id: 'insurance',
    title: 'Insurance Report',
    description: 'Comprehensive report for insurers',
    icon: Shield,
    fields: ['Title', 'Artist', 'Year', 'Medium', 'Dimensions', 'Estimated Value', 'Provenance', 'Condition', 'Photos'],
  },
  {
    id: 'customs',
    title: 'Customs Declaration',
    description: 'For international transport',
    icon: FileText,
    fields: ['Title', 'Artist', 'Year', 'Medium', 'Dimensions', 'Country of Origin', 'Declared Value'],
  },
  {
    id: 'appraisal',
    title: 'Appraisal Request',
    description: 'Share details with appraisers',
    icon: FileText,
    fields: ['Title', 'Artist', 'Year', 'Medium', 'Dimensions', 'Provenance', 'High-res Photos'],
  },
  {
    id: 'inventory',
    title: 'Collection Inventory',
    description: 'Full collection spreadsheet',
    icon: FileSpreadsheet,
    fields: ['All artwork details', 'Documents', 'Photos', 'Notes'],
  },
];

export default function ExportPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ExportType | null>(null);
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [step, setStep] = useState<'type' | 'select' | 'preview'>('type');

  const handleSelectType = (type: ExportType) => {
    setSelectedType(type);
    setStep('select');
  };

  const toggleArtwork = (id: string) => {
    setSelectedArtworks(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedArtworks(artworks.map(a => a.id));
  };

  const handleGenerate = async () => {
    setStep('preview');
    setIsGenerating(true);
    // Simulate generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    setExportReady(true);
  };

  const selectedOption = exportOptions.find(o => o.id === selectedType);

  return (
    <main className="min-h-dvh bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border safe-area-inset-top">
        <div className="flex items-center gap-4 p-4 pt-12">
          <button 
            onClick={() => {
              if (step === 'type') router.back();
              else if (step === 'select') setStep('type');
              else setStep('select');
            }} 
            className="p-2 -m-2"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-medium">export documents</h1>
            <p className="text-xs text-muted-foreground">
              {step === 'type' && 'choose export type'}
              {step === 'select' && 'select artworks'}
              {step === 'preview' && 'your export'}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-4 pb-3">
          {(['type', 'select', 'preview'] as const).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= ['type', 'select', 'preview'].indexOf(step)
                  ? "bg-accent"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </header>

      {/* Step 1: Select export type */}
      {step === 'type' && (
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground mb-6">
            Generate professional documents for your collection with one tap.
          </p>

          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelectType(option.id)}
              className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                <option.icon size={22} className="text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{option.title}</h3>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </button>
          ))}

          {/* Quick actions */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Quick Export
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-muted rounded-xl p-4 text-center">
                <FileText size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">PDF</p>
                <p className="text-xs text-muted-foreground">Full collection</p>
              </button>
              <button className="bg-muted rounded-xl p-4 text-center">
                <FileSpreadsheet size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">CSV</p>
                <p className="text-xs text-muted-foreground">Spreadsheet</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Select artworks */}
      {step === 'select' && selectedOption && (
        <div className="pb-24">
          <div className="p-4">
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium">{selectedOption.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Includes: {selectedOption.fields.join(', ')}
              </p>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                {selectedArtworks.length} of {artworks.length} selected
              </span>
              <button 
                onClick={selectAll}
                className="text-sm text-accent font-medium"
              >
                select all
              </button>
            </div>
          </div>

          <div className="space-y-2 px-4">
            {artworks.map((artwork) => (
              <button
                key={artwork.id}
                onClick={() => toggleArtwork(artwork.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors",
                  selectedArtworks.includes(artwork.id)
                    ? "bg-accent/10 border border-accent"
                    : "bg-card border border-border"
                )}
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <Image
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{artwork.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {artwork.artistName}, {artwork.year}
                  </p>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  selectedArtworks.includes(artwork.id)
                    ? "bg-accent border-accent"
                    : "border-muted-foreground"
                )}>
                  {selectedArtworks.includes(artwork.id) && (
                    <Check size={14} className="text-accent-foreground" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Bottom action */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-area-inset-bottom">
            <button
              onClick={handleGenerate}
              disabled={selectedArtworks.length === 0}
              className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm disabled:opacity-50"
            >
              generate {selectedOption.title.toLowerCase()}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & download */}
      {step === 'preview' && (
        <div className="p-4">
          {isGenerating ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <FileText size={32} className="text-accent" />
              </div>
              <h2 className="text-lg font-medium mb-2">Generating document...</h2>
              <p className="text-sm text-muted-foreground">
                Compiling {selectedArtworks.length} artworks
              </p>
            </div>
          ) : (
            <>
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={36} className="text-accent-foreground" />
                </div>
                <h2 className="text-xl font-medium mb-2">Document ready!</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedOption?.title} with {selectedArtworks.length} artwork{selectedArtworks.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Document preview */}
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText size={24} className="text-accent" />
                  <div>
                    <p className="font-medium">PANG_{selectedType}_report.pdf</p>
                    <p className="text-xs text-muted-foreground">Generated just now · 2.4 MB</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Contains:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{selectedArtworks.length} artworks with full details</li>
                    <li>High-resolution images</li>
                    <li>Provenance information</li>
                    <li>Document references</li>
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm flex items-center justify-center gap-2">
                  <Download size={18} />
                  download PDF
                </button>
                
                <div className="grid grid-cols-3 gap-3">
                  <button className="py-3 bg-muted rounded-xl flex flex-col items-center gap-1">
                    <Mail size={18} />
                    <span className="text-xs">email</span>
                  </button>
                  <button className="py-3 bg-muted rounded-xl flex flex-col items-center gap-1">
                    <Printer size={18} />
                    <span className="text-xs">print</span>
                  </button>
                  <button className="py-3 bg-muted rounded-xl flex flex-col items-center gap-1">
                    <Share2 size={18} />
                    <span className="text-xs">share</span>
                  </button>
                </div>
              </div>

              {/* Generate another */}
              <button
                onClick={() => {
                  setStep('type');
                  setSelectedType(null);
                  setSelectedArtworks([]);
                  setExportReady(false);
                }}
                className="w-full mt-6 py-3 text-muted-foreground text-sm"
              >
                generate another report
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

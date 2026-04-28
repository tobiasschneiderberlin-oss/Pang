"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, FileText, Search, Filter, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { artworks } from "@/lib/data";
import { DocumentScanner } from "@/components/document-scanner";

type FilterType = 'all' | 'certificate' | 'invoice' | 'condition-report' | 'appraisal' | 'insurance';

// Flatten all documents from artworks
const allDocuments = artworks.flatMap(artwork => 
  (artwork.documents || []).map(doc => ({
    ...doc,
    artworkId: artwork.id,
    artworkTitle: artwork.title,
    artistName: artwork.artistName,
  }))
);

export default function DocumentsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const filteredDocs = allDocuments.filter(doc => {
    const matchesFilter = filter === 'all' || doc.type === filter;
    const matchesSearch = searchQuery === '' || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.artworkTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.artistName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'certificate', label: 'Certificates' },
    { value: 'invoice', label: 'Invoices' },
    { value: 'condition-report', label: 'Reports' },
    { value: 'appraisal', label: 'Appraisals' },
    { value: 'insurance', label: 'Insurance' },
  ];

  return (
    <main className="min-h-dvh bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border safe-area-inset-top">
        <div className="flex items-center gap-4 p-4 pt-12">
          <button onClick={() => router.back()} className="p-2 -m-2">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-medium">documents</h1>
            <p className="text-xs text-muted-foreground">
              {allDocuments.length} documents in collection
            </p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-10 h-10 bg-accent text-accent-foreground rounded-full flex items-center justify-center"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-2.5">
            <Search size={18} className="text-muted-foreground" />
            <input
              type="text"
              placeholder="search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                filter === option.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {/* Document list */}
      <div className="p-4 space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No documents found</p>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="mt-4 px-6 py-2 bg-accent text-accent-foreground rounded-full text-sm font-medium"
            >
              add documents
            </button>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <Link
              key={doc.id}
              href={`/artwork/${doc.artworkId}`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
            >
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.artworkTitle} · {doc.artistName}
                </p>
                {doc.date && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.date}</p>
                )}
              </div>
              <button 
                onClick={(e) => { e.preventDefault(); }}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <Download size={18} />
              </button>
            </Link>
          ))
        )}
      </div>

      {/* AI suggestion banner */}
      <div className="mx-4 mt-4 p-4 bg-accent/10 border border-accent/20 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium">AI Document Management</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Drop any document and our AI will automatically detect its type and link it to the right artwork in your collection.
        </p>
      </div>

      {/* Document Scanner */}
      <DocumentScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onComplete={(docs) => {
          console.log('Documents saved:', docs);
          // In production, this would save to database
        }}
      />
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, Mail } from "lucide-react";

const FAQS = [
  {
    id: "add",
    question: "How do I add a new artwork?",
    answer: "Tap the menu and select 'Add Artwork'. You can scan the artwork with your camera or upload an image from your photo library. PANG will automatically detect details and pre-fill the form.",
  },
  {
    id: "share",
    question: "How do I share my collection?",
    answer: "Open an artwork and tap the share icon. You can share a link to a single piece or your entire public collection. Control what's visible to others in your Profile settings.",
  },
  {
    id: "gallery",
    question: "How does the gallery sync work?",
    answer: "Your gallery manages the master collection. When they add, update, or remove a piece, your app reflects those changes automatically. You'll receive a notification when something changes.",
  },
  {
    id: "documents",
    question: "What documents can I store?",
    answer: "You can attach invoices, certificates of authenticity, condition reports, provenance documents, and any other files relevant to a piece. Supported formats are PDF, JPG, and PNG.",
  },
  {
    id: "export",
    question: "Can I export my collection?",
    answer: "Yes. Go to the menu and tap 'Export'. You can download a PDF or CSV containing your full collection with all details and valuations — useful for insurance or estate planning.",
  },
  {
    id: "private",
    question: "Who can see my collection?",
    answer: "Only you by default. You control visibility per artwork — toggle artworks public to let others view them via a shared link. Your contact details are also individually toggled in your profile.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(prev => prev === id ? null : id);
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="px-4 pt-12 pb-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold">Help Center</h1>
        </div>
      </header>

      <div className="px-4 pb-8 space-y-6">
        {/* FAQs */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">Frequently Asked Questions</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {FAQS.map(faq => (
              <div key={faq.id}>
                <button
                  onClick={() => toggle(faq.id)}
                  className="w-full flex items-center justify-between px-4 py-4 text-left gap-3"
                >
                  <span className="text-sm font-medium flex-1">{faq.question}</span>
                  {openId === faq.id
                    ? <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" />
                    : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                  }
                </button>
                {openId === faq.id && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">Contact</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <a
              href="mailto:hello@pang.app"
              className="flex items-center gap-3 px-4 py-4"
            >
              <Mail size={18} className="text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Support</p>
                <p className="text-xs text-muted-foreground">hello@pang.app</p>
              </div>
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">PANG v1.0.0</p>
      </div>
    </main>
  );
}

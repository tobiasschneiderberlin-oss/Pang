'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate magic link sent
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 800);
  };

  return (
    <main className="min-h-dvh flex flex-col justify-center items-center p-6 bg-background">
      {/* Back button */}
      {!isSubmitted && (
        <button
          onClick={() => router.back()}
          className="absolute top-6 left-6 p-2 hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={24} className="text-foreground" />
        </button>
      )}

      <div className="w-full max-w-sm">
        {!isSubmitted ? (
          <>
            {/* Logo */}
            <div className="mb-12 text-center">
              <h1 className="text-3xl font-light tracking-tight text-foreground">PANG</h1>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Enter your email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-accent text-accent-foreground rounded-lg py-3 font-medium transition-all disabled:opacity-50 hover:opacity-90"
              >
                {isLoading ? 'Sending...' : 'Send Magic Link'}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Magic link expires in 24 hours
              </p>
            </form>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-light tracking-tight text-foreground mb-2">
                  Check your email
                </h2>
                <p className="text-muted-foreground">
                  We&apos;ve sent a login link to{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Tap the link in your email to access your collection.</p>
                <p className="text-xs">If you don&apos;t see it, check your spam folder.</p>
              </div>

              <button
                onClick={() => {
                  setEmail('');
                  setIsSubmitted(false);
                }}
                className="w-full bg-card border border-border rounded-lg py-3 text-foreground font-medium transition-all hover:opacity-70"
              >
                Try another email
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

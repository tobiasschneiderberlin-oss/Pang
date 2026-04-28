'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate validating invite token and loading collection
    const timer = setTimeout(() => {
      // Store auth token (mock)
      localStorage.setItem('pang-auth-token', `token_${params.token}`);
      localStorage.setItem('pang-onboarded', 'true');

      // Redirect to collection
      router.replace('/collection');
    }, 2000);

    return () => clearTimeout(timer);
  }, [params.token, router]);

  return (
    <main
      className="min-h-dvh w-screen overflow-hidden flex items-center justify-center bg-background"
      style={{
        opacity: isLoading ? 1 : 0,
        transition: isLoading ? 'none' : 'opacity 400ms ease-in-out',
      }}
    >
      <img
        src="/pang-logo.svg"
        alt="PANG"
        width={800}
        height={800}
        className="splash-logo"
      />

      <style>{`
        .splash-logo {
          animation: splashZoom 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes splashZoom {
          0% {
            opacity: 0;
            transform: scale(0.15);
            filter: blur(4px);
          }
          25% {
            opacity: 1;
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(3.2);
            filter: blur(0px);
          }
        }
      `}</style>
    </main>
  );
}

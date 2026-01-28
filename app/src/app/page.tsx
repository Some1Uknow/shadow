'use client';

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { useImagePreload } from '@/hooks/useImagePreload';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import {
  HeroSection,
  ProblemSection,
  SolutionSection,
  UseCasesSection,
  HowItWorksSection,
  CTASection,
  Footer
} from '@/components/landing';

export default function Home() {
  const { connected } = useWallet();
  const router = useRouter();

  // Preload hero background image
  const bgLoaded = useImagePreload('/bg.png');
  const isLoaded = bgLoaded;

  useEffect(() => {
    if (connected) {
      router.push('/swap');
    }
  }, [connected, router]);

  return (
    <main className="min-h-screen bg-black">
      <FullScreenLoader isLoading={!isLoaded} />

      {isLoaded && (
        <>
          <HeroSection />
          <ProblemSection />
          <SolutionSection />
          <UseCasesSection />
          <HowItWorksSection />
          <CTASection />
          <Footer />
        </>
      )}
    </main>
  );
}



import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Compare } from '@/components/Compare';
import { Features } from '@/components/Features';
import { CtaBanner } from '@/components/CtaBanner';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <div id="top" className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Compare />
        <Features />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}

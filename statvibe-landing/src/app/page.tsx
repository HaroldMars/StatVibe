import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Features } from '@/components/Features';
import { CtaBanner } from '@/components/CtaBanner';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <div id="top" className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}

import { Header } from '../components/Header';
import { MobileBetaBanner } from '../components/MobileBetaBanner';
import { Hero } from '../components/Hero';
import { BranchMapSection } from '../components/BranchMapSection';
import { Features } from '../components/Features';
import { Pricing } from '../components/Pricing';
import { Footer } from '../components/Footer';

export default function HomePage() {
  return (
    <div id="top" className="min-h-screen">
      <MobileBetaBanner />
      <Header />
      <main>
        <Hero />
        <BranchMapSection />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

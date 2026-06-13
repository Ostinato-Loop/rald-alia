import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Features } from '@/components/Features';
import { ForBanks } from '@/components/ForBanks';
import { ForDevelopers } from '@/components/ForDevelopers';
import { Security } from '@/components/Security';
import { Pricing } from '@/components/Pricing';
import { Stats } from '@/components/Stats';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A]">
      <Navbar />
      <Hero />
      <Stats />
      <HowItWorks />
      <Features />
      <Security />
      <ForBanks />
      <ForDevelopers />
      <Pricing />
      <Footer />
    </main>
  );
}

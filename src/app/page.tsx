import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatBar from "@/components/StatBar";
import ProblemSection from "@/components/ProblemSection";
import HowItWorks from "@/components/HowItWorks";
import ComparisonTable from "@/components/ComparisonTable";
import SampleFacilityCard from "@/components/SampleFacilityCard";
import TwoPathSection from "@/components/TwoPathSection";
import WaitlistCTA from "@/components/WaitlistCTA";
import Footer from "@/components/Footer";
import { FadeUp } from "@/components/FadeUp";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatBar />
        <FadeUp>
          <ProblemSection />
        </FadeUp>
        <FadeUp>
          <HowItWorks />
        </FadeUp>
        <FadeUp>
          <ComparisonTable />
        </FadeUp>
        <FadeUp>
          <div id="sample-card">
            <SampleFacilityCard />
          </div>
        </FadeUp>
        <FadeUp>
          <TwoPathSection />
        </FadeUp>
        <FadeUp>
          <WaitlistCTA />
        </FadeUp>
      </main>
      <Footer />
    </>
  );
}

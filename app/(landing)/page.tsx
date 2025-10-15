import HeroSection from "./hero-section";
import FeaturesOne from "./features-one";
import Testimonials from "./testimonials";
import CallToAction from "./call-to-action";
import FAQs from "./faqs";
import Footer from "./footer";
import CustomClerkPricing from "@/components/custom-clerk-pricing";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturesOne />
      <section id="pricing" className="bg-muted/50 py-16 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 mx-auto max-w-2xl space-y-6 text-center">
              <h1 className="text-center text-4xl font-semibold lg:text-5xl">Pricing that scales with you</h1>
              <p>Start free. Upgrade when you’re ready to roll out org‑wide dashboards and AI automations.</p>
          </div>
          <CustomClerkPricing />
        </div>
      </section>
      <Testimonials />
      <CallToAction />
      <FAQs />
      <Footer />
    </div>
  );
}

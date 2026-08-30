import { HeroReveal } from "@/components/narrative/HeroReveal";
import { Stakes } from "@/components/narrative/Stakes";
import { ThreatBento } from "@/components/narrative/ThreatBento";
import { PipelineScroller } from "@/components/narrative/PipelineScroller";
import { DiscrepancyGate } from "@/components/narrative/DiscrepancyGate";
import { RiskCalculator } from "@/components/narrative/RiskCalculator";
import { Handoff } from "@/components/narrative/Handoff";
import { EmbeddedInstrument } from "@/components/narrative/EmbeddedInstrument";
import { EngineeringContract } from "@/components/narrative/EngineeringContract";

/* Zone A — the narrative site. The nine acts of §5, composed in order.

   Each act is a section that stands on its own, for two reasons §5 states
   directly: the page must read correctly with motion off (§7.2), and the
   cuttable acts (§10.3 names 3 and 6) must be removable without touching the
   others. Neither survives acts that reach into each other, so none do — the
   only thing shared between them is data in lib/.

   The anchors the earlier acts link to are owned by the later ones:
     #taxonomy    Act 2, from the hero's "Open methodology" (§5.9)
     #scanner     Act 7, from the skip link and Act 1's audience row
     #api-contract, #limitations   Act 8, from Act 0 and Act 1 (§5.9) */
export default function HomePage() {
  return (
    <>
      <HeroReveal />
      <Stakes />
      <ThreatBento />
      <PipelineScroller />
      <DiscrepancyGate />
      <RiskCalculator />
      <Handoff />
      <EmbeddedInstrument />
      <EngineeringContract />
    </>
  );
}

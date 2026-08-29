import { HeroReveal } from "@/components/narrative/HeroReveal";

/* Zone A — the narrative site. Acts are composed here in order; each act is a
   section that stands on its own so the page reads correctly with motion off
   (§7.2) and so cuttable acts (§10.3 names Acts 3 and 6) can be removed
   without touching the others. */
export default function HomePage() {
  return (
    <>
      <HeroReveal />
    </>
  );
}

import type { AreaPage as AreaPageContent } from "@/content/pages/areaPages";
import { AreaFAQ } from "./AreaFAQ";
import { AreaFinalCTA } from "./AreaFinalCTA";
import { AreaHero } from "./AreaHero";
import { AreaIntro } from "./AreaIntro";
import { AreaLinks } from "./AreaLinks";
import { AreaMap } from "./AreaMap";
import { AreaNearby } from "./AreaNearby";
import { AreaPackages } from "./AreaPackages";
import { AreaProcess } from "./AreaProcess";
import { AreaReviews } from "./AreaReviews";
import { AreaSafetyBand } from "./AreaSafetyBand";
import { AreaStats } from "./AreaStats";
import { AreaTherapists } from "./AreaTherapists";
import { AreaWhy } from "./AreaWhy";

export function AreaPage({ area }: { area: AreaPageContent }) {
  return (
    <>
      <AreaHero area={area} />
      <AreaStats />
      <AreaIntro area={area} />
      <AreaPackages area={area} />
      <AreaWhy area={area} />
      <AreaProcess area={area} />
      <AreaTherapists area={area} />
      <AreaReviews area={area} />
      <AreaMap area={area} />
      <AreaLinks area={area} />
      <AreaNearby area={area} />
      <AreaSafetyBand area={area} />
      <AreaFAQ area={area} />
      <AreaFinalCTA area={area} />
    </>
  );
}

/**
 * California homes that closed on a change of ownership and reopened under a
 * new CDSS license at the same street address. The old page (row kept,
 * unpublished, license CLOSED) moves permanently to the new license's page.
 *
 * Source: audit 2026-11-26 (succ_redirect_candidates_20261126.csv). Each pair
 * was checked: old row unpublished and CLOSED, new row published and LICENSED.
 * Add a pair only when both checks hold. Do not delete the old row.
 */
export type CaSuccessorRedirect = {
  source: string;
  destination: string;
  oldLicense: string;
  newLicense: string;
};

export const CA_SUCCESSOR_REDIRECTS: CaSuccessorRedirect[] = [
  { source: "/california/anaheim/angel-comfort-care-2-6228", destination: "/california/anaheim/maxcare-and-comfort-6772", oldLicense: "306006228", newLicense: "306006772" },
  { source: "/california/anaheim/brookdale-anaheim-2915", destination: "/california/anaheim/marbella-anaheim-6723", oldLicense: "306002915", newLicense: "306006723" },
  { source: "/california/carlsbad/santianna-oakmont-signature-living-604533", destination: "/california/carlsbad/santianna-oakmont-signature-living-604947", oldLicense: "374604533", newLicense: "374604947" },
  { source: "/california/el-dorado-hills/pavilion-at-el-dorado-hills-the-700445", destination: "/california/el-dorado-hills/pavilion-at-el-dorado-hills-the-920187", oldLicense: "092700445", newLicense: "095920187" },
  { source: "/california/elk-grove/love-and-serenity-of-elk-grove-iii-700828", destination: "/california/elk-grove/legacy-lane-senior-living-iii-701615", oldLicense: "342700828", newLicense: "342701615" },
  { source: "/california/escondido/ivy-park-at-escondido-604269", destination: "/california/escondido/ivy-park-at-escondido-881684", oldLicense: "374604269", newLicense: "371881684" },
  { source: "/california/foster-city/atria-at-foster-square-600980", destination: "/california/foster-city/atria-at-foster-square-601223", oldLicense: "415600980", newLicense: "415601223" },
  { source: "/california/fremont/lincoln-villa-201025", destination: "/california/fremont/lincoln-villa-201495", oldLicense: "019201025", newLicense: "019201495" },
  { source: "/california/garden-grove/ivy-terrace-at-garden-grove-6019", destination: "/california/garden-grove/ivy-terrace-at-garden-grove-6766", oldLicense: "306006019", newLicense: "306006766" },
  { source: "/california/hayward/colonial-acres-residential-care-home-200664", destination: "/california/hayward/caringhands-hayward-201689", oldLicense: "019200664", newLicense: "019201689" },
  { source: "/california/hayward/continuance-care-home-llc-200807", destination: "/california/hayward/harmony-care-house-llc-201516", oldLicense: "019200807", newLicense: "019201516" },
  { source: "/california/hemet/hacienda-senior-living-426760", destination: "/california/hemet/hacienda-senior-living-881749", oldLicense: "336426760", newLicense: "331881749" },
  { source: "/california/la-mesa/montera-the-604083", destination: "/california/la-mesa/montera-the-604855", oldLicense: "374604083", newLicense: "374604855" },
  { source: "/california/la-quinta/palms-at-la-quinta-the-880511", destination: "/california/la-quinta/palms-at-la-quinta-the-881693", oldLicense: "331880511", newLicense: "331881693" },
  { source: "/california/lancaster/bellamar-lancaster-602540", destination: "/california/lancaster/bellamar-lancaster-610775", oldLicense: "197602540", newLicense: "197610775" },
  { source: "/california/livermore/a-gabriela-s-villa-livermore-601270", destination: "/california/livermore/rhome-cares-at-lynn-201413", oldLicense: "015601270", newLicense: "019201413" },
  { source: "/california/livermore/watermark-at-rosewood-gardens-the-200708", destination: "/california/livermore/ivy-park-at-livermore-201597", oldLicense: "019200708", newLicense: "019201597" },
  { source: "/california/los-angeles/avenir-memory-care-westside-320184", destination: "/california/los-angeles/argento-westchester-320629", oldLicense: "198320184", newLicense: "198320629" },
  { source: "/california/menlo-park/silver-oaks-601052", destination: "/california/menlo-park/menlo-oaks-memory-care-601229", oldLicense: "415601052", newLicense: "415601229" },
  { source: "/california/millbrae/hearts-at-millwood-assisted-living-601085", destination: "/california/millbrae/hearts-at-millwood-care-home-601228", oldLicense: "415601085", newLicense: "415601228" },
  { source: "/california/morgan-hill/loma-clara-senior-living-202665", destination: "/california/morgan-hill/loma-clara-senior-living-202989", oldLicense: "435202665", newLicense: "435202989" },
  { source: "/california/murrieta/vineyard-place-800073", destination: "/california/murrieta/vineyard-place-881737", oldLicense: "331800073", newLicense: "331881737" },
  { source: "/california/napa/watermark-at-napa-valley-the-803919", destination: "/california/napa/watermark-at-napa-valley-the-804281", oldLicense: "286803919", newLicense: "286804281" },
  { source: "/california/newark/heavenly-care-home-201259", destination: "/california/newark/alondra-care-home-2-201434", oldLicense: "019201259", newLicense: "019201434" },
  { source: "/california/oceanside/aegis-assisted-living-at-shadowridge-602653", destination: "/california/oceanside/shadow-ridge-senior-living-605052", oldLicense: "374602653", newLicense: "374605052" },
  { source: "/california/playa-vista/ivy-park-at-playa-vista-601661", destination: "/california/playa-vista/ivy-park-at-playa-vista-320432", oldLicense: "198601661", newLicense: "198320432" },
  { source: "/california/pleasanton/abigail-s-guest-home-200515", destination: "/california/pleasanton/sunnies-guest-home-201525", oldLicense: "019200515", newLicense: "019201525" },
  { source: "/california/roseville/roseville-senior-living-2991", destination: "/california/roseville/everkind-living-920409", oldLicense: "345002991", newLicense: "315920409" },
  { source: "/california/sacramento/woodlake-the-700594", destination: "/california/sacramento/woodlake-the-701551", oldLicense: "342700594", newLicense: "342701551" },
  { source: "/california/san-diego/stellar-care-603625", destination: "/california/san-diego/vista-del-sol-assisted-living-and-memory-care-605041", oldLicense: "374603625", newLicense: "374605041" },
  { source: "/california/san-leandro/rosegate-600148", destination: "/california/san-leandro/rosemont-gardens-201382", oldLicense: "015600148", newLicense: "019201382" },
  { source: "/california/san-ramon/watermark-at-san-ramon-the-200962", destination: "/california/san-ramon/discovery-commons-san-ramon-201455", oldLicense: "079200962", newLicense: "079201455" },
  { source: "/california/santa-monica/welbrook-senior-living-santa-monica-609336", destination: "/california/santa-monica/welbrook-santa-monica-320692", oldLicense: "197609336", newLicense: "198320692" },
  { source: "/california/stanton/beach-terrace-assisted-living-and-memory-care-5901", destination: "/california/stanton/beach-terrace-assisted-living-and-memory-care-6746", oldLicense: "306005901", newLicense: "306006746" },
  { source: "/california/thousand-oaks/belmont-village-thousand-oaks-802433", destination: "/california/thousand-oaks/sunrise-of-thousand-oaks-850725", oldLicense: "565802433", newLicense: "565850725" },
  { source: "/california/torrance/silverado-rolling-hills-320131", destination: "/california/torrance/silverado-rolling-hills-320514", oldLicense: "198320131", newLicense: "198320514" },
  { source: "/california/tustin/groves-of-tustin-the-4718", destination: "/california/tustin/groves-of-tustin-the-6736", oldLicense: "306004718", newLicense: "306006736" },
];

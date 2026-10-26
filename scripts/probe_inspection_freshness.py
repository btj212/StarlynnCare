#!/usr/bin/env python3
"""
Source-only inspection freshness probe for all COVERED_STATES.

Downloads regulator exports where possible (no DATABASE_URL required) and
compares source max dates against production API baselines or optional DB
baselines when DATABASE_URL is set.

Usage:
  python3 scripts/probe_inspection_freshness.py
  python3 scripts/probe_inspection_freshness.py --state OR
  python3 scripts/probe_inspection_freshness.py --skip-download   # use cached files only

Exit 0 always — this is a read-only reconnaissance tool.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRAPERS = REPO_ROOT / "scrapers"
COVERED_STATES = ("CA", "TX", "OR", "WA", "MN", "UT", "IL", "PA", "AZ", "MO")
STATE_SLUGS = {
    "CA": "california",
    "TX": "texas",
    "OR": "oregon",
    "WA": "washington",
    "MN": "minnesota",
    "UT": "utah",
    "IL": "illinois",
    "PA": "pennsylvania",
    "AZ": "arizona",
    "MO": "missouri",
}
PRODUCTION_API = "https://www.starlynncare.com/api/facilities"

# Last known DB max dates from GitHub Actions weekly-inspection-ingest runs.
# Run 29664571407 (2026-07-18T23:04 UTC, push after cron probe 2026-07-18T23:01):
#   OR +4 inspections, max=2026-07-17 (was 2026-07-16); 0 material facility changes
#   MN +4 inspections, max=2026-07-08 unchanged; 0 material facility changes (1 of 5
#   insertDate events skipped — license not in ALRC target list)
#   CA/TX/WA/UT/IL/PA/AZ/MO pending at baseline update time (matrix still queued).
# Run 29619716241 (2026-07-17T23:05 UTC, push after cron probe 2026-07-17T23:01):
#   OR +20 inspections, max=2026-07-16 (was 2026-07-14); 1 material facility change
#   MN +13 inspections, max=2026-07-08 unchanged; 0 material facility changes (many
#   insertDate events skipped — license not in ALRC target list)
#   CA/TX/WA/UT/IL/PA/AZ/MO pending at baseline update time (matrix still queued).
# Run 29457543361 (2026-07-15T23:06 UTC, push after cron probe 2026-07-15T23:02):
#   OR +13 inspections, max=2026-07-14 (was 2026-07-12); CA/TX/WA/UT/IL/PA/AZ/MO +0
#   (MN failed post_ingest Layer 5 denorm; other matrix jobs still queued at baseline update).
# Run 29375112408 (2026-07-14T23:06 UTC, push after cron probe 2026-07-14T23:02):
#   OR +4 inspections, max=2026-07-12 (was 2026-07-10); MN +14 max=2026-07-08 (was 2026-06-30);
#   CA/TX/WA/UT/IL/PA/AZ/MO +0 (other matrix jobs still queued at time of baseline update).
# Run 29171558204 (2026-07-11T23:04 UTC, push after cron probe 2026-07-11T23:00):
#   OR +9 inspections, max=2026-07-10 (was 2026-07-09); MN +3 max=2026-06-30 unchanged;
#   AZ +4 max=2026-07-08 unchanged; CA/TX/WA/UT/IL/PA +0.
# Run 29129361408 (2026-07-10T23:02 UTC, push after cron probe 2026-07-10T23:00):
#   OR +25 inspections, max=2026-07-09 (was 2026-07-06).
# Run 29058877935 (2026-07-10T00:00 UTC schedule): all states +0; AZ max=2026-07-08.
# Run 29056324608 (2026-07-09T23:03 UTC, push after cron probe 2026-07-09T23:00):
#   MN +3 inspections (Charter House, Gardens at St Gertrudes, Our Caring Hands ALRC:1186);
#   max=2026-06-30 unchanged; Delight Healthcare (non-ALRC) skipped.
# Run 28985701456 (2026-07-09T00:38 UTC): schedule all states +0.
# Run 28981794558 (2026-07-08T23:04 UTC): OR +13 max=2026-07-06; MN +5; PA +4; UT +1; AZ +6.
# Cron probe 2026-07-11T23:00 UTC: OR source max=2026-07-10 (+3: Unique Adult Care Home AFH,
#   The Dalles Health And Rehabilitation NF, Clarita Cordizar AFH); MN insertDate max=2026-07-11
#   (+9 survey findings incl. Delight Healthcare, Noble Residence, Chestnut Grove); all other
#   states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO need DB or manual).
# Cron probe 2026-07-10T23:00 UTC: OR source max=2026-07-09 (+1 AFH: Emily Mcmanama RL013009);
#   MN insertDate max=2026-07-09 (no change vs baseline); all other states no new source data.
# Cron probe 2026-07-14T23:02 UTC: OR source max=2026-07-12 (+1 AFH: Nathalie Angulo Aburto
#   MON012816, provider 518286, 6 deficiencies); MN insertDate max=2026-07-14 (+16 complaint
#   events incl. Brooklyn Park AL, Core Health Care, Creekside Villas, Ecumen North Branch);
#   UT CCL public API sample max=2026-03-11 (unchanged vs baseline 2026-06-16); all other
#   states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Cron probe 2026-07-15T23:02 UTC: OR source max=2026-07-14 (+2: Viorica Barbu AFH RL013107
#   provider 517133, 4 deficiencies; Windsor Health And Rehabilitation NF 25C89E provider 385224,
#   23 deficiencies); MN insertDate max=2026-07-14 (unchanged vs baseline); UT CCL sample max
#   2026-03-11 (unchanged vs baseline 2026-06-16); all other states no new source data.
# Cron probe 2026-07-18T23:01 UTC: OR source max=2026-07-17 (+1 AFH: Linda Mabelle Moffo Epse
#   Bello RL013163 provider 3331833868, 4 deficiencies); MN insertDate max=2026-07-18 (+5 survey
#   events: Unity Health Care Services, Homefelt Assisted Living, Watchful Caregivers, Golden Bay
#   Homes, Maranatha); UT CCL sample max=2026-05-07 (unchanged vs baseline 2026-06-16); all other
#   states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Run 30178750043 (2026-07-25T23:04 UTC, push after cron probe 2026-07-25T23:00):
#   OR +10 inspections (13567→13577), max=2026-07-24 (was 2026-07-23); 1 material facility change
#   MN +2 inspections (4821→4823), max=2026-07-14 unchanged; 0 material facility changes (4 of 6
#   insertDate events skipped); Layer 5 post-ingest failed as expected; other matrix states queued
# Cron probe 2026-07-25T23:00 UTC: OR source max=2026-07-24 (+5: Maryville NF 385166
#   Complaint/Re-Licensure 2 deficiencies; Salem Transitional Care NF 385234 Complaint/Re-Licensure
#   16 deficiencies; Mildred Kamami AFH RL013322 Re-Licensure 19 deficiencies; Nathalie Angulo
#   Aburto AFH MON012816 Monitoring 6 deficiencies; Ruby Brazelton AFH RL013324 Re-Licensure
#   9 deficiencies); MN insertDate max=2026-07-25 (+6 survey events: SHARONS FAITH HOME HEALTHCARE,
#   LENOX HOMES LLC, CARENEST SOLUTIONS LLC, BETHANY ASSISTED LIVING, MORNING GLORY HOMES
#   INCORPORAT, CORNERSTONE RESIDENCE OF BAGLE); UT CCL sample unavailable (production API
#   external_id join — unchanged vs baseline 2026-06-16); all other states no new source data
#   (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Run 30132786050 (2026-07-24T23:04 UTC, push after cron probe 2026-07-24T23:01):
#   OR +7 inspections (13560→13567), max=2026-07-23 (was 2026-07-20); 0 material facility changes
#   MN +2 inspections (4819→4821), max=2026-07-14 unchanged; 0 material facility changes (3 of 5
#   insertDate events skipped); AZ +5 max=2026-07-23; PA +5; Layer 5 post-ingest failed as expected
# Cron probe 2026-07-24T23:01 UTC: OR source max=2026-07-23 (+4: Highland House NF 385149
#   Complaint/Re-Licensure 0 deficiencies; Abdi Emana AFH MON013285 Monitoring 1 deficiency;
#   Debra Carey AFH MON013240 Monitoring 5 deficiencies; The Pearl at Kruse Way NF 38L502
#   Complaint/Re-Licensure 1 deficiency); MN insertDate max=2026-07-24 (+5 survey events:
#   CURE HOME HEALTH INC, SERENDIPITOUS LIVING, NEW LIFE CARE LLC, PRAIRIE RESIDENCE CARE LLC,
#   EDGEWOOD EGF SENIOR LIVING); UT CCL sample max unavailable (production API external_id join
#   returned no dates — unchanged vs baseline 2026-06-16); all other states no new source data
#   (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Run 30052034085 (2026-07-23T23:04 UTC, push after cron probe 2026-07-23T23:01):
#   MN +99 inspections (4720→4819), max=2026-07-08 unchanged; 53 material facility changes
#   (incl. Scandi Haven of Cura, Southern Oaks Place, Vitacare Living); Layer 5 post-ingest failed
#   as expected; other matrix states still queued at time of summary
# Cron probe 2026-07-23T23:01 UTC: OR source max=2026-07-20 (unchanged vs baseline — ingested
#   run 29876029989); MN insertDate max=2026-07-23 (+7 survey events: Supportive Living LLC,
#   Grove Living Company, Jabez Customized Living Servic, Scandi Haven of Cura, Tamarack Court of
#   Bemidji, Southern Oaks Place, Decker's Family Care Inc); UT CCL sample max unavailable
#   (production API external_id join returned no dates — unchanged vs baseline 2026-06-16); all other
#   states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Run 29964962053 (2026-07-22T23:04 UTC, push after cron probe 2026-07-22T23:00):
#   MN +5 inspections (4715→4720), max=2026-07-08 unchanged; 2 material facility changes
#   (Vitacare Living, Scandi Haven of Cura); 5 of 7 insertDate events ingested; 2 skipped
# Cron probe 2026-07-22T23:00 UTC: OR source max=2026-07-20 (unchanged vs baseline — ingested
#   run 29876029989); MN insertDate max=2026-07-22 (+7 survey/complaint events: 1 On 1 Comprehensive
#   Healthcar, Hope Residential Care, Care Partners Homecare, Open Arms Housing, SMC Ashton Inc,
#   Scandi Haven of Cura, Vitacare Living); UT CCL sample max=2026-03-11 (unchanged vs baseline
#   2026-06-16); all other states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Run 29876029989 (2026-07-21T23:06 UTC, push after cron probe 2026-07-21T23:02):
#   OR +7 inspections, max=2026-07-20 (was 2026-07-17); 2 material facility changes
#   MN +0 inspections, max=2026-07-08 unchanged; 0 material facility changes
# Cron probe 2026-07-21T23:02 UTC: OR source max=2026-07-20 (+2 AFH: Zaida Santillan 013179
#   Offsite 1 deficiency; Elkhan Babayev RL013155 Re-Licensure 5 deficiencies); MN insertDate max
#   2026-07-19 (unchanged vs baseline — 7 events already ingested run 29707350026); UT CCL sample
#   max=2026-02-04 (unchanged vs baseline 2026-06-16); all other states no new source data
#   (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Cron probe 2026-07-20T23:02 UTC: OR source max 2026-07-17 (unchanged); MN insertDate max 2026-07-19
#   (unchanged vs yesterday — same 7 events already ingested run 29707350026); UT CCL sample max
#   2026-05-07 (unchanged vs baseline 2026-06-16); all other states no new source data.
# Cron probe 2026-07-19T23:02 UTC: OR source max=2026-07-17 (unchanged vs baseline); MN insertDate
#   max=2026-07-19 (+7 survey events: Antique Gardens Senior Care, Arden Glades Assisted Living,
#   Shepherds Way Home, Spirit Care Homes, 3MB Health Services, Absolute Homes Inc, SMC Ashton Inc;
#   +5 insertDate 07/18 still pending from prior probe); UT CCL sample max=2026-05-07 (unchanged vs
#   baseline 2026-06-16); all other states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB or manual).
# Cron probe 2026-07-17T23:01 UTC: OR source max=2026-07-16 (+6: South Hills Rehab NF 25CF74,
#   Royale Gardens NF 25D98D, Shelley Murphy AFH RL012882, David Schill AFH MON013132, Paradise
#   Adult Care AFH RL013103, Rosemarie Tagalogon AFH MON013121); MN insertDate max=2026-07-17
#   (+27 survey/complaint events across 12+ facilities); UT CCL sample max=2026-03-11 (unchanged
#   vs baseline 2026-06-16); all other states no new source data (CA/TX/WA/IL/PA/AZ/MO need DB
#   or manual).
# Run 30742425936 (2026-08-02T09:46 UTC, Sunday schedule): OR +37 max=2026-07-31; MN +24 max=2026-07-21;
#   AZ +42 max=2026-07-31; WA +61 max unchanged; UT +3 max=2026-07-06; PA +28 max unchanged;
#   CA +0 max=2026-07-17; IL/TX/MO +0.
# Run 31226001136 (2026-08-07T23:05 UTC, push after cron probe 2026-08-07T23:02):
#   MN +3 inspections (4862→4865), max=2026-07-28 unchanged; 0 material facility changes
#   (4 of 7 insertDate 08/07 events skipped — non-ALRC or already in DB); Layer 5 failed (denorm)
# Run 31283132604 (2026-08-08T23:04 UTC, push after cron probe 2026-08-08T23:00):
#   MN +2 inspections (4865→4867), max=2026-07-28 unchanged; 0 material facility changes
#   (3 of 5 insertDate 08/08 events skipped — non-ALRC or already in DB); Layer 5 failed (denorm)
# Cron probe 2026-08-08T23:00 UTC: OR source max=2026-08-05 (unchanged vs baseline); MN insertDate
#   max=2026-08-08 (+5 survey events: SOMCARE LLC provider 40753 resolved 7/14; RISEN HOME CARE LLC
#   provider 36999 resolved 7/22; MILL CITY HOME HEALTH CARE INC provider 36730 resolved 4/01;
#   NERVANAS CARING HANDS INC provider 30664 resolved 6/24; ADITH MILLER MANOR provider 20147
#   resolved 7/24/2025); all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO need DB
#   or manual).
# Cron probe 2026-08-07T23:02 UTC: OR source max=2026-08-05 (unchanged vs baseline); MN insertDate
#   max=2026-08-07 (+7 survey events: Nordic Wood Assisted Living resolved 6/10; Benedetta Home Care
#   Services resolved 7/09; The Hummingbird resolved 11/24/2025; Villa Court LLC resolved 4/24;
#   Elmhurst Commons Apartments resolved 7/22; Assumption Court resolved 7/15; Ostrander Assisted
#   Living resolved 5/12); all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO need DB
#   or manual).
# Cron probe 2026-08-04T23:01 UTC: OR source max=2026-07-31 (unchanged vs Sunday ingest); MN insertDate
#   max=2026-08-04 (+1 non-ALRC survey PDF for Holistic Home Care LLC — expected skipped); all other
#   states no new source data.
# Run 31130314418 (2026-08-06T23:15 UTC, push after cron probe 2026-08-06T23:01):
#   OR +7 inspections (13621→13628), max=2026-08-05 (was 2026-08-04); 1 material facility change
#   (2 new 8/05 rows hit statement timeout during ingest — may need retry); Layer 5 post-ingest failed
#   MN +0 inspections (4862 unchanged), max=2026-07-28 unchanged; 0 material facility changes
#   (3 insertDate 08/06 events were posting delays — resolved dates already in DB); Layer 5 failed
# Cron probe 2026-08-06T23:01 UTC: OR source max=2026-08-05 (+2: Columbia Basin Care Facility NF
#   385049 Complaint/Re-Licensure 0 deficiencies 8/05; Cecile Mukandekwe AFH RL013581 Re-Licensure
#   5 deficiencies 8/05); MN insertDate max=2026-08-06 (+3 survey events: SUNRISE ASSISTING LIVING
#   LLC provider 41846 resolved 7/07; OPTIMAL LOVING CARE provider 41173 resolved 7/02; HOPE HOMES LLC
#   provider 38736 resolved 2/11); all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO need DB
#   or manual).
# Run 31649927067 (2026-08-12T23:11 UTC push after cron probe 2026-08-12): OR +14 max=2026-08-11
#   (was 2026-08-05); MN +10 max=2026-07-30 (was 2026-07-28), 3 material facility changes;
#   UT +2 max=2026-07-21; AZ +24 max=2026-08-11; PA +3 max unchanged; CA/WA/IL/MO +0; TX manual fail.
#   Layer 5 post-ingest failed on OR/MN/UT/AZ/PA/IL/CA (denorm) — ingest steps succeeded.
# Cron probe 2026-08-13T23:22 UTC: OR source max=2026-08-12 (+2 vs ingested max 2026-08-11:
#   Fanaye Tesguri AFH RL013493 Re-Licensure 8 deficiencies; Avamere Rehabilitation of Lebanon NF
#   385168 Complaint/Re-Licensure 0 deficiencies); MN insertDate max=2026-08-13 (+5 survey events vs
#   LAST_MN_INSERT_BASELINE 2026-08-12: Ultimate Care Assisted Living, SMC Ashton Inc, Minnesota
#   Wellness Center LLC, Mala Strana Assisted Living, ADAPTA); all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO need DB or manual; full GHA matrix run 31649927067 completed 2026-08-13).
# Cron probe 2026-08-12T23:06 UTC: OR source max=2026-08-11 (+7 rows vs baseline 2026-08-05:
#   Tigard Rehab NF 38L600 8/07; Ashland Post Acute NF 385197 8/07; Belmont Care NF 38E196 8/07;
#   Evergreen Post Acute NF 38E142 8/07; Shalo Sado AFH 2679378118 8/10; French Prairie Nursing NF
#   385117 8/10; Lucian Roman And Mihaela Roman AFH 518744 8/11); MN insertDate max=2026-08-12
#   (+12 events vs LAST_MN_INSERT_BASELINE 2026-08-08: 4 complaint PDFs 8/11 incl. Diversity Home Care,
#   Cornerstone Residence of Fosst, Brooke Manor, Abilit Holdings Meadow Lakes; 8 survey PDFs 8/12 incl.
#   Alliance Wellness Homes, Hillcrest Terrace, Healing Home Services, Joy Care Homes, Careview Idaho,
#   Orchard Path, Campus A/L, Chosen Valley Assisted Living); all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO need DB or manual; Sunday GHA 31303537270 2026-08-09 all +0).
# Cron probe 2026-08-05T23:02 UTC: OR source max=2026-08-04 (+2 since Sunday ingest: Corvallis Manor
#   NF 385072 Complaint/Re-Licensure 0 deficiencies 8/03; Highland Adult Care Home LLC AFH MON013533
#   Monitoring 1 deficiency 8/04); MN insertDate max=2026-08-05 (+20 survey/complaint events with
#   resolved dates 7/16–7/28); MN resolved max=2026-07-28 (unchanged vs Sunday ingest max=2026-07-21
#   for ingested rows); all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO need DB or manual).
# Run 31055201575 (2026-08-05T23:06 UTC, push after cron probe): OR +7 inspections (13614→13621),
#   max=2026-08-04; 0 material facility changes; Layer 5 post-ingest failed as expected.
#   MN +15 inspections (4847→4862), max unchanged; 8 material facility changes (Cornerstone Residence
#   of Fosst, Maple Hill Senior Living, Meadow Ridge, The Lodge, Lino Lakes AL, Global Pointe, Golden
#   Horizons, Norbella Senior Living Savage); Layer 5 post-ingest failed as expected.
# Cron probe 2026-08-26T23:00 UTC: OR source max=2026-08-25 (+5 vs ingested max 2026-08-21:
#   Avamere Transitional Care at Sunnyside NF 385189 Complaint/Re-Licensure 2 deficiencies 8/24;
#   Mary Ellen Sprague AFH RL013440 Re-Licensure 8 deficiencies 8/24; Yolanda Roman Espinoza And
#   Veronica Martinez AFH RL013877 Re-Licensure 3 deficiencies 8/24; Chehalem Post Acute NF 385199
#   Complaint/Re-Licensure 9 deficiencies 8/25; Elisabeta Kiss-Racasan AFH RL013902 Re-Licensure
#   2 deficiencies 8/25); MN insertDate max=2026-08-26 (+8 survey/complaint events vs
#   LAST_MN_INSERT_BASELINE 2026-08-23: Everlasting Care Residence LLC, Rejoyce Health Care LLC,
#   Brooklyn Park Assisted Living, A Daughter's Love Inc, Milestone Senior Living Fariba (×2), Villa
#   St Vincent, Woodbury Villa); MN resolved max=2026-08-19 unchanged; all other states no new source
#   data (CA/TX/WA/UT/IL/PA/AZ/MO need DB or manual; Sunday GHA 32627736751 ingested 2026-08-23).
# Run 33313974682 (2026-08-30 Sunday schedule): CA +31 max=2026-08-22; AZ +26 max=2026-08-27;
#   MN +13 max=2026-08-19; PA +7 max=2026-08-28; OR +3 max=2026-08-25; UT +1 max=2026-08-05;
#   IL/MO/TX/WA +0.
# Cron probe 2026-09-01T23:02 UTC: OR source max=2026-08-31 (+9 vs ingested max 2026-08-25:
#   Sharon Covaciu AFH 327 Re-Licensure 1 deficiency 8/31; Nathalie Angulo Aburto AFH 518286 Offsite 1
#   deficiency 8/31; Anchor Care LLC AFH 534 Initial 13 deficiencies 8/28; Norma Calderon AFH 18
#   Re-Licensure 2 deficiencies 8/28; Mt. Tabor Health and Rehabilitation NF 385141 Complaint/Re-Licensure
#   0 deficiencies 8/27; Damaris Nyanjui AFH 374 Re-Licensure 7 deficiencies 8/26; Oliyad Gamechu AFH 429
#   Monitoring 3 deficiencies 8/26; Simona Dan AFH 524019 Re-Licensure 2 deficiencies 8/26; Wondwossen Tekle
#   AFH 9362976505 Re-Licensure 5 deficiencies 8/26); MN insertDate max=2026-09-01 (+3 posting-delay events
#   vs LAST_MN_INSERT_BASELINE 2026-08-30: 2 complaints resolved 8/24–8/25, 1 survey resolved 7/28); MN
#   resolved max=2026-08-25 (+2 complaints vs ingested max 2026-08-19); all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO already current per Sunday GHA 33313974682 2026-08-30).
# Run 34031195270 (2026-09-06 Sunday schedule): OR +24 max=2026-09-03 (was 2026-08-31);
#   MN +8 max=2026-08-25 unchanged; AZ +25 max=2026-09-04; UT +2 max=2026-08-13; PA +5;
#   CA +0 max=2026-08-28; IL/MO/TX/WA +0. Layer 5 post-ingest failed on OR/MN (denorm).
# Cron probe 2026-09-06T23:02 UTC: OR source max=2026-09-05 (+1 vs ingested max 2026-09-03:
#   Nathalie Angulo Aburto AFH 518286 Condition Monitoring 3 deficiencies 9/05); MN insertDate
#   max=2026-09-05 (+8 survey PDFs: Caring Group Home Co, Amana Home Care LLC, Souriyathay
#   Enterprises LLC, Sister Support LLC, Empire Systems Home Care, Brookridge, Mother of Mercy,
#   Fair Meadow Assisted Living); MN resolved max=2026-08-25 unchanged; all other states no new
#   source data (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 34031195270).
# Cron probe 2026-09-07T23:02 UTC: OR source max=2026-09-05 (unchanged vs 2026-09-06 probe —
#   same Nathalie Angulo Aburto AFH 518286 Condition Monitoring 3 deficiencies 9/05 pending
#   ingest); MN insertDate max=2026-09-05 (unchanged — same 8 survey PDFs still pending ingest);
#   MN resolved max=2026-08-25 unchanged; all other states no new source data.
# Run 34168824191 (2026-09-07T23:05 UTC, push after cron probe 2026-09-07T23:02):
#   OR +1 inspection (13748→13749), max=2026-09-05 (was 2026-09-03); 0 material facility changes
#   MN +0 inspections (8 insertDate events skipped — non-ALRC or already in DB); Layer 5 failed (denorm)
# Cron probe 2026-09-09T23:02 UTC: OR source max=2026-09-08 (+2 vs ingested max 2026-09-05:
#   Rosanna Corpuz AFH 526396 Re-Licensure 1 deficiency 9/08; Loise Mungai AFH 5639546804
#   Re-Licensure 1 deficiency 9/08); MN insertDate max=2026-09-09 (+5 complaint PDFs:
#   FORTHRIGHT HOME CARE LLC, HOMEFELT ASSISTED LIVING ×2, ACE HOMES INC, CHASE COURAGEOUS
#   HEALTH SERVIC); MN resolved max=2026-09-03 unchanged; all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 34031195270 and run 34168824191).
# Run 34415388839 (2026-09-09T23:06 UTC, push after cron probe 2026-09-09T23:02):
#   OR +9 inspections (13749→13758), max=2026-09-08 (was 2026-09-05); 1 material facility change
#   MN +3 inspections (4933→4936), max=2026-09-03 (was 2026-08-25); 0 material facility changes
#   AZ +20 max=2026-09-08; UT +1; PA +1; CA/TX/WA/IL/MO +0; Layer 5 post-ingest failed (denorm).
# Cron probe 2026-09-10T23:01 UTC: OR source max=2026-09-09 (+2 vs ingested max 2026-09-08:
#   Tammy Bryant AFH 513946 RL014180 Re-Licensure 3 deficiencies 9/09; Dennis Joseph Martija AFH
#   5630339556 RL014198 Re-Licensure 1 deficiency 9/09); MN insertDate max=2026-09-09 (unchanged —
#   same 5 complaint PDFs; 3 ingested run 34415388839, 2 may still be pending/skipped); MN
#   resolved max=2026-09-03 (ingested run 34415388839); all other states no new source data.
# Run 34540485733 (2026-09-10T23:04 UTC, push after cron probe 2026-09-10T23:01):
#   OR +5 inspections (13758→13763), max=2026-09-09 (was 2026-09-08); MN +0 max=2026-09-03 unchanged
#   (insertDate events skipped — non-ALRC or already in DB); UT +4 max=2026-08-17; AZ +18 max=2026-09-09;
#   PA +9 max unchanged; CA/WA/IL/MO +0; TX manual fail. Layer 5 post-ingest failed (denorm).
# Cron probe 2026-09-11T23:02 UTC: OR source max=2026-09-10 (+1 vs ingested max 2026-09-09:
#   Daniel Mack And Alaura Mack AFH 4504631617 RL014032 Re-Licensure 7 deficiencies 9/10); MN insertDate
#   max=2026-09-11 (+20 survey PDFs with resolved dates 5/06–8/12 — posting-delay batch); MN resolved
#   max=2026-09-03 unchanged; all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO current
#   per GHA 34540485733).
# Run 34758293379 (2026-09-13T12:52 UTC, Sunday schedule): OR +7 max=2026-09-10 (was 2026-09-10);
#   MN +9 max=2026-09-03 unchanged; AZ/UT/PA/CA/WA/IL/MO per matrix; TX manual fail. Layer 5 failed (denorm).
# Cron probe 2026-09-17T23:02 UTC: OR source max=2026-09-16 (+6 vs ingested max 2026-09-10:
#   Girley Serdar AFH 4554689178 Monitoring 9/11; Sefika Alijaj AFH 509758 Complaint 9/11; Tede Esayas AFH
#   9/14 Re-Licensure 11; Leyenda Lloyd AFH 2647328602 Re-Licensure 9/15; Mekdes Taye AFH 7089315192
#   Re-Licensure 9/15; Fabiola Munoz AFH 9/16 Re-Licensure 5); MN insertDate max=2026-09-17 (+52 vs
#   LAST_MN_INSERT_BASELINE 2026-09-09 — posting-delay batch incl. VISTA PRAIRIE AT EAGLE POINT,
#   OAKLAND ASSISTED LIVING LLC, NORTH OAKS MEMORY CARE); MN resolved max=2026-09-03 unchanged; all other
#   states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 34758293379).
# Cron probe 2026-09-18T23:14 UTC: OR source max=2026-09-17 (+3 vs probe 2026-09-16 / +7 rows vs ingested
#   max 2026-09-10: Jennifer Belovitch AFH 525580 Re-Licensure 3; Creston Health NF 385121 Complaint/Re-Licensure
#   0; Abiyot Amajo AFH Re-Licensure 7); MN insertDate max=2026-09-18 (+57 vs LAST_MN_INSERT_BASELINE 2026-09-09,
#   +5 new insertDate 9/18 on top of 9/17 batch); MN resolved max=2026-09-03 unchanged; all other states no new
#   source data (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 34758293379).
# Run 35405269569 (2026-09-18T23:20 UTC, push after cron probe 2026-09-18): OR +25 inspections (13776→13801),
#   max=2026-09-17 (was 2026-09-10); MN +9 (4955→4964), max=2026-09-03 unchanged; 1 material facility change
#   (Cannon Falls Assisted Living). Layer 5 post-ingest failed (denorm); ingest steps succeeded.
# Cron probe 2026-09-19T23:12 UTC: OR source max=2026-09-18 (+3 vs ingested max 2026-09-17: Abenet Gebre AFH
#   439 Offsite 1 deficiency; Mihaela G Lacatusu AFH 522957 Re-Licensure 2; Wamucii Kareko And Rosemary Wanjiku
#   AFH RL014375 Re-Licensure 8); MN insertDate max=2026-09-19 (+6 survey PDFs vs LAST_MN_INSERT_BASELINE
#   2026-09-18: JOURNEYS, OPTIMUM HEALTHCARE SERVICES LLC, INFINITY CARE CORP, TOTAL HOME HEALTH SERVICES LLC,
#   GRACE HOMES, HASTINGS SENIOR HEALTH AND LIV); MN resolved max=2026-09-03 unchanged; all other states no new
#   source data (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 34758293379 and run 35405269569).
# Run 35475557882 (2026-09-19 push after cron probe 2026-09-19): OR +10 inspections (13801→13811), max=2026-09-18;
#   MN +5 (4964→4969), max=2026-09-03 unchanged; 2 material OR facility changes. Layer 5 failed (denorm); ingest OK.
# Cron probe 2026-09-20T23:00 UTC: OR source max=2026-09-18 (0 rows after 9/18 — current vs ingested max 9/18);
#   MN insertDate max=2026-09-20 (+14 events vs LAST_MN_INSERT_BASELINE 2026-09-18: 6 on 9/19 posting-delay batch,
#   8 on 9/20); MN resolved max=2026-09-03 unchanged; all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO).
# Cron probe 2026-09-21T23:11 UTC: OR source max=2026-09-18 (unchanged); MN insertDate max=2026-09-20 (unchanged vs
#   GHA 35543543400 +0); all other states no new source data.
# Cron probe 2026-09-22T23:11 UTC: OR source max=2026-09-21 (+1 vs ingested max 2026-09-18: Daniela And Jacob Babalai
#   AFH RL014404 Re-Licensure 3 deficiencies 9/21); MN insertDate max=2026-09-22 (+11 complaint PDFs vs
#   LAST_MN_INSERT_BASELINE 2026-09-20: posting-delay batch with resolved dates through 9/16); MN resolved max=2026-09-16
#   (+13 vs ingested max 2026-09-03); all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday
#   GHA 35511299137 and run 35543543400).
# Run 35796501505 (2026-09-22T23:15 UTC, push after cron probe 2026-09-22): OR +6 inspections (13811→13817),
#   max=2026-09-21 (was 2026-09-18); 0 material facility changes. MN +12 (4975→4987), max=2026-09-16 (was 2026-09-03);
#   5 material facility changes. Layer 5 post-ingest failed (denorm) on OR/MN; ingest steps succeeded.
# Cron probe 2026-09-23T23:06 UTC: OR source max=2026-09-21 (unchanged vs ingested max 2026-09-21); MN insertDate
#   max=2026-09-23 (+3 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-22: SKYBLU RESIDENTIAL SERVICES provider 39509
#   resolved 5/21; REST CARE HOME SERVICES LLC provider 37035 resolved 5/28; PROVIDENCE VILLA provider 34011 resolved
#   8/27); MN resolved max=2026-09-16 unchanged; all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO current
#   per Sunday GHA 35511299137 and run 35796501505).
# Run 35932265892 (2026-09-23T23:10 UTC, push after cron probe 2026-09-23): MN +1 inspection (4987→4988),
#   max=2026-09-16 unchanged; 0 material facility changes (2 of 3 insertDate events skipped — non-ALRC). OR +0.
#   Layer 5 post-ingest failed (denorm) on MN/OR; ingest steps succeeded. Matrix still running for other states.
# Cron probe 2026-09-24T23:02 UTC: OR source max=2026-09-23 (+2 vs ingested max 2026-09-21: Natalya Balanetskaya AFH
#   RL014449 Re-Licensure 1 deficiency 9/23; Teshite Usha AFH RL014453 Re-Licensure 1 deficiency 9/23; plus 3 rows
#   on 9/22 pending ingest: Portland Health And Rehabilitation NF 385228, Phoebe Ochieng And Irene Mwangi AFH INI014434,
#   Olepa Polataivao AFH RL014438); MN insertDate max=2026-09-24 (+3 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-23:
#   DIS-GENERATION GROUP INC provider 33047 resolved 8/20; ASSURED CARE provider 32366 resolved 8/20; ARBOR GARDEN
#   PLACE provider 30217 resolved 8/20); MN resolved max=2026-09-16 unchanged; all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 35511299137 and run 35932265892).
# Run 36071048626 (2026-09-24T23:06 UTC, push after cron probe 2026-09-24): MN +3 inspections (4988→4991),
#   max=2026-09-16 unchanged; 1 material facility change (Arbor Garden Place). OR +12 (13817→13829),
#   max=2026-09-23 (was 2026-09-21); 1 material facility change (Faye Wright Senior Living). IL +0 (147→147).
#   Layer 5 post-ingest failed (denorm) on MN/OR/IL; ingest steps succeeded. Remaining matrix states queued at
#   baseline update time (CA/TX/WA/UT/PA/AZ/MO expected +0 from probe).
# Cron probe 2026-09-25T23:12 UTC: OR source max=2026-09-23 (unchanged vs ingested max 2026-09-23; 0 rows after
#   9/23 in inspections export); MN insertDate max=2026-09-25 (+11 survey PDFs vs LAST_MN_INSERT_BASELINE
#   2026-09-24: A FUTURE GOALS provider 39744 resolved 8/25; ANGEL'S HEALTH & HOME CARE SER 36870 resolved 1/16;
#   ANGELS HEALTH AND HOME CARE SE 39329 resolved 9/25/2025; ASPEN HOME HEALTH CARE INC 35930 resolved 8/19;
#   CARING NURSES LLC 33551 resolved 2/27; COMFORT CARE HOMES 34809 resolved 8/11; DIVINE CARE SPACES 39779
#   resolved 5/14; JAYNE HEALTHCARE LLC 40998 resolved 4/03; SHEPHERD SENIOR HOUSING LLC 25829 resolved 3/31;
#   SISTER SUPPORT LLC 37126 resolved 6/11; THE FRIENDSHIP HOME COMMUNITY 30530 resolved 8/19); MN resolved max
#   2026-09-16 unchanged; all other states no new source data (CA/TX/WA/UT/IL/PA/AZ/MO current per run 36071048626).
# Run 36200310340 (2026-09-25T23:16 UTC, push after cron probe 2026-09-25): MN +4 inspections (4991→4995),
#   max=2026-09-16 unchanged; 0 material facility changes (7 of 11 insertDate events skipped — non-ALRC or
#   already in DB). OR +0 expected at probe layer. Layer 5 post-ingest failed (denorm) on MN; ingest succeeded.
#   Remaining matrix states queued at baseline update time (CA/TX/WA/UT/IL/PA/AZ/MO expected +0 from probe).
# Run 36279338857 (2026-09-26T23:24 UTC, push after cron probe 2026-09-26): OR +7 inspections (13833→13840),
#   max=2026-09-25 (was 2026-09-23); 1 material facility change (Palatial Springs Adult Foster Home Corporation).
#   MN +2 inspections (4995→4997), max=2026-09-16 unchanged; 0 material facility changes (7 of 9 insertDate events
#   skipped — non-ALRC or already in DB). Layer 5 post-ingest failed (denorm) on OR/MN; ingest succeeded. Remaining
#   matrix states queued at baseline update time (CA/TX/WA/UT/IL/PA/AZ/MO expected +0 from probe).
# Cron probe 2026-09-26T23:15 UTC: OR source max=2026-09-25 (+1 vs ingested max 2026-09-23: Palatial Springs
#   Adult Foster Home Corporation AFH RL014533 Re-Licensure 2 deficiencies 9/25); MN insertDate max=2026-09-26
#   (+9 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-25: ADVOCATE CARE LLC resolved 8/25; WALNUT GROVE HOME
#   resolved 2/26; MIDWEST RESIDENTIAL INC resolved 8/26; BRIGHT PATH HOMES LLC resolved 5/13; EAGLE GROUP HOME LLC
#   resolved 6/10 and 9/02; OUR CARING HANDS LLP resolved 6/04; CHARTER HOUSE resolved 6/18; NATURE'S POINT
#   ASSISTED LIVING resolved 8/28); MN resolved max=2026-09-16 unchanged; all other states no new source data
#   (CA/TX/WA/UT/IL/PA/AZ/MO current per run 36200310340).
# Run 36322101751 (2026-09-27T13:21 UTC, Sunday weekly schedule): full matrix all states; MN +7 inspections
#   (4997→5004), max=2026-09-16 unchanged; 0 material facility changes; OR +0 max=2026-09-25; CA/TX/WA/UT/IL/PA/AZ/MO
#   +0 inspection deltas. Layer 5 post-ingest failed (denorm) on several states — ingest steps succeeded.
# Cron probe 2026-09-27T23:00 UTC: OR source max=2026-09-25 (unchanged vs ingested max; 0 rows after 9/25 in export);
#   MN insertDate max=2026-09-27 (+8 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-26: MAPLEWOOD MEADOW ASSISTED
#   LVG, QUALITY LIVING CARE LLC, SISTER SUPPORT LLC, PEACE HOMECARE SERVICES LLC, FORTUNATE HOMES LLC, VIKING MANOR
#   NURSING HOME/NOR, THE CARING SISTERS HOME CARE, ST ELIZABETH HOSPITAL — mostly non-ALRC/posting-delay; Sunday run
#   36322101751 already ingested +7 from bundle-2026-09-27.json); MN resolved max=2026-09-16 unchanged; all other
#   states no new source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 36322101751).
# Cron probe 2026-09-29T23:01 UTC: OR source max=2026-09-28 (+1 vs ingested max 2026-09-25: Madina Kibe AFH
#   RL014555 Re-Licensure 6 deficiencies 9/28); MN insertDate max=2026-09-29 (+5 complaint PDFs vs
#   LAST_MN_INSERT_BASELINE 2026-09-27: ANCHOR CARE SERVICES LLC; FRIENDSHIP VILLAGE OF BLOOMING; GOLDEN TOUCH
#   HEALTH CARE LLC x2; RIDGEVIEW SENIOR LIVING); MN resolved max=2026-09-22 unchanged; all other states no new
#   source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 36357479190 + Sunday 36322101751).
# Sunday GHA 38147163196 (2026-10-11T14:26 UTC): OR +25 max=2026-10-08; MN +12 max=2026-09-29; CA +63;
#   AZ +57; WA +45; UT +1; PA +22; IL/MO/TX +0. Layer 5 denorm failed on several jobs; ingest OK.
# Cron probe 2026-10-14T23:00 UTC: OR source max=2026-10-13 (+2 vs ingested max 2026-10-08: Peter Komo AFH
#   RL014743 Re-Licensure 1 deficiency 10/09; Amanuel Sima AFH RL014914 Re-Licensure 9 deficiencies 10/13);
#   MN insertDate max=2026-10-14 (+70 vs LAST_MN_INSERT_BASELINE 2026-09-27 — posting-delay batch incl. 5 on
#   10/14 with resolved dates through 9/23); MN resolved max=2026-09-29 unchanged; all other states no new
#   source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO current per Sunday GHA 38147163196).
# Run 38652120861 (2026-10-15T12:52 UTC, push after cron probe 2026-10-14): OR +19 max=2026-10-13;
#   MN +3 max=2026-09-29 unchanged; UT +2 max=2026-09-15; PA +6 max unchanged; AZ +20 max=2026-10-08;
#   WA/IL/MO/TX +0; Layer 5 denorm failed on several jobs — ingest steps succeeded.
# Cron probe 2026-10-15T23:00 UTC: OR source max=2026-10-13 (unchanged vs ingested max; 0 rows after 10/13);
#   MN insertDate max=2026-10-15 (+5 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-27: HIGH DRIVE
#   CUSTOMIZED/ASSISTE resolved 9/25; MAS HOME HEALTH CARE LLC complaint resolved 9/23; GOLDEN POND WBL resolved
#   1/22; GOLDEN OAKS LIVING CORPORATION resolved 1/01; SCENIC HILLS ALTERNATIVE CARE resolved 9/16); MN
#   resolved max=2026-09-29 unchanged; all other states no new source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO
#   current per GHA 38652120861 + Sunday 38147163196).
# Run 38821496513 (2026-10-15T23:06 UTC, push after cron probe 2026-10-15): MN +4 inspections (5046→5050),
#   max=2026-09-29 unchanged; OR +8 inspections (13902→13910), max=2026-10-13 unchanged; Layer 5 denorm failed
#   on MN/OR — ingest steps succeeded.
# Cron probe 2026-10-16T23:00 UTC: OR source max=2026-10-14 (+1 vs ingested max 2026-10-13: Tigist Hirpa AFH
#   RL014929 Re-Licensure 1 deficiency 10/14); MN insertDate max=2026-10-16 (+4 survey PDFs vs
#   LAST_MN_INSERT_BASELINE 2026-09-27: SILVER MEADOWS ASSISTED LIVING resolved 9/11; 3MB HEALTH SERVICES LLC
#   resolved 6/17; NEW LIFE HOME resolved 9/10; NEW HORIZON ASSISTED LIVING resolved 9/16); MN resolved max
#   2026-09-29 unchanged; all other states no new source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO current
#   per GHA 38821496513 + Sunday 38147163196).
# Run 38979452110 (2026-10-16T23:04 UTC, push after cron probe 2026-10-16): OR +14 inspections (13910→13924),
#   max=2026-10-14 (was 2026-10-13); MN +2 inspections (5050→5052), max=2026-09-29 unchanged (2 of 4 insertDate
#   events skipped — non-ALRC or already in DB); Layer 5 denorm failed on MN/OR — ingest steps succeeded.
# Cron probe 2026-10-17T23:01 UTC: OR source max=2026-10-14 (unchanged vs ingested max 2026-10-14); MN insertDate
#   max=2026-10-17 (+9 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-09-27: TWIN CITIES LIVING ASSISTANCE resolved
#   9/23; ALL WULLANCARE INC resolved 9/2; CHAMPIONS VILLAGE LLC resolved 9/22; GENTLE CARE HOMES INC resolved
#   9/16; JOY CARE HOMES LLC resolved 9/16; ALIZAH FAMILY SERVICES resolved 9/15; NERVANA'S CARING HANDS INC
#   resolved 9/22; CAMPUS A/L resolved 7/15; CEDAR LODGE resolved 9/16); MN resolved max 2026-09-29 unchanged;
#   all other states no new source data at probe layer (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 38979452110 +
#   Sunday 38147163196).
# Run 39077680657 (2026-10-17T23:05 UTC, push after cron probe 2026-10-17): MN +6 inspections (5052→5058),
#   max=2026-09-29 unchanged (3 of 9 insertDate events skipped — non-ALRC or already in DB); Layer 5 denorm
#   failed on MN — ingest steps succeeded. OR matrix job still running at baseline update time.
# Cron probe 2026-10-18T23:01 UTC: OR source max=2026-10-14 (unchanged vs ingested max 2026-10-14); MN insertDate
#   max=2026-10-18 (+6 complaint events vs LAST_MN_INSERT_BASELINE 2026-09-27: CARETTA SENIOR LIVING MAPLEWOO
#   resolved 10/12; WELLSTEAD SENIOR LIVING PLACE resolved 10/12; OPTIONS RESIDENTIAL INC resolved 10/13;
#   RIVER OAKS COLUMBIA HEIGHTS resolved 10/12; WOODBURY ESTATES resolved 10/14 and 10/13); MN resolved source
#   max=2026-10-14 (new vs ingested max 2026-09-29); all other states no new source data at probe layer
#   (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 39077680657 + Sunday 39126360904).
# Cron probe 2026-10-19T23:00 UTC: OR source max=2026-10-14 (unchanged vs ingested max 2026-10-14); MN insertDate
#   max=2026-10-18 (unchanged vs Fri probe); MN resolved source max=2026-10-14 (matches DB after Sunday GHA
#   39126360904 +5 and Fri 39175007010 +0); all other states no new probe-layer signal.
# Cron probe 2026-10-20T23:00 UTC: OR source max=2026-10-14 (unchanged); MN insertDate max=2026-10-18 (unchanged);
#   MN resolved max=2026-10-14 unchanged; CA/TX/WA/UT/IL/PA/AZ/MO no new probe-layer signal (Sunday GHA matrix).
# Cron probe 2026-10-21T23:01 UTC: OR source max=2026-10-20 (+5 vs ingested max 2026-10-14: Makia Jackson AFH
#   10/16 20 deficiencies; Shari Kroh AFH 10/19 3; Antony Leroka And Caroline Njagi AFH 10/20 2; Daniela Nitu AFH
#   10/20 3; Caleb Pop AFH 10/20 1); MN insertDate max=2026-10-21 (+2 complaint events vs LAST_MN_INSERT_BASELINE
#   2026-09-27, resolved 10/12 and 07/01); MN resolved source max=2026-10-14 (unchanged vs Sunday GHA); all other
#   states no new probe-layer signal (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 39175007010 + Sunday 39126360904).
# Run 39691195690 (2026-10-21T23:06 UTC, push after cron probe 2026-10-21): OR +12 inspections
#   (13932→13944), max=2026-10-20; MN +100 inspections (5063→5163), max=2026-10-14 unchanged,
#   changes_detected=12; Layer 5 post-ingest denorm failed on MN/OR — ingest steps succeeded.
# Cron probe 2026-10-22T23:00 UTC: OR source max=2026-10-21 (+1 vs ingested max 2026-10-20: Cathy Russell
#   AFH RL015037 Re-Licensure 4 deficiencies 10/21); MN insertDate max=2026-10-22 (+6 survey PDFs vs
#   LAST_MN_INSERT_BASELINE 2026-10-21: GOLDEN MAPLE HOMES, ESTEEM HOME HEALTH SERVICES, THE BEATITUDES
#   HOMES, BETHEL PAVILION HOMECARE, RESIDENTIAL CARE NINE MILE CRK, GOOD SHEPHERD HOMES — resolved
#   dates 8/20–9/17); MN resolved max=2026-10-14 unchanged; all other states no new probe-layer signal
#   (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 39691195690 + Sunday 39126360904).
# Run 39869381725 (2026-10-22T23:04 UTC, push after cron probe 2026-10-22): OR +3 inspections
#   (13944→13947), max=2026-10-21; MN +6 inspections (5163→5169), max=2026-10-14 unchanged;
#   AZ +6 max=2026-10-20; PA +13 max=2026-10-16; Layer 5 post-ingest denorm failed — ingest succeeded.
# Cron probe 2026-10-23T23:00 UTC: OR source max=2026-10-21 (unchanged vs ingested max 2026-10-21);
#   MN insertDate max=2026-10-23 (+13 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-10-22: ALPHAS HEALTH
#   CARE LLC, BRIDGEWAY ESTATES, CENTRAL MINNESOTA SENIOR CARE, COMFORT CARE CENTER LLC, COMFORT LIVING
#   INC, DIVINE ASSITED LIVING SERVICES, EDEN HOMES INC, GARDEN VIEW, GOODNESS AND MERCY HEALTH SERV,
#   NORTH STAR ASSISTED LIVING, RISEN HOME CARE LLC, SOURIYATHAY ENTERPRISES LLC, VAIMAR SUITES LLC —
#   resolved dates 1/09–9/29); MN resolved max=2026-10-14 unchanged; all other states no new probe-layer
#   signal (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 39869381725 + Sunday 39126360904).
# Run 40037764267 (2026-10-23T23:06 UTC, push after cron probe 2026-10-23): MN +11 inspections
#   (5169→5180), max=2026-10-14 unchanged; AZ +9 max=2026-10-22; OR +0 max=2026-10-21; Layer 5
#   post-ingest denorm failed — ingest steps succeeded.
# Run 40063182079 (2026-10-24T04:39 UTC, push #179): all matrix states +0 inspections (idempotent).
# Cron probe 2026-10-24T23:01 UTC: OR source max=2026-10-21 (unchanged vs ingested max 2026-10-21);
#   MN insertDate max=2026-10-24 (+4 survey PDFs vs LAST_MN_INSERT_BASELINE 2026-10-23: 3D INNOVATIVE
#   CARES LLC resolved 9/10; ESTHERRA CARE LLC resolved 9/24; GENESIS ASSISTED LIVING LLC resolved
#   7/30; HEATHERS MANOR resolved 5/21); MN resolved max=2026-10-14 unchanged; all other states no
#   new probe-layer signal (CA/TX/WA/UT/IL/PA/AZ/MO current per GHA 40063182079 + 40037764267).
# Run 40141232559 (2026-10-24T23:04 UTC, push after cron probe 2026-10-24): MN +1 max=2026-10-14 unchanged;
#   OR +0 max=2026-10-21; Layer 5 denorm failed — ingest steps succeeded.
# Sunday GHA 40194733653 (2026-10-25T12:48 UTC schedule, in progress at probe time): OR +20 inspections
#   (13947→13967), max=2026-10-23 (was 2026-10-21); MN +0 max=2026-10-14 unchanged (4 insertDate 10/24
#   events still pending); UT +1 max=2026-09-23 unchanged; PA/IL/TX +0; matrix jobs AZ/WA/MO queued.
# Cron probe 2026-10-25T23:01 UTC: OR source max=2026-10-23 (ingested Sunday GHA 40194733653 — Renell Kumeh
#   AFH RL015098 10/23; Independence Health And Rehabilitation NF 10/22; Summer Miller AFH RL015057 10/22);
#   MN insertDate max=2026-10-24 (unchanged vs Fri probe — same 4 survey PDFs; Sunday GHA MN +0);
#   MN resolved max=2026-10-14 unchanged; all other states no new probe-layer signal (CA/TX/WA/IL/PA/AZ/MO
#   refreshed or queued on Sunday GHA 40194733653; MO FOIA manual).
# Used when DATABASE_URL is unavailable.
LAST_INGEST_BASELINES: dict[str, date] = {
    "CA": date(2026, 9, 4),  # Sunday GHA +63; probe layer needs DB for CA max
    "TX": date(2023, 2, 16),
    "OR": date(2026, 10, 23),  # GHA 40194733653 +20
    "WA": date(2026, 12, 1),  # known data-quality outlier in source
    "MN": date(2026, 10, 14),
    "UT": date(2026, 9, 15),
    "IL": date(2026, 5, 6),
    "PA": date(2026, 10, 16),  # GHA 40063182079 matrix
    "AZ": date(2026, 10, 22),  # GHA 40037764267 +9
    "MO": date(2026, 6, 11),  # FOIA Excel; no live regulator feed
}
# MN MDH posts events with insertDate later than resolvedDate; track separately.
LAST_MN_INSERT_BASELINE = date(2026, 10, 23)


def _run(cmd: list[str], *, label: str) -> int:
    print(f"\n── {label} ──")
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=REPO_ROOT).returncode


def _max_or_csv(path: Path) -> tuple[int, date | None]:
    if not path.is_file():
        return 0, None
    max_d: date | None = None
    count = 0
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            count += 1
            raw = (row.get("Date") or row.get("Inspection Date") or "").strip()
            if not raw:
                continue
            for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
                try:
                    d = datetime.strptime(raw, fmt).date()
                    if max_d is None or d > max_d:
                        max_d = d
                    break
                except ValueError:
                    pass
    return count, max_d


def _max_mn_json(path: Path) -> tuple[int, date | None, date | None]:
    if not path.is_file():
        return 0, None, None
    data = json.loads(path.read_text())
    max_resolved: date | None = None
    max_insert: date | None = None
    count = 0
    for fac in data:
        for key in ("inspections", "complaints"):
            for insp in fac.get(key) or []:
                count += 1
                for field, target in (("resolvedDate", "resolved"), ("insertDate", "insert")):
                    raw = insp.get(field)
                    if not raw:
                        continue
                    try:
                        d = datetime.strptime(raw, "%m/%d/%Y").date()
                    except ValueError:
                        continue
                    if target == "resolved":
                        if max_resolved is None or d > max_resolved:
                            max_resolved = d
                    elif max_insert is None or d > max_insert:
                        max_insert = d
    return count, max_resolved, max_insert


def _production_max_date(state_code: str) -> date | None:
    slug = STATE_SLUGS[state_code]
    url = f"{PRODUCTION_API}/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "StarlynnCare-probe/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f"  WARN: production API failed for {state_code}: {exc}")
        return None
    dates: list[date] = []
    for fac in data.get("facilities", []):
        raw = fac.get("last_inspection_date")
        if not raw:
            continue
        try:
            dates.append(datetime.strptime(raw[:10], "%Y-%m-%d").date())
        except ValueError:
            pass
    return max(dates) if dates else None


def _db_baseline(state_code: str) -> dict[str, Any] | None:
    if not os.environ.get("DATABASE_URL"):
        return None
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from validate._lib import get_conn  # noqa: E402

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(DISTINCT i.id) AS n, MAX(i.inspection_date) AS max_date
            FROM inspections i
            JOIN facilities f ON f.id = i.facility_id
            WHERE f.state_code = %s
            """,
            (state_code,),
        )
        row = cur.fetchone()
    return {"count": row["n"] or 0, "max_date": row["max_date"]}


def probe_or(skip_download: bool) -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "or-scrape"
    if not skip_download:
        _run([sys.executable, str(SCRAPERS / "or_csv_export.py")], label="OR CSV export")
    today = date.today().isoformat()
    insp = out_dir / f"inspections-{today}.csv"
    count, source_max = _max_or_csv(insp)
    return {"state": "OR", "source_rows": count, "source_max": source_max, "source_file": str(insp)}


def probe_mn(skip_download: bool) -> dict[str, Any]:
    out_dir = REPO_ROOT / ".firecrawl" / "mn-scrape"
    if not skip_download:
        _run([sys.executable, str(SCRAPERS / "mn_mdh_inspections_scrape.py")], label="MN MDH findings")
    today = date.today().isoformat()
    findings = out_dir / f"mn-findings-{today}.json"
    count, source_max, insert_max = _max_mn_json(findings)
    return {
        "state": "MN",
        "source_rows": count,
        "source_max": source_max,
        "source_insert_max": insert_max,
        "source_file": str(findings),
    }


def probe_static(state: str, note: str) -> dict[str, Any]:
    return {"state": state, "source_rows": None, "source_max": None, "note": note}


STATE_PROBERS = {
    "CA": lambda skip: probe_static("CA", "Requires DATABASE_URL for ccld_citations_ingest; use cdss-weekly-ingest.yml"),
    "TX": lambda skip: probe_static("TX", "TULIP Aura JSON requires manual browser capture"),
    "OR": probe_or,
    "WA": lambda skip: probe_static("WA", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "MN": probe_mn,
    "UT": lambda skip: probe_static("UT", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "IL": lambda skip: probe_static("IL", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "PA": lambda skip: probe_static("PA", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "AZ": lambda skip: probe_static("AZ", "Requires DATABASE_URL for facility list; use weekly_inspection_ingest.py"),
    "MO": lambda skip: probe_static("MO", "FOIA Excel (missourirecords.xlsx) — no live regulator feed; manual refresh"),
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Source-only inspection freshness probe")
    ap.add_argument("--state", choices=COVERED_STATES)
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    states = [args.state] if args.state else list(COVERED_STATES)
    print("=" * 60)
    print("StarlynnCare — Inspection source freshness probe")
    print(f"  Date: {date.today().isoformat()}")
    print(f"  States: {', '.join(states)}")
    print("=" * 60)

    pending: list[str] = []
    results: list[dict[str, Any]] = []

    for st in states:
        print(f"\n{'=' * 60}\n  STATE: {st}\n{'=' * 60}")
        probe = STATE_PROBERS[st](args.skip_download)
        db = _db_baseline(st)
        prod_max = _production_max_date(st)

        probe["db_max"] = db["max_date"] if db else None
        probe["db_count"] = db["count"] if db else None
        probe["production_max"] = prod_max

        last_ingest = LAST_INGEST_BASELINES.get(st)
        baseline = probe["db_max"] or last_ingest or probe["production_max"]
        source_max = probe.get("source_max")
        probe["last_ingest_max"] = last_ingest
        insert_max = probe.get("source_insert_max")
        mn_insert_pending = (
            st == "MN"
            and insert_max is not None
            and insert_max > LAST_MN_INSERT_BASELINE
        )
        if (source_max and baseline and source_max > baseline) or mn_insert_pending:
            probe["pending_new_data"] = True
            pending.append(st)
        else:
            probe["pending_new_data"] = False

        results.append(probe)

        print(f"  source_max:     {source_max}")
        if probe.get("source_insert_max"):
            print(f"  source_insert:  {probe['source_insert_max']}")
        print(f"  db_max:         {probe['db_max']}")
        print(f"  last_ingest:    {last_ingest}")
        print(f"  production_max: {prod_max}")
        if probe.get("note"):
            print(f"  note:           {probe['note']}")
        if probe.get("pending_new_data"):
            print("  >>> NEW DATA LIKELY — run weekly_inspection_ingest.py")
        else:
            print("  no new source data detected (or probe unavailable)")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if pending:
        print(f"  States with likely new data: {', '.join(pending)}")
        print("  Action: run scripts/weekly_inspection_ingest.py (requires DATABASE_URL)")
    else:
        print("  No new source data detected in probed states.")
        skipped = [r["state"] for r in results if r.get("note")]
        if skipped:
            print(f"  States not fully probed (need DB or manual): {', '.join(skipped)}")

    report_path = REPO_ROOT / ".firecrawl" / f"freshness-probe-{date.today().isoformat()}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(results, indent=2, default=str))
    print(f"\n  Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

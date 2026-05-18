-- Add columns missed from 0034_ut_universe

alter table facilities
  add column if not exists license_subtype text,
  add column if not exists county         text;

comment on column facilities.license_subtype is
  'UT: "Type I" or "Type II" sub-classification for assisted living facilities, derived from UGRC LICENSE_TYPE field.';

comment on column facilities.county is
  'County name for the facility. Generic across states.';

-- Washington display tier 2b.
--
-- Migration 0044 added facilities.mc_designation_type with an unnamed check.
-- Postgres named it facilities_mc_designation_type_check. The live catalog
-- allows only NULL, 'Secure Dementia Care Unit', and 'Special Care'.
--
-- 'accepts_dementia_no_secured_unit' means the home told StarlynnCare it
-- accepts residents with dementia and has no secured or dedicated unit.
-- It is not memory care and it is not a Pennsylvania secured-unit designation.
-- A row counts only when mc_program_quote or mc_review_notes is also set.
-- This migration does not update any row.

alter table facilities
  drop constraint if exists facilities_mc_designation_type_check;

alter table facilities
  add constraint facilities_mc_designation_type_check
  check (
    mc_designation_type is null
    or mc_designation_type in (
      'Secure Dementia Care Unit',
      'Special Care',
      'accepts_dementia_no_secured_unit'
    )
  );

comment on column facilities.mc_designation_type is
  'Pennsylvania HSD values: null, ''Secure Dementia Care Unit'', or ''Special Care''. '
  'Washington display tier 2b adds ''accepts_dementia_no_secured_unit'': the home '
  'told StarlynnCare it accepts residents with dementia and has no secured or '
  'dedicated unit. That value is not memory care. It counts only with a non-empty '
  'mc_program_quote (the words, with the call date) or mc_review_notes (phone call '
  'with date and staff first name, or the operator URL). Never test this column '
  'with = true, and never treat the Washington value as a secured unit.';

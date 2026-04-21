-- Remove legacy content keys that were generated under the old prompt schema.
-- The new schema uses { headline, memory_care_approach, tour_questions, generated_at, model }.
-- Keys intro, neighborhood, and what_families_should_know are no longer generated
-- and no longer rendered; strip them to keep the column tidy.

UPDATE facilities
SET content = content
  - 'intro'
  - 'neighborhood'
  - 'what_families_should_know'
WHERE
  content IS NOT NULL
  AND (
    content ? 'intro'
    OR content ? 'neighborhood'
    OR content ? 'what_families_should_know'
  );

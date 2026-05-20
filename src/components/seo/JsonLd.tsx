/**
 * Emits one `<script type="application/ld+json">` wrapping all nodes in `@graph`.
 * Using a single script avoids duplicate sibling blocks that some crawlers (and
 * RSC/hydration edge cases) surface as identical structured-data hashes.
 */
function stripContextForGraph(obj: object): object {
  const o = obj as Record<string, unknown>;
  if (!("@context" in o)) return obj;
  const { ["@context"]: _removed, ...rest } = o;
  return rest;
}

export function JsonLd({ objects }: { objects: object | object[] }) {
  const list = Array.isArray(objects) ? objects : [objects];
  if (list.length === 0) return null;

  const graph = list.map(stripContextForGraph);
  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  // Escape `<` to `\u003c` so a moderator-approved review (or any DB value)
  // containing `</script>` cannot break out of the inline JSON-LD block.
  // Audit finding H1.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

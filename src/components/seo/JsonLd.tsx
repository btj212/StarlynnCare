/**
 * Renders one <script type="application/ld+json"> per object (recommended for mixed types).
 */
export function JsonLd({ objects }: { objects: object | object[] }) {
  const list = Array.isArray(objects) ? objects : [objects];
  return (
    <>
      {list.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </>
  );
}

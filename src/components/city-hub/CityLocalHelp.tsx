import type { LocalHelp } from "@/lib/city-hub/localHelp";
import { SectionHead } from "@/components/editorial/SectionHead";

export function CityLocalHelp({ help }: { help: LocalHelp }) {
  return (
    <section className="border-b border-clearing-rule" style={{ background: "var(--color-paper)" }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 md:px-[60px] py-14">
        <SectionHead label="Local help" title={<>{help.heading}</>} />
        <ul className="m-0 grid max-w-[72ch] list-none gap-3 p-0">
          {help.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[16px] font-medium text-teal underline underline-offset-4"
                {...(link.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {link.label}
              </a>
              {link.note ? (
                <span className="block font-[family-name:var(--font-sans)] text-[14px] text-ink-3">
                  {link.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

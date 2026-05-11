import { InlineWidget } from "react-calendly";

interface CalendlyEmbedProps {
  url: string;
  prefill?: {
    name?: string;
    email?: string;
  };
}

/**
 * CalendlyEmbed Component
 *
 * Responsive Calendly inline widget with dynamic height.
 * Embedded directly in the page for better UX than external links.
 *
 * @param url - Calendly scheduling URL (e.g., https://calendly.com/username/30min)
 * @param prefill - Optional prefill data for name and email
 */
export default function CalendlyEmbed({ url, prefill }: CalendlyEmbedProps) {
  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-white"
      style={{
        height: "1000px",
      }}
    >
      <div style={{ height: "100%", width: "100%" }}>
        <InlineWidget
          url={url}
          styles={{
            height: "1000px",
            minHeight: "1000px",
          }}
          prefill={prefill}
          pageSettings={{
            hideEventTypeDetails: false,
            hideLandingPageDetails: false,
            backgroundColor: "ffffff",
            textColor: "1f2937",
            primaryColor: "334155",
          }}
        />
      </div>
    </div>
  );
}

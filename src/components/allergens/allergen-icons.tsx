import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function GlutenIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 20V6" />
      <path d="M12 9c-1.9 0-3.3-1.1-4-3" />
      <path d="M12 12c-2 0-3.6-1.1-4.4-3" />
      <path d="M12 15c-1.9 0-3.3-1.1-4-3" />
      <path d="M12 9c1.9 0 3.3-1.1 4-3" />
      <path d="M12 12c2 0 3.6-1.1 4.4-3" />
      <path d="M12 15c1.9 0 3.3-1.1 4-3" />
      <path d="M10.4 20h3.2" />
    </svg>
  );
}

export function MilkIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 4h6" />
      <path d="M10 4v2l-1.2 1.8V18a2 2 0 0 0 2 2h2.4a2 2 0 0 0 2-2V7.8L14 6V4" />
      <path d="M8.8 10h6.4" />
    </svg>
  );
}

export function EggsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4c2.5 0 4.6 2.8 4.6 6.3S14.5 20 12 20s-4.6-2.2-4.6-5.7S9.5 4 12 4z" />
      <path d="M10.4 11.4c.5-.8 1.4-1.3 2.4-1.3" />
    </svg>
  );
}

export function FishIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 12c2.4-2.8 5-4.1 8-4.1 2.2 0 4.1.7 6 2.1l2-.9-.9 2.9.9 2.9-2-.9a9.8 9.8 0 0 1-6 2.1c-3 0-5.6-1.3-8-4.1z" />
      <circle cx="13.8" cy="11.3" r="0.8" />
    </svg>
  );
}

export function TreeNutsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5.2c2.7 0 4.8 2 4.8 4.6 0 3.7-2.5 7.2-4.8 9-2.3-1.8-4.8-5.3-4.8-9 0-2.6 2.1-4.6 4.8-4.6z" />
      <path d="M12 5.2V3.8" />
      <path d="M9.9 11.2c.6-.8 1.3-1.2 2.1-1.2" />
    </svg>
  );
}

export function PeanutsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9.6 6.3c2 0 3.5 1.6 3.5 3.6 0 1.4-.8 2.7-2 3.2" />
      <path d="M14.4 17.7c-2 0-3.5-1.6-3.5-3.6 0-1.4.8-2.7 2-3.2" />
      <path d="M8.5 8.1c-1.5.7-2.5 2.2-2.5 4 0 2.4 1.8 4.3 4.1 4.3" />
      <path d="M15.5 15.9c1.5-.7 2.5-2.2 2.5-4 0-2.4-1.8-4.3-4.1-4.3" />
    </svg>
  );
}

export function SoyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 7.5c1.8 0 3.1 1.3 3.1 3s-1.3 3-3.1 3-3.1-1.3-3.1-3 1.3-3 3.1-3z" />
      <path d="M15 10.5c1.8 0 3.1 1.3 3.1 3s-1.3 3-3.1 3-3.1-1.3-3.1-3 1.3-3 3.1-3z" />
      <path d="M8.5 17.2c2.5 1.4 5.6 1.4 8.1 0" />
    </svg>
  );
}

export function CrustaceansIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6.2 12.4c0-2.6 2.2-4.8 5-4.8s5 2.2 5 4.8c0 2.7-2.2 4.9-5 4.9s-5-2.2-5-4.9z" />
      <path d="M11.2 7.6V5.3" />
      <path d="M8.2 10.2l-2.5-1.6" />
      <path d="M8 14.8l-2.7 1.5" />
      <path d="M14.1 10.2l2.5-1.6" />
      <path d="M14.3 14.8l2.7 1.5" />
      <path d="M11.2 17.3v2.1" />
    </svg>
  );
}

export function CeleryIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.3 19.4V11" />
      <path d="M11.9 19.4V9.5" />
      <path d="M15.5 19.4V11.8" />
      <path d="M8.3 11c0-2 1.3-3.8 3.2-4.5" />
      <path d="M11.9 9.5c0-2.4 1.6-4.4 4-5" />
      <path d="M15.5 11.8c0-1.9 1.2-3.5 3.1-4.2" />
    </svg>
  );
}

export function MustardIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.1 7.2h7.8l-.8 7.8a3.2 3.2 0 0 1-3.2 2.8h-.8a3.2 3.2 0 0 1-3.2-2.8z" />
      <path d="M10.2 7.2V5.2h3.6v2" />
      <circle cx="10.8" cy="12.5" r="0.7" />
      <circle cx="13.2" cy="13.6" r="0.7" />
    </svg>
  );
}

export function SesameIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.4 9.1c1.2 0 2.2 1 2.2 2.3s-1 2.3-2.2 2.3-2.2-1-2.2-2.3 1-2.3 2.2-2.3z" />
      <path d="M12 7.2c1.2 0 2.2 1 2.2 2.3s-1 2.3-2.2 2.3-2.2-1-2.2-2.3 1-2.3 2.2-2.3z" />
      <path d="M15.6 9.7c1.2 0 2.2 1 2.2 2.3s-1 2.3-2.2 2.3-2.2-1-2.2-2.3 1-2.3 2.2-2.3z" />
    </svg>
  );
}

export function SulphitesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.5 6.2h7l2.1 5.3L14.2 18H9.8l-3.4-6.5z" />
      <path d="M10.2 10.4h3.6" />
      <path d="M10.2 13.2h2.8" />
    </svg>
  );
}

export function LupinsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5.2v13.6" />
      <path d="M12 8.1c1.5 0 2.7-.9 3.2-2.2" />
      <path d="M12 10.9c2 0 3.6-1.1 4.2-2.8" />
      <path d="M12 13.6c1.7 0 3.1-.9 3.8-2.3" />
      <path d="M12 8.1c-1.5 0-2.7-.9-3.2-2.2" />
      <path d="M12 10.9c-2 0-3.6-1.1-4.2-2.8" />
      <path d="M12 13.6c-1.7 0-3.1-.9-3.8-2.3" />
    </svg>
  );
}

export function MolluscsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 18.8c4 0 7.2-3.2 7.2-7.2-4 0-7.2 3.2-7.2 7.2z" />
      <path d="M12 18.8c-4 0-7.2-3.2-7.2-7.2 4 0 7.2 3.2 7.2 7.2z" />
      <path d="M12 11.6v7.2" />
      <path d="M8.6 12.8l2.5 5.5" />
      <path d="M15.4 12.8l-2.5 5.5" />
    </svg>
  );
}

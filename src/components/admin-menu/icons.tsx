import {
  CeleryIcon,
  CrustaceansIcon,
  EggsIcon,
  FishIcon,
  GlutenIcon,
  LupinsIcon,
  MilkIcon,
  MolluscsIcon,
  MustardIcon,
  PeanutsIcon,
  SesameIcon,
  SoyIcon,
  SulphitesIcon,
  TreeNutsIcon,
} from "@/components/allergens/allergen-icons";

export function AllergenIcon({ type }: { type: string }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "glutine":
      return <GlutenIcon aria-hidden {...iconProps} />;
    case "latte":
      return <MilkIcon aria-hidden {...iconProps} />;
    case "arachidi":
      return <PeanutsIcon aria-hidden {...iconProps} />;
    case "sedano":
      return <CeleryIcon aria-hidden {...iconProps} />;
    case "senape":
      return <MustardIcon aria-hidden {...iconProps} />;
    case "sesamo":
      return <SesameIcon aria-hidden {...iconProps} />;
    case "uova":
      return <EggsIcon aria-hidden {...iconProps} />;
    case "frutta_guscio":
      return <TreeNutsIcon aria-hidden {...iconProps} />;
    case "soia":
      return <SoyIcon aria-hidden {...iconProps} />;
    case "pesce":
      return <FishIcon aria-hidden {...iconProps} />;
    case "crostacei":
      return <CrustaceansIcon aria-hidden {...iconProps} />;
    case "molluschi":
      return <MolluscsIcon aria-hidden {...iconProps} />;
    case "lupini":
      return <LupinsIcon aria-hidden {...iconProps} />;
    case "solfiti":
      return <SulphitesIcon aria-hidden {...iconProps} />;
    default:
      return <SesameIcon aria-hidden {...iconProps} />;
  }
}

export function VisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 20L20 4" />
    </svg>
  );
}

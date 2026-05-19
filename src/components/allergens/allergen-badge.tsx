"use client";

import {
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type SVGProps,
} from "react";
import clsx from "clsx";
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

type IconType = (props: SVGProps<SVGSVGElement>) => ReactElement;

type AllergenDefinition = {
  id: string;
  label: string;
  aliases: string[];
  icon: IconType;
};

const allergenDefinitions: AllergenDefinition[] = [
  {
    id: "gluten",
    label: "Contiene glutine",
    aliases: ["glutine", "frumento", "grano", "wheat"],
    icon: GlutenIcon,
  },
  {
    id: "milk",
    label: "Contiene latte e derivati",
    aliases: ["latte", "milk", "lattosio", "lactose"],
    icon: MilkIcon,
  },
  {
    id: "eggs",
    label: "Contiene uova",
    aliases: ["uova", "uovo", "egg"],
    icon: EggsIcon,
  },
  {
    id: "fish",
    label: "Contiene pesce",
    aliases: ["pesce", "fish"],
    icon: FishIcon,
  },
  {
    id: "tree-nuts",
    label: "Contiene frutta a guscio",
    aliases: ["frutta a guscio", "nocciola", "noci", "mandorle", "nuts"],
    icon: TreeNutsIcon,
  },
  {
    id: "peanuts",
    label: "Contiene arachidi",
    aliases: ["arachidi", "arachide", "peanut"],
    icon: PeanutsIcon,
  },
  {
    id: "soy",
    label: "Contiene soia",
    aliases: ["soia", "soy"],
    icon: SoyIcon,
  },
  {
    id: "crustaceans",
    label: "Contiene crostacei",
    aliases: ["crostacei", "gamberi", "shrimp"],
    icon: CrustaceansIcon,
  },
  {
    id: "celery",
    label: "Contiene sedano",
    aliases: ["sedano", "celery"],
    icon: CeleryIcon,
  },
  {
    id: "mustard",
    label: "Contiene senape",
    aliases: ["senape", "mustard"],
    icon: MustardIcon,
  },
  {
    id: "sesame",
    label: "Contiene sesamo",
    aliases: ["sesamo", "sesame"],
    icon: SesameIcon,
  },
  {
    id: "sulphites",
    label: "Contiene solfiti",
    aliases: ["solfiti", "solfito", "sulfite"],
    icon: SulphitesIcon,
  },
  {
    id: "lupins",
    label: "Contiene lupini",
    aliases: ["lupini", "lupin"],
    icon: LupinsIcon,
  },
  {
    id: "molluscs",
    label: "Contiene molluschi",
    aliases: ["molluschi", "mollusco", "mollusc"],
    icon: MolluscsIcon,
  },
];

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const fallbackDefinition: AllergenDefinition = {
  id: "generic",
  label: "Contiene allergeni",
  aliases: [],
  icon: SesameIcon,
};

const resolveAllergen = (value: string): AllergenDefinition => {
  const normalized = normalize(value);
  const exact = allergenDefinitions.find(
    (item) =>
      item.id === normalized ||
      item.aliases.some((alias) => normalized.includes(alias)),
  );
  return exact ?? fallbackDefinition;
};

type AllergenBadgeProps = {
  allergen: string;
  showLabel?: boolean;
  active?: boolean;
  className?: string;
  showTooltip?: boolean;
  onClick?: () => void;
};

export function AllergenBadge({
  allergen,
  showLabel = false,
  active = false,
  className,
  showTooltip = true,
  onClick,
}: AllergenBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const resolved = useMemo(() => resolveAllergen(allergen), [allergen]);
  const Icon = resolved.icon;
  const tooltipLabel = resolved.label;

  const clearTimers = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
    }, 1250);
  };

  const handleOpenTooltip = () => {
    if (!showTooltip) return;
    setTooltipOpen(true);
    scheduleHide();
  };

  return (
    <button
      type="button"
      className={clsx(
        "qr-allergen-badge",
        showLabel && "with-label",
        active && "active",
        className,
      )}
      aria-label={tooltipLabel}
      onPointerDown={() => {
        if (!showTooltip) return;
        clearTimers();
        holdTimerRef.current = window.setTimeout(handleOpenTooltip, 300);
      }}
      onPointerUp={() => {
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      }}
      onPointerLeave={() => {
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      }}
      onClick={() => {
        onClick?.();
        if (showTooltip) {
          setTooltipOpen((prev) => {
            const next = !prev;
            if (next) scheduleHide();
            return next;
          });
        }
      }}
      onBlur={() => setTooltipOpen(false)}
      onMouseEnter={() => {
        if (showTooltip) setTooltipOpen(true);
      }}
      onMouseLeave={() => {
        if (showTooltip) setTooltipOpen(false);
      }}
    >
      <span className="qr-allergen-icon-wrap" aria-hidden>
        <Icon className="qr-allergen-icon" />
      </span>
      {showLabel ? (
        <span className="qr-allergen-inline-label">{allergen}</span>
      ) : null}
      {showTooltip ? (
        <span
          className={
            tooltipOpen ? "qr-allergen-tooltip open" : "qr-allergen-tooltip"
          }
          role="tooltip"
        >
          {tooltipLabel}
        </span>
      ) : null}
    </button>
  );
}

export const allergenCatalog = allergenDefinitions.map((item) => ({
  id: item.id,
  label: item.label,
  icon: item.icon,
}));

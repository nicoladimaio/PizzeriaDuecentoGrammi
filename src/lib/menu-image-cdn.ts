import type { MenuImageFit } from "@/types/menu-app";

type MenuImageVariant = "card" | "detail" | "featured";

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ?? "";

const isRemoteImage = (src: string) => /^https?:\/\//i.test(src);

const buildTransformation = (
  variant: MenuImageVariant,
  imageFit?: MenuImageFit,
) => {
  switch (variant) {
    case "card":
      return imageFit === "contain"
        ? "f_auto,q_auto:good,dpr_auto,c_limit,w_720,h_720"
        : "f_auto,q_auto:good,dpr_auto,c_fill,g_auto,w_720,h_720";
    case "featured":
      return "f_auto,q_auto:good,dpr_auto,c_fill,g_auto,w_1080,h_720";
    case "detail":
    default:
      return imageFit === "cover"
        ? "f_auto,q_auto:best,dpr_auto,c_fill,g_auto,w_1600,h_1600"
        : "f_auto,q_auto:best,dpr_auto,c_limit,w_1600,h_1600";
  }
};

export const getMenuImageSrc = (
  src: string,
  variant: MenuImageVariant,
  imageFit?: MenuImageFit,
) => {
  if (!src || !CLOUDINARY_CLOUD_NAME || !isRemoteImage(src)) {
    return src;
  }

  const transformation = buildTransformation(variant, imageFit);
  const encodedSource = encodeURIComponent(src);
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformation}/${encodedSource}`;
};

export const isMenuImageCdnEnabled = () => Boolean(CLOUDINARY_CLOUD_NAME);

export type DetailsRowContent = {
  variant: string;
  price: string;
};

export function shouldStackDetailsRow({
  variant,
  price,
}: DetailsRowContent): boolean {
  return Boolean(variant.trim() && price.trim());
}

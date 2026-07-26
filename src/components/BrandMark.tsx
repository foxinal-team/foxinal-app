type BrandMarkProps = {
  className?: string;
  title?: string;
};

/** Fox + terminal mark — matches app icon / favicon. */
export function BrandMark({ className, title = "Foxinal" }: BrandMarkProps) {
  return (
    <img
      className={className}
      src="/foxinal-icon.png"
      width={128}
      height={128}
      alt={title}
      draggable={false}
    />
  );
}

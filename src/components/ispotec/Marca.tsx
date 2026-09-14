import logo from "@/assets/ispotec-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Marca({
  className,
  tamanho = 44,
}: {
  className?: string;
  tamanho?: number;
}) {
  return (
    <img
      src={logo.url}
      alt="Logótipo do ISPOTEC — Instituto Superior Politécnico e de Tecnologias"
      width={tamanho}
      height={tamanho}
      className={cn("rounded-md bg-card object-contain p-1", className)}
    />
  );
}

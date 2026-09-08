import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function FloatingInput({
  id,
  label,
  ...props
}: Omit<ComponentProps<typeof Input>, "id" | "placeholder"> & { id: string; label: string }) {
  return (
    <div className="desk-floating-field">
      <Input {...props} id={id} placeholder=" " />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

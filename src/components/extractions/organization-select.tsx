import type { Organization } from "@/lib/backend";

export function OrganizationSelect({
  organizations,
  selected,
  onSelect,
  disabled = false,
}: {
  organizations: Organization[] | undefined;
  selected: Organization | undefined;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  if (!selected || !organizations || organizations.length < 2) return null;

  return (
    <label className="my-3 flex w-fit items-center gap-2 text-sm">
      Label
      <select
        className="h-9 max-w-60 rounded-md border bg-background px-2"
        value={selected.id}
        onChange={(event) => onSelect(event.target.value)}
        disabled={disabled}
      >
        {organizations.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

import type { ShareRole } from "@schreibzeug/files-api";
import { m } from "../paraglide/messages";
import { Select } from "../ui/select";

const ROLES: Record<ShareRole, () => string> = { edit: m.role_select_edit, view: m.role_select_view };

/** "Darf bearbeiten" or "Darf ansehen", for people and for links. */
export const RoleSelect = ({
  value,
  label,
  onChange,
}: {
  value: ShareRole;
  label: string;
  onChange: (role: ShareRole) => void;
}) => (
  <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as ShareRole)}>
    {(Object.keys(ROLES) as ShareRole[]).map((role) => (
      <option key={role} value={role}>
        {ROLES[role]()}
      </option>
    ))}
  </Select>
);

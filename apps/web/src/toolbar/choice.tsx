import { Select } from "../ui/select";

export type ChoiceProps = {
  label: string;
  /** The current value; null when the selection mixes several. */
  value: string | null;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
};

/**
 * A native select in the toolbar's look. Native, so the keyboard, type-ahead and long lists (all
 * the engine's fonts) work everywhere without a library. A value that is not among the options
 * (a font the document names but the engine lacks) is still shown.
 */
export const Choice = ({ label, value, options, disabled, onChange, className = "" }: ChoiceProps) => {
  const known = value === null || options.some((option) => option.value === value);
  return (
    <Select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      height="sm"
      className={className}
    >
      {value === null && <option value="">–</option>}
      {!known && <option value={value}>{value}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
};

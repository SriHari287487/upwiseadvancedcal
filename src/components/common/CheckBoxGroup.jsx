import React from "react";
import { FormGroup, FormControlLabel, Checkbox } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

/**
 * Styled CheckboxGroup
 */
export default function CheckboxGroup({
  items = [],
  selected = [],
  onChange,
  getLabel = (x) => (typeof x === "string" ? x : x?.name ?? String(x)),
  getValue = (x) => (typeof x === "string" ? x : String(x?.id ?? x?.name ?? x)),
}) {
  const selectedSet = React.useMemo(
    () => new Set((selected || []).map(String)),
    [selected]
  );

  const toggle = (value) => {
    const v = String(value);
    const next = new Set(selectedSet);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange?.(Array.from(next));
  };

  return (
    <FormGroup>
      {items.map((item, idx) => {
        const value = getValue(item);
        const label = getLabel(item);
        const checked = selectedSet.has(String(value));

        return (
          <FormControlLabel
            key={value ?? idx}
            label={label}
            sx={{
              ml:3,
              color: "#9AA2B3",
              "& .MuiTypography-root": {
                fontSize: "15px",
                color: "#9AA2B3",
              },
            }}
            control={
              <Checkbox
                checked={checked}
                onChange={() => toggle(value)}
                icon={
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 6,
                      border: "1px solid #C1C7D0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "transparent",
                    }}
                  />
                }
                checkedIcon={
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 6,
                      backgroundColor: "#9AA2B3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckIcon
                      sx={{
                        fontSize: 14,
                        color: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                  </span>
                }
              />
            }
          />
        );
      })}
    </FormGroup>
  );
}

"use client";

import { useState } from "react";

export function MileageForm({
  currentMileage,
  disabled,
  onSubmit,
}: {
  currentMileage: number;
  disabled: boolean;
  onSubmit: (mileage: string) => Promise<void>;
}) {
  const [value, setValue] = useState(String(currentMileage));

  return (
    <form
      className="mileage-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(value);
      }}
    >
      <label className="sr-only" htmlFor="current-mileage">Current mileage</label>
      <div className="mileage-form-controls">
        <input
          id="current-mileage"
          name="mileage"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          aria-describedby="mileage-help"
        />
        <span aria-hidden="true">mi</span>
        <button className="button button-primary" type="submit" disabled={disabled}>
          {disabled ? "Saving…" : "Save mileage"}
        </button>
      </div>
      <p id="mileage-help" className="field-help">
        Enter any non-negative mileage. Lower values are allowed for corrections.
      </p>
    </form>
  );
}

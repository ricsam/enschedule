"use client";

export function Button() {
  return (
    // eslint-disable-next-line no-alert
    <button onClick={(): void => alert("booped")} type="button">
      Boop
    </button>
  );
}

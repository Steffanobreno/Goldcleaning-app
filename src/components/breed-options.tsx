import { DOG_BREEDS } from "@/lib/breeds";

/** Suggestions for breed inputs: give the input list="dog-breeds". Rendered once per page. */
export function BreedOptions() {
  return (
    <datalist id="dog-breeds">
      {DOG_BREEDS.map((b) => (
        <option key={b} value={b} />
      ))}
    </datalist>
  );
}

// The pet's photo, or a paw when there is none. `version` busts the browser cache after a change.
export function PetPhoto({ petId, version, name, size = 56 }: { petId: string; version: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (!version) {
    return (
      <span style={style} className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl" aria-hidden>
        🐾
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, auth-protected image; next/image would cache it publicly
    <img
      src={`/api/pets/${petId}/photo?v=${encodeURIComponent(version)}`}
      alt={`Photo of ${name}`}
      style={style}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

import type { User } from "../types";

export function UserAvatar({ user, large = false, imageUrl }: {
  user: User | null;
  large?: boolean;
  imageUrl?: string | null;
}) {
  const photo = imageUrl ?? user?.avatarUrl;
  const initials = user?.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  return (
    <div className={`avatar ${large ? "avatar-large" : ""}`}>
      {photo ? <img src={photo} alt={`Foto de ${user?.name ?? "perfil"}`} /> : <span aria-hidden="true">{initials}</span>}
    </div>
  );
}

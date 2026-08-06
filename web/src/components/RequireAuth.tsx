import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/api";
import { AppBootScreen } from "./AppBootScreen";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return <AppBootScreen />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

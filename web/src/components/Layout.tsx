import { SpaceProvider } from "../contexts/spaceContext";
import { AppSettingsProvider } from "../contexts/appSettingsContext";
import { AiArticleProvider } from "../contexts/aiArticleContext";
import { useMaxWidthMd } from "../hooks/useBreakpoint";
import { DesktopShell } from "./layout/DesktopShell";
import { MobileShell } from "./layout/MobileShell";

export function Layout() {
  return (
    <SpaceProvider>
      <AppSettingsProvider>
        <AiArticleProvider>
          <ResponsiveLayout />
        </AiArticleProvider>
      </AppSettingsProvider>
    </SpaceProvider>
  );
}

function ResponsiveLayout() {
  const isMobile = useMaxWidthMd();
  return isMobile ? <MobileShell /> : <DesktopShell />;
}

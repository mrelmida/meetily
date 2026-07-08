import React, { useEffect } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  WelcomeStep,
  ThemeStep,
  PermissionsStep,
  DownloadProgressStep,
  SetupOverviewStep,
} from './steps';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { currentStep } = useOnboarding();
  const [isMac, setIsMac] = React.useState(false);

  useEffect(() => {
    // Check if running on macOS
    const checkPlatform = async () => {
      try {
        // Dynamic import to avoid SSR issues if any
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        console.error('Failed to detect platform:', e);
        // Fallback
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    checkPlatform();
  }, []);

  // 5-Step Onboarding Flow (System-Recommended Models):
  // Step 1: Welcome - Introduce Meetily features
  // Step 2: Theme - Pick appearance (dark by default) and accent color
  // Step 3: Setup Overview - Database initialization + show recommended downloads
  // Step 4: Download Progress - Download Parakeet + Summary Model (auto-selected based on platform/RAM)
  // Step 5: Permissions - Request mic + system audio (macOS only)

  return (
    <div className="onboarding-flow">
      {currentStep === 1 && <WelcomeStep />}
      {currentStep === 2 && <ThemeStep />}
      {currentStep === 3 && <SetupOverviewStep />}
      {currentStep === 4 && <DownloadProgressStep />}
      {currentStep === 5 && isMac && <PermissionsStep />}
    </div>
  );
}

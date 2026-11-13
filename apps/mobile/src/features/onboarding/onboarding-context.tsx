import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const COMPLETE_KEY = '@unfair-weekend/onboarding-complete-v3';
const MAP_HINT_KEY = '@unfair-weekend/map-hint-seen-v1';

interface OnboardingValue {
  ready: boolean;
  visible: boolean;
  runId: number;
  mapHintVisible: boolean;
  finish: () => void;
  replay: () => void;
  dismissMapHint: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const userInteracted = useRef(false);
  const [state, setState] = useState({
    ready: false,
    completed: false,
    visible: false,
    runId: 0,
    mapHintSeen: false,
  });

  useEffect(() => {
    let active = true;
    void Promise.all([AsyncStorage.getItem(COMPLETE_KEY), AsyncStorage.getItem(MAP_HINT_KEY)])
      .then(([completed, mapHintSeen]) => {
        if (!active) return;
        if (userInteracted.current) {
          setState((current) => ({ ...current, ready: true, mapHintSeen: mapHintSeen === 'true' }));
          return;
        }
        setState({
          ready: true,
          completed: completed === 'true',
          visible: completed !== 'true',
          runId: 0,
          mapHintSeen: mapHintSeen === 'true',
        });
      })
      .catch(() => {
        if (!active) return;
        if (userInteracted.current) {
          setState((current) => ({ ...current, ready: true }));
          return;
        }
        setState({ ready: true, completed: false, visible: true, runId: 0, mapHintSeen: false });
      });

    return () => {
      active = false;
    };
  }, []);

  const finish = useCallback(() => {
    userInteracted.current = true;
    setState((current) => ({ ...current, ready: true, completed: true, visible: false }));
    void AsyncStorage.setItem(COMPLETE_KEY, 'true').catch(() => undefined);
  }, []);

  const replay = useCallback(() => {
    userInteracted.current = true;
    setState((current) => ({ ...current, ready: true, visible: true, runId: current.runId + 1 }));
  }, []);

  const dismissMapHint = useCallback(() => {
    setState((current) => ({ ...current, mapHintSeen: true }));
    void AsyncStorage.setItem(MAP_HINT_KEY, 'true').catch(() => undefined);
  }, []);

  return (
    <OnboardingContext
      value={{
        ready: state.ready,
        visible: state.visible,
        runId: state.runId,
        mapHintVisible: state.ready && !state.mapHintSeen,
        finish,
        replay,
        dismissMapHint,
      }}
    >
      {children}
    </OnboardingContext>
  );
}

export function useOnboarding(): OnboardingValue {
  const value = use(OnboardingContext);
  if (!value) throw new Error('useOnboarding braucht den OnboardingProvider.');
  return value;
}

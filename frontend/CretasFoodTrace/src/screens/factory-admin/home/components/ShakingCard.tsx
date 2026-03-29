/**
 * ShakingCard - iPhone-style wobble animation for edit mode
 */
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface ShakingCardProps {
  isShaking: boolean;
  children: React.ReactNode;
  style?: object;
  delay?: number;
}

export function ShakingCard({ isShaking, children, style, delay = 0 }: ShakingCardProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isShaking) {
      const startShake = () => {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(2, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(-1.5, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.5, { duration: 80, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
        scale.value = withTiming(0.98, { duration: 200 });
      };

      const timer = setTimeout(startShake, delay);
      return () => clearTimeout(timer);
    }

    cancelAnimation(rotation);
    rotation.value = withTiming(0, { duration: 150 });
    scale.value = withTiming(1, { duration: 150 });
    return undefined;
  }, [isShaking, delay, rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

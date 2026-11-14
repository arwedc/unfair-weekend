import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, MAX_FONT_SCALE, textStyle, type TextStyleName } from '@/theme';

type TextColor = keyof typeof colors.text;

export interface TextProps extends RNTextProps {
  /** Text-Token aus @repo/shared (z. B. title1, body, caption). */
  variant?: TextStyleName;
  /** Semantische Textfarbe (primary, secondary, accent …). */
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
}

/** Einheitlicher Text mit Inter und den Typografie-Tokens. Skaliert mit der Systemschriftgröße. */
export function Text({
  variant = 'body',
  color = 'primary',
  align,
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        textStyle(variant),
        { color: colors.text[color] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

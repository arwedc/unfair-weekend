import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { headingFamily, useHeadingFont } from '@/lib/font-preview';
import { colors, MAX_FONT_SCALE, textStyle, textStyles, type TextStyleName } from '@/theme';

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
  const headingFont = useHeadingFont();
  const family = headingFamily(headingFont, variant, textStyles[variant].fontWeight);
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        textStyle(variant),
        family && { fontFamily: family },
        { color: colors.text[color] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

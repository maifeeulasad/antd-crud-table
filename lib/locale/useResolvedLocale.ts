import { useContext, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import type { Locale as AntdLocale } from 'antd/es/locale';
import antdEnUS from 'antd/locale/en_US';
import { enUSIntl, intlMap, findIntlKeyByAntdLocaleKey } from '@ant-design/pro-components';

import { enUS } from './en_US';
import type { CrudTableLocale, PartialCrudTableLocale } from './types';

/** Everything `CrudTable` needs to render in the right language. */
export interface ResolvedLocale {
  /** The library's own strings, defaults merged with any override. */
  strings: CrudTableLocale;
  /** ProTable's message bundle, derived from the surrounding antd locale. */
  intl: typeof enUSIntl;
  /**
   * The antd locale to apply, or `undefined` to inherit.
   *
   * `undefined` means the consumer already has a `ConfigProvider`, so the
   * table must not override it. A value means there is none, and antd's
   * components would otherwise fall back to their built-in defaults - which
   * are Chinese, not English.
   */
  antdLocale: AntdLocale | undefined;
  /** Whether an antd `ConfigProvider` locale was found in the tree. */
  inherited: boolean;
}

/**
 * Resolve the language for a table from three sources, in order.
 *
 * 1. An explicit `locale` prop, for overriding individual strings.
 * 2. The surrounding antd `ConfigProvider`, so a table follows the app.
 * 3. English, when there is no provider at all.
 *
 * Step 3 is the one that matters most in practice. antd's components read
 * their own `ConfigProvider`, which `ProConfigProvider`'s `intl` does not
 * feed, so a table rendered outside any provider showed English chrome from
 * ProTable next to Chinese pagination and modal buttons from antd. Supplying
 * an explicit antd locale in that case is what makes the default coherent.
 */
export const useResolvedLocale = (override?: PartialCrudTableLocale): ResolvedLocale => {
  const config = useContext(ConfigProvider.ConfigContext);
  const inheritedLocale = config.locale;

  return useMemo(() => {
    const strings: CrudTableLocale = override ? { ...enUS, ...override } : enUS;

    // ProTable keys its bundles by IETF tag; antd locales carry a shorter key
    // (`en`, `fr`, `zh-cn`) that pro-components maps for us.
    // `findIntlKeyByAntdLocaleKey` returns a plain string, so the lookup is
    // narrowed against the map's own keys rather than indexed blindly.
    const intlKey = inheritedLocale?.locale
      ? findIntlKeyByAntdLocaleKey(inheritedLocale.locale)
      : undefined;
    const isKnownIntlKey = (key: string): key is keyof typeof intlMap => key in intlMap;
    const intl = intlKey && isKnownIntlKey(intlKey) ? intlMap[intlKey] : enUSIntl;

    return {
      strings,
      intl,
      // Only supply a locale when nothing above us did; overriding a
      // consumer's ConfigProvider would relabel their whole subtree.
      antdLocale: inheritedLocale ? undefined : antdEnUS,
      inherited: Boolean(inheritedLocale),
    };
  }, [override, inheritedLocale]);
};

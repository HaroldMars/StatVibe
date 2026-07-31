import { screens as authScreens } from './auth.js';
import { screens as tabExtraScreens, tabScreens } from './tabs.js';
import { screens as secondaryScreens } from './secondary.js';

export const screens = {
  ...authScreens,
  ...tabExtraScreens,
  ...secondaryScreens,
};

export { tabScreens };

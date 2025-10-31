// src/utils/tokenUtils.js

// Token reward values (you can later make this dynamic via Firebase)
export const TOKEN_RULES = {
  grazingEntry: 5,
  dungSale: 10,
  treePlanting: 8,
  alertViolation: -5,
};

/**
 * Get token reward for an action
 * @param {'grazingEntry' | 'dungSale' | 'treePlanting' | 'alertViolation'} actionType
 */
export const getTokenReward = (actionType) => {
  return TOKEN_RULES[actionType] || 0;
};

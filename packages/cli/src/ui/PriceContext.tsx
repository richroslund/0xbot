import React from 'react';
export const PriceContext = React.createContext<{ lastPrice?: number }>({ lastPrice: undefined });
